/**
 * Load-test CLI. Usage:
 *   pnpm exec tsx loadtest/run.ts --players 40 --transport local --host headless
 * Flags: --players N --rooms R --transport supabase|local --mode normal|race --calls K
 *        --host headless|app --pattern line|corners|center|full --tick ms --delay min,max
 *        --wrong 0..1 --max-loss pct --timeout sec --no-adversary
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkClaim, initialPickState, resolveWinners, scorePick, tabla } from '@engine';
import type { PatternId } from '@engine';
import { generateHostKeys, signMsg } from '../src/net/crypto.ts';
import { Bot } from './bot.ts';
import { Wire, cardPool, loadEnv, sleep, stats, supabaseCreds } from './common.ts';
import { HeadlessHost } from './host-headless.ts';
import { makeTransport, type Net } from './transports.ts';

loadEnv();

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? (process.argv[i + 1] ?? 'true') : def;
}
const flag = (n: string) => process.argv.includes('--' + n);

const cfg = {
  players: Number(arg('players', '40')),
  rooms: Number(arg('rooms', '1')),
  transport: (arg('transport', 'local') as 'local' | 'supabase'),
  mode: (arg('mode', 'normal') as 'normal' | 'race'),
  calls: Number(arg('calls', '54')),
  host: (arg('host', 'headless') as 'headless' | 'app'),
  pattern: arg('pattern', 'line') as PatternId,
  tick: Number(arg('tick', arg('transport', 'local') === 'supabase' ? '3000' : '1500')),
  delay: (arg('delay', '') || '').split(',').map(Number),
  wrong: Number(arg('wrong', '0.1')),
  maxLoss: Number(arg('max-loss', '0')),
  timeout: Number(arg('timeout', '0')),
  adversary: !flag('no-adversary'),
};
const [dMin, dMax] =
  cfg.delay.length === 2 && cfg.delay.every(Number.isFinite)
    ? (cfg.delay as [number, number])
    : [Math.min(300, cfg.tick * 0.2), Math.min(2500, cfg.tick * 0.6)];

const net: Net = { kind: cfg.transport };
if (cfg.transport === 'supabase') {
  const c = supabaseCreds();
  if (!c) {
    console.error('Supabase credentials not found (VITE_SUPABASE_URL/_ANON_KEY or NEXT_PUBLIC_SUPABASE_*).');
    process.exit(2);
  }
  net.url = c.url;
  net.key = c.key;
}

const wire = new Wire();
const pool = cardPool();
const roomCode = () => 'LT' + Math.random().toString(36).slice(2, 5).toUpperCase();

interface Violation {
  room: string;
  inv: string;
  detail: string;
}
const violations: Violation[] = [];
const violate = (room: string, inv: string, detail: string) => violations.push({ room, inv, detail });
const notes: string[] = [];
const callLat: number[] = [];
const pickLat: number[] = [];
let callsExpected = 0;
let callsSeen = 0;
let dup = 0;
let ooo = 0;
let picksSent = 0;
let picksAnswered = 0;
let latePicks = 0;
const errors: string[] = [];
let replayAccepted: boolean | null = null;
const claimOutcomes: { room: string; winners: string[]; expected: string[]; claims: number; valid: number }[] = [];
let firstDupMsgs = 0;
let callsWithCorrect = 0;

async function adversary(code: string, hostKey: string, host: HeadlessHost, bots: Bot[], room: string) {
  const tx = makeTransport(net, 'attacker', new Wire(), true);
  await tx.join(code, 'player', { hostKey });
  while (host.calls.length < 2 && !host.endMsg) await sleep(100);
  const att = await generateHostKeys();
  const sign = (m: unknown) => signMsg(att.priv, m);
  const forgedCall = { t: 'call', i: 900, cardId: pool[0]!.id, choices: [pool[0]!.id, pool[1]!.id, pool[2]!.id], lang: 'es', at: Date.now() };
  const forgedEnd = { t: 'end', roundNo: 777, winners: ['attacker'] };
  const forgedPR = { t: 'pickResult', roundNo: 777, i: 0, seat: bots[0]!.seat, correct: true, first: true };
  const forgedRound = { t: 'round', seed: 'x', roundNo: 777, mode: 'normal', pattern: 'line', callLang: 'es', speedSec: 3, hostKey: att.pub };
  const inj: unknown[] = [];
  for (const m of [forgedCall, forgedEnd, forgedPR, forgedRound]) {
    inj.push({ role: 'host', from: 'host', m }); // unsigned
    inj.push({ role: 'host', from: 'host', m, sig: 'AAAA' }); // garbage sig
    inj.push({ role: 'host', from: 'host', m, sig: await sign(m) }); // signed by attacker key (not pinned)
    inj.push({ role: 'player', from: 'attacker', m, sig: await sign(m) }); // host-only type from player role
  }
  // Spoofed pick: claims to be another seat.
  inj.push({ role: 'player', from: 'attacker', m: { t: 'pick', seat: bots[1]!.seat, roundNo: host.roundNo, i: host.calls.length - 1, cardId: '__spoof__' } });
  for (const f of inj) await tx.inject(f);
  // Replay of a genuinely signed host frame (call) seen on the wire.
  const before = bots.reduce((a, b) => a + b.dupCalls, 0);
  const legit = (tx.frames as { role?: string; m?: { t?: string } }[]).find((f) => f.role === 'host' && f.m?.t === 'call');
  if (legit) {
    await tx.inject(legit);
    await sleep(1500);
    const after = bots.reduce((a, b) => a + b.dupCalls, 0);
    replayAccepted = after > before; // dedupe by i counts it as a delivered duplicate
  }
  await tx.leave();
  notes.push(`[${room}] adversary injected ${inj.length} forged frames + 1 replay`);
}

async function runRoom(n: number): Promise<void> {
  const room = `room${n}`;
  const code = roomCode();
  const rw = wire;
  const htx = makeTransport(net, 'host-' + code, rw);
  // eslint-disable-next-line no-useless-assignment -- overwritten only for the app host
  let hostKey = '';
  let host: HeadlessHost | null = null;
  let appClose: (() => Promise<void>) | null = null;
  let useCode = code;
  if (cfg.host === 'app') {
    const m = await import('./run-with-app-host.ts');
    const a = await m.launchAppHost();
    useCode = a.code;
    hostKey = a.hostKey;
    appClose = a.close;
    // eslint-disable-next-line no-var -- hoisted on purpose for the app-host branch
    var startApp = a.startRound;
    // eslint-disable-next-line no-var -- hoisted on purpose for the app-host branch
    var appDone = a.waitEnd;
  } else {
    host = new HeadlessHost({ code, tx: htx, pool, pattern: cfg.pattern, tickMs: cfg.tick, maxCalls: cfg.calls });
    hostKey = await host.start();
  }
  const bots: Bot[] = [];
  for (let k = 0; k < cfg.players; k++) {
    const seat = `${room}-b${String(k).padStart(2, '0')}`;
    bots.push(new Bot({ seat, code: useCode, hostKey, tx: makeTransport(net, seat, rw), mode: cfg.mode, delayMin: dMin, delayMax: dMax, wrongRate: cfg.wrong }));
  }
  for (let k = 0; k < bots.length; k += 20) {
    await Promise.all(bots.slice(k, k + 20).map((b) => b.start()));
  }
  const t0 = Date.now();
  while (Date.now() - t0 < 20000 && (host ? host.players.size < cfg.players : !bots.every((b) => b.assigned) && Date.now() - t0 < 3000)) await sleep(100);
  if (host && host.players.size < cfg.players) violate(room, 'join', `only ${host.players.size}/${cfg.players} hellos reached the host`);
  await sleep(500);

  const limit = (cfg.timeout || (cfg.calls * cfg.tick) / 1000 + 40) * 1000;
  if (host) {
    host.begin();
    const adv = cfg.adversary ? adversary(useCode, hostKey, host, bots, room).catch((e) => notes.push('adversary error ' + e)) : Promise.resolve();
    await Promise.race([host.finished, sleep(limit)]);
    await adv;
    await sleep(1500);
    check(room, host, bots);
  } else {
    await startApp!();
    await Promise.race([appDone!(), sleep(limit)]);
    await sleep(1500);
    checkBotsOnly(room, bots);
  }
  for (const b of bots) errors.push(...b.errors.map((e) => room + ' bot: ' + e));
  if (host) errors.push(...host.errors.map((e) => room + ' host: ' + e));
  await Promise.all(bots.map((b) => b.stop().catch(() => undefined)));
  if (host) await host.stop();
  else await appClose?.();
}

function collect(bots: Bot[]) {
  for (const b of bots) {
    callsSeen += b.calls.size;
    dup += b.dupCalls;
    ooo += b.outOfOrder;
    for (const c of b.calls.values()) callLat.push(c.recvAt - c.at);
    for (const p of b.picks) {
      picksSent++;
      if (p.resultAt !== undefined) {
        picksAnswered++;
        pickLat.push(p.resultAt - p.sentAt);
      }
    }
  }
}

function checkBotsOnly(room: string, bots: Bot[]) {
  collect(bots);
  callsExpected += Math.max(...bots.map((b) => b.calls.size)) * bots.length;
  for (const b of bots) if (b.crossedWithoutResult || b.crossed.some((c) => !b.confirmed.has(c))) violate(room, 'cross-without-result', b.seat);
  const ends = new Set(bots.filter((b) => b.end).map((b) => [...b.end!.winners].sort().join(',')));
  if (ends.size > 1) violate(room, 'winners-agree', [...ends].join(' | '));
}

function check(room: string, host: HeadlessHost, bots: Bot[]) {
  collect(bots);
  const nCalls = host.calls.length;
  callsExpected += nCalls * bots.length;
  latePicks += host.pickLog.filter((p) => !p.accepted).length;

  // I3: every bot sees every call
  const lossPct = nCalls ? (100 * bots.reduce((a, b) => a + (nCalls - [...b.calls.keys()].filter((i) => i < nCalls).length), 0)) / (nCalls * bots.length) : 0;
  if (lossPct > cfg.maxLoss) violate(room, 'call-loss', `${lossPct.toFixed(2)}% > ${cfg.maxLoss}%`);

  // I1: exactly one first-correct per call that has a correct accepted pick
  for (const c of host.calls) {
    const correct = host.results.filter((r) => r.i === c.i && r.correct);
    if (!correct.length) continue;
    callsWithCorrect++;
    const firstSeats = new Set(host.results.filter((r) => r.i === c.i && r.first).map((r) => r.seat));
    if (firstSeats.size !== 1) violate(room, 'one-first', `call ${c.i}: ${firstSeats.size} first seats`);
    const msgs = host.results.filter((r) => r.i === c.i && r.first).length;
    if (msgs > 1) firstDupMsgs++;
    for (const b of bots) {
      const seen = b.firstSeen.get(c.i) ?? [];
      if (seen.length > 1 || (seen.length === 1 && !firstSeats.has(seen[0]!))) violate(room, 'one-first-observed', `${b.seat} call ${c.i} saw ${seen.join('+')}`);
    }
  }

  // I2: no cross without correct pickResult; crossed sets equal host's
  for (const b of bots) {
    if (b.crossedWithoutResult || b.crossed.some((x) => !b.confirmed.has(x))) violate(room, 'cross-without-result', b.seat);
    const h = new Set(host.state.crossed[b.seat] ?? []);
    const mine = new Set(b.crossed);
    const lostResults = host.results.filter((r) => r.seat === b.seat && r.correct).length;
    if ((h.size !== mine.size || [...h].some((x) => !mine.has(x))) && lostResults >= 0)
      violate(room, 'crossed-vs-host', `${b.seat} host=${h.size} bot=${mine.size}`);
  }

  // I4: independent replay of points + winners
  let st = initialPickState();
  for (const p of host.pickLog.filter((x) => x.accepted)) {
    const call = host.calls[p.i]!;
    st = scorePick(st, { seat: p.seat, i: p.i, cardId: p.cardId, at: p.order }, call).state;
  }
  const hostPts = JSON.stringify(Object.entries(host.state.points).sort());
  if (hostPts !== JSON.stringify(Object.entries(st.points).sort())) violate(room, 'points-replay', 'host points != replay');
  const calledAll = host.calls.map((c) => c.cardId);
  const valid = host.claimLog.filter((c) => c.valid);
  const wins = [...new Set(valid.map((c) => c.atCall))].sort((a, b) => a - b)[0];
  if (wins !== undefined) {
    const cand = valid.filter((c) => c.atCall === wins || c.atCall <= wins).map((c) => c.seat);
    const claimants = [...new Set(cand)].filter((s) => {
      const idx = host.players.get(s)!;
      return checkClaim(tabla(host.seed, idx, pool), calledAll, cfg.pattern, st.crossed[s] ?? []).valid;
    });
    const exp = resolveWinners(claimants.map((seat) => ({ seat, points: st.points[seat] ?? 0 }))).sort();
    const got = [...(host.endMsg?.winners ?? [])].sort();
    if (exp.join() !== got.join()) violate(room, 'winners', `expected ${exp} got ${got}`);
  } else if (host.endMsg && host.endMsg.winners.length) violate(room, 'winners', 'winners without valid claim');
  const got = (host.endMsg?.winners ?? []).slice().sort().join();
  const withEnd = bots.filter((b) => b.end);
  for (const b of withEnd) if ([...b.end!.winners].sort().join() !== got) violate(room, 'winners-observed', b.seat);
  if (host.endMsg && withEnd.length < bots.length) violate(room, 'end-loss', `${bots.length - withEnd.length} bots never saw end`);
  claimOutcomes.push({ room, winners: host.endMsg?.winners ?? [], expected: host.expectedWinners, claims: host.claimLog.length, valid: valid.length });

  // I5: adversary
  for (const b of bots) if (b.forgedSeen) violate(room, 'unsigned-accepted', `${b.seat} accepted ${b.forgedSeen} forged host-only msgs`);
  if (host.pickLog.some((p) => p.cardId === '__spoof__')) violate(room, 'spoofed-pick-accepted', 'host accepted pick with from != seat');
}

const started = Date.now();
await Promise.all(Array.from({ length: cfg.rooms }, (_, k) => runRoom(k)));
const secs = (Date.now() - started) / 1000;

const fan = stats(callLat);
const pk = stats(pickLat);
const peak = (m: Map<number, number>) => Math.max(0, ...m.values());
const lossPct = callsExpected ? (100 * (callsExpected - callsSeen)) / callsExpected : 0;
const report = {
  config: { ...cfg, delay: [dMin, dMax], transport: cfg.transport },
  durationSec: +secs.toFixed(1),
  fanoutMs: fan,
  pickToResultMs: { ...pk, unanswered: picksSent - picksAnswered, sent: picksSent, latePicksRejected: latePicks },
  calls: { expectedDeliveries: callsExpected, seen: callsSeen, lossPct: +lossPct.toFixed(3), duplicates: dup, outOfOrder: ooo, callsWithCorrectPick: callsWithCorrect, callsWithRepeatedFirstTrue: firstDupMsgs },
  claims: claimOutcomes,
  wire: {
    txFrames: wire.tx,
    rxFrames: wire.rx,
    txKB: Math.round(wire.txBytes / 1024),
    avgTxPerSec: +(wire.tx / secs).toFixed(1),
    peakTxPerSec: peak(wire.txSec),
    peakRxPerSec: peak(wire.rxSec),
    peakTxPlusRxPerSec: Math.max(0, ...[...wire.txSec.keys()].map((s) => (wire.txSec.get(s) ?? 0) + (wire.rxSec.get(s) ?? 0))),
    assumption: 'Supabase Free Realtime (assumed, verify in dashboard): 200 concurrent peers, 100 msgs/s, 2M msgs/month, 256KB payload; inbound+outbound both count as messages.',
  },
  errors: [...new Set(errors)].slice(0, 20),
  errorCount: errors.length,
  findings: { replayOfSignedFrameAccepted: replayAccepted, notes },
  violations,
  pass: violations.length === 0,
};

const dir = fileURLToPath(new URL('./reports/', import.meta.url));
mkdirSync(dir, { recursive: true });
const file = dir + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
writeFileSync(file, JSON.stringify(report, null, 2));

const f = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : '-');
console.log(`\nloadtest ${cfg.transport}/${cfg.host} players=${cfg.players} rooms=${cfg.rooms} mode=${cfg.mode} tick=${cfg.tick}ms (${secs.toFixed(0)}s)`);
console.table([
  { metric: 'call fan-out ms', n: fan.n, p50: f(fan.p50), p95: f(fan.p95), max: f(fan.max) },
  { metric: 'pick->result ms', n: pk.n, p50: f(pk.p50), p95: f(pk.p95), max: f(pk.max) },
]);
console.log(`calls: ${callsSeen}/${callsExpected} delivered (loss ${lossPct.toFixed(2)}%), dup ${dup}, out-of-order ${ooo}; picks unanswered ${picksSent - picksAnswered}/${picksSent}`);
console.log(`wire: tx ${wire.tx}, rx ${wire.rx}, peak tx/s ${report.wire.peakTxPerSec}, peak rx/s ${report.wire.peakRxPerSec}, peak tx+rx/s ${report.wire.peakTxPlusRxPerSec} (free tier assumed 100 msg/s)`);
for (const c of claimOutcomes) console.log(`claims ${c.room}: ${c.claims} (${c.valid} valid), winners=[${c.winners.join(',')}]`);
console.log(`errors: ${errors.length}${errors.length ? ' e.g. ' + report.errors[0] : ''}; signed-frame replay accepted: ${replayAccepted}`);
console.log(violations.length ? `INVARIANTS FAILED (${violations.length}):\n` + violations.slice(0, 15).map((v) => `  ${v.room} ${v.inv}: ${v.detail}`).join('\n') : 'invariants: PASS');
console.log('report: ' + file);
process.exit(violations.length ? 1 : 0);
