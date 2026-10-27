/**
 * Load-test CLI. Usage:
 *   pnpm exec tsx loadtest/run.ts --players 20 --rooms 3 --transport local --host headless
 * Flags: --players N --rooms R --transport supabase|local --mode normal|race --calls K
 *        --host headless|app --tick ms --delay min,max
 *        --wrong 0..1 --max-loss pct --timeout sec --no-adversary
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ROOM_MAX_PLAYERS,
  crossedAfterCall,
  initialPickState,
  isCardComplete,
  resolveFullCardWinners,
  scorePick,
  tabla,
} from '@engine';
import { generateHostKeys, signMsg } from '../src/net/crypto.ts';
import { PROTOCOL_VERSION } from '../src/net/session.ts';
import { Bot } from './bot.ts';
import { Wire, cardPool, loadEnv, sleep, stats, supabaseCreds } from './common.ts';
import { HeadlessHost } from './host-headless.ts';
import { makeTransport, type Net } from './transports.ts';

if (process.argv.includes('--help')) {
  console.log(`Usage: pnpm tsx loadtest/run.ts [options]
  --players N        players per room, 2..20 (default 20)
  --rooms R          concurrent rooms (default 3)
  --transport KIND   local or supabase (default local)
  --host KIND        headless or app (default headless; app requires supabase)
  --mode MODE        normal or race (default normal)
  --calls K          maximum calls, 1..catalog size (default whole catalog; truncation fails if no full card)
  --tick MS          accelerated headless call window (default local 1500, supabase 3000)
  --delay MIN,MAX    pick delay in ms (default derived from tick)
  --wrong RATE       wrong-first-pick probability, 0..1 (default 0.1)
  --max-loss PCT     allowed call delivery loss (default 0)
  --timeout SEC      room timeout (default calls*tick + 40 seconds)
  --no-adversary     skip forged-frame and signed-frame replay probes
Reports use the real transports/signatures. Headless timing is accelerated; it is not a browser/UI or Supabase quota certification.`);
  process.exit(0);
}
loadEnv();

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? (process.argv[i + 1] ?? 'true') : def;
}
const flag = (n: string) => process.argv.includes('--' + n);

const pool = cardPool();
const cfg = {
  players: Number(arg('players', '20')),
  rooms: Number(arg('rooms', '3')),
  transport: arg('transport', 'local') as 'local' | 'supabase',
  mode: arg('mode', 'normal') as 'normal' | 'race',
  calls: Number(arg('calls', String(pool.length))),
  host: arg('host', 'headless') as 'headless' | 'app',
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

const invalid = (message: string): never => {
  console.error(message + ' (see --help)');
  process.exit(2);
};
if (!Number.isInteger(cfg.players) || cfg.players < 2 || cfg.players > ROOM_MAX_PLAYERS)
  invalid('players must be an integer from 2 to ' + ROOM_MAX_PLAYERS);
if (!Number.isInteger(cfg.rooms) || cfg.rooms < 1) invalid('rooms must be a positive integer');
if (!['local', 'supabase'].includes(cfg.transport)) invalid('unknown transport');
if (!['headless', 'app'].includes(cfg.host)) invalid('unknown host');
if (!['normal', 'race'].includes(cfg.mode)) invalid('unknown mode');
if (cfg.host === 'app' && cfg.transport !== 'supabase')
  invalid('app host requires supabase: Node and browser BroadcastChannels do not share a process');
if (!Number.isInteger(cfg.calls) || cfg.calls < 1 || cfg.calls > pool.length)
  invalid('calls must be 1..' + pool.length);
if (!Number.isFinite(cfg.tick) || cfg.tick <= 0) invalid('tick must be positive');
if (!Number.isFinite(cfg.wrong) || cfg.wrong < 0 || cfg.wrong > 1) invalid('wrong must be 0..1');
if (!Number.isFinite(cfg.maxLoss) || cfg.maxLoss < 0 || cfg.maxLoss > 100)
  invalid('max-loss must be 0..100');
if (!Number.isFinite(cfg.timeout) || cfg.timeout < 0) invalid('timeout must be nonnegative');
if (arg('delay') && (cfg.delay.length !== 2 || cfg.delay.some((n) => !Number.isFinite(n))))
  invalid('delay must be MIN,MAX');
if (dMin < 0 || dMax < dMin || dMax >= cfg.tick) invalid('delay must fit within the call window');
if (flag('pattern')) invalid('patterns were removed; rounds finish on a full card');

const net: Net = { kind: cfg.transport };
if (cfg.transport === 'supabase') {
  const c = supabaseCreds();
  if (!c) {
    console.error(
      'Supabase credentials not found (VITE_SUPABASE_URL/_ANON_KEY or NEXT_PUBLIC_SUPABASE_*).',
    );
    process.exit(2);
  }
  net.url = c.url;
  net.key = c.key;
}

const wire = new Wire();
const roomCode = () => 'LT' + Math.random().toString(36).slice(2, 5).toUpperCase();

interface Violation {
  room: string;
  inv: string;
  detail: string;
}
const violations: Violation[] = [];
const violate = (room: string, inv: string, detail: string) =>
  violations.push({ room, inv, detail });
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
let replayAccepted = 0;
let replayChecks = 0;
const roundOutcomes: {
  room: string;
  winners: string[];
  expected: string[];
  closedCalls: number;
  completedSeats: string[];
}[] = [];
let firstDupMsgs = 0;
let callsWithCorrect = 0;

async function adversary(
  code: string,
  hostKey: string,
  host: HeadlessHost,
  bots: Bot[],
  room: string,
) {
  const tx = makeTransport(net, 'attacker', new Wire(), true);
  await tx.join(code, 'player', { hostKey });
  while (host.calls.length < Math.min(2, cfg.calls) && !host.endMsg) await sleep(100);
  const att = await generateHostKeys();
  const sign = (envelope: unknown) => signMsg(att.priv, envelope);
  const forgedCall = {
    t: 'call',
    i: 900,
    cardId: pool[0]!.id,
    choices: [pool[0]!.id, pool[1]!.id, pool[2]!.id],
    at: Date.now(),
  };
  const forgedEnd = { t: 'end', roundNo: 777, winners: ['attacker'], reason: 'full-card' };
  const forgedPR = {
    t: 'pickResult',
    roundNo: 777,
    i: 0,
    seat: bots[0]!.seat,
    correct: true,
    points: 2,
    first: true,
  };
  const forgedRound = {
    t: 'round',
    seed: 'x',
    roundNo: 777,
    speedSec: 3,
    hostKey: att.pub,
  };
  const inj: unknown[] = [];
  for (const m of [forgedCall, forgedEnd, forgedPR, forgedRound]) {
    const envelope = { v: PROTOCOL_VERSION, seq: 1_000_000, m };
    inj.push({ role: 'host', from: 'host', ...envelope }); // unsigned
    inj.push({ role: 'host', from: 'host', ...envelope, sig: 'AAAA' }); // garbage sig
    inj.push({ role: 'host', from: 'host', ...envelope, sig: await sign(envelope) }); // wrong key
    inj.push({ role: 'player', from: 'attacker', ...envelope, sig: await sign(envelope) }); // wrong role
  }
  // Spoofed pick: claims to be another seat.
  inj.push({
    role: 'player',
    from: 'attacker',
    m: {
      t: 'pick',
      seat: bots[1]!.seat,
      roundNo: host.roundNo,
      i: host.calls.length - 1,
      cardId: '__spoof__',
    },
  });
  for (const f of inj) await tx.inject(f);
  // Replay of a genuinely signed host frame (call) seen on the wire.
  const before = bots.reduce((a, b) => a + b.dupCalls, 0);
  const legit = (tx.frames as { role?: string; m?: { t?: string } }[]).find(
    (f) => f.role === 'host' && f.m?.t === 'call',
  );
  if (legit) {
    await tx.inject(legit);
    await sleep(1500);
    const after = bots.reduce((a, b) => a + b.dupCalls, 0);
    replayChecks++;
    const accepted = after - before;
    replayAccepted += accepted;
    if (accepted)
      violate(room, 'signed-replay-accepted', `${accepted} players accepted the replay`);
  } else violate(room, 'replay-probe', 'no signed host call captured');
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
    host = new HeadlessHost({
      code,
      tx: htx,
      pool,
      tickMs: cfg.tick,
      maxCalls: cfg.calls,
    });
    hostKey = await host.start();
  }
  const bots: Bot[] = [];
  for (let k = 0; k < cfg.players; k++) {
    const seat = `${room}-b${String(k).padStart(2, '0')}`;
    bots.push(
      new Bot({
        seat,
        code: useCode,
        hostKey,
        tx: makeTransport(net, seat, rw),
        mode: cfg.mode,
        delayMin: dMin,
        delayMax: dMax,
        wrongRate: cfg.wrong,
      }),
    );
  }
  for (let k = 0; k < bots.length; k += 20) {
    await Promise.all(bots.slice(k, k + 20).map((b) => b.start()));
  }
  const t0 = Date.now();
  while (
    Date.now() - t0 < 20000 &&
    (host
      ? host.players.size < cfg.players
      : !bots.every((b) => b.assigned) && Date.now() - t0 < 3000)
  )
    await sleep(100);
  if (host && host.players.size < cfg.players)
    violate(room, 'join', `only ${host.players.size}/${cfg.players} hellos reached the host`);
  await sleep(500);

  const limit = (cfg.timeout || (cfg.calls * cfg.tick) / 1000 + 40) * 1000;
  if (host) {
    host.begin();
    const adv = cfg.adversary
      ? adversary(useCode, hostKey, host, bots, room).catch((e) =>
          notes.push('adversary error ' + e),
        )
      : Promise.resolve();
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
  for (const b of bots) {
    if (!b.assigned || !b.tbl) violate(room, 'assignment', b.seat);
    if (!b.end) violate(room, 'end-loss', b.seat);
    const expected = b.tbl
      ? crossedAfterCall(
          b.tbl,
          [...b.closed].flatMap((i) => b.calls.get(i)?.cardId ?? []),
        )
      : [];
    if (expected.slice().sort().join() !== b.crossed.slice().sort().join())
      violate(room, 'crossed-vs-closed', b.seat);
  }
  const ends = new Set(bots.filter((b) => b.end).map((b) => [...b.end!.winners].sort().join(',')));
  if (ends.size > 1) violate(room, 'winners-agree', [...ends].join(' | '));
}

function check(room: string, host: HeadlessHost, bots: Bot[]) {
  collect(bots);
  const nCalls = host.calls.length;
  callsExpected += nCalls * bots.length;
  latePicks += host.pickLog.filter((p) => !p.accepted).length;

  // I3: every bot sees every call
  const lossPct = nCalls
    ? (100 *
        bots.reduce(
          (a, b) => a + (nCalls - [...b.calls.keys()].filter((i) => i < nCalls).length),
          0,
        )) /
      (nCalls * bots.length)
    : 0;
  if (lossPct > cfg.maxLoss) violate(room, 'call-loss', `${lossPct.toFixed(2)}% > ${cfg.maxLoss}%`);

  // I1: exactly one first-correct per call that has a correct accepted pick
  for (const c of host.calls) {
    const correct = host.results.filter((r) => r.i === c.i && r.correct);
    if (!correct.length) continue;
    callsWithCorrect++;
    const firstSeats = new Set(
      host.results.filter((r) => r.i === c.i && r.first).map((r) => r.seat),
    );
    if (firstSeats.size !== 1)
      violate(room, 'one-first', `call ${c.i}: ${firstSeats.size} first seats`);
    const msgs = host.results.filter((r) => r.i === c.i && r.first).length;
    if (msgs > 1) firstDupMsgs++;
    for (const b of bots) {
      const seen = b.firstSeen.get(c.i) ?? [];
      if (seen.length > 1 || (seen.length === 1 && !firstSeats.has(seen[0]!)))
        violate(room, 'one-first-observed', `${b.seat} call ${c.i} saw ${seen.join('+')}`);
    }
  }

  // I2: every called card crosses on close, regardless of picks.
  for (const b of bots) {
    if (!b.assigned || !b.tbl) violate(room, 'assignment', b.seat);
    const idx = host.players.get(b.seat);
    const expected =
      idx === undefined ? [] : crossedAfterCall(tabla(host.seed, idx, pool), host.closed);
    if (expected.slice().sort().join() !== b.crossed.slice().sort().join())
      violate(room, 'crossed-vs-host', `${b.seat} host=${expected.length} bot=${b.crossed.length}`);
    if (b.closed.size !== host.closed.length)
      violate(room, 'close-loss', `${b.seat}: ${b.closed.size}/${host.closed.length}`);
    if ((b.crossedCounts[b.seat] ?? -1) !== expected.length) violate(room, 'crossed-score', b.seat);
    if ((b.scores[b.seat] ?? 0) !== (host.state.points[b.seat] ?? 0))
      violate(room, 'points-observed', b.seat);
  }

  // I4: independent replay of points + winners
  let st = initialPickState();
  for (const p of host.pickLog.filter((x) => x.accepted)) {
    const call = host.calls[p.i]!;
    st = scorePick(st, { seat: p.seat, i: p.i, cardId: p.cardId, at: p.order }, call).state;
  }
  const hostPts = JSON.stringify(Object.entries(host.state.points).sort());
  if (hostPts !== JSON.stringify(Object.entries(st.points).sort()))
    violate(room, 'points-replay', 'host points != replay');
  const completed = [...host.players]
    .filter(([, idx]) => {
      const board = tabla(host.seed, idx, pool);
      return isCardComplete(board, crossedAfterCall(board, host.closed));
    })
    .map(([seat]) => seat);
  const exp = resolveFullCardWinners(completed, st.points).sort();
  const winners = [...(host.endMsg?.winners ?? [])].sort();
  if (!host.endMsg) violate(room, 'missing-end', 'no full-card end before call limit or timeout');
  if (!completed.length) violate(room, 'full-card', 'no completed tabla');
  if (exp.join() !== winners.join()) violate(room, 'winners', `expected ${exp} got ${winners}`);
  // The host must stop on the first completion, not a later call.
  if (
    [...host.players].some(([, idx]) => {
      const board = tabla(host.seed, idx, pool);
      return isCardComplete(board, crossedAfterCall(board, host.closed.slice(0, -1)));
    })
  )
    violate(room, 'first-completion', 'a tabla was already complete before the final call');
  const got = (host.endMsg?.winners ?? []).slice().sort().join();
  const withEnd = bots.filter((b) => b.end);
  for (const b of withEnd)
    if ([...b.end!.winners].sort().join() !== got) violate(room, 'winners-observed', b.seat);
  if (host.endMsg && withEnd.length < bots.length)
    violate(room, 'end-loss', `${bots.length - withEnd.length} bots never saw end`);
  roundOutcomes.push({
    room,
    winners: host.endMsg?.winners ?? [],
    expected: host.expectedWinners,
    closedCalls: host.closed.length,
    completedSeats: completed,
  });

  // I5: adversary
  for (const b of bots)
    if (b.forgedSeen)
      violate(
        room,
        'unsigned-accepted',
        `${b.seat} accepted ${b.forgedSeen} forged host-only msgs`,
      );
  if (host.pickLog.some((p) => p.cardId === '__spoof__'))
    violate(room, 'spoofed-pick-accepted', 'host accepted pick with from != seat');
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
  pickToResultMs: {
    ...pk,
    unanswered: picksSent - picksAnswered,
    sent: picksSent,
    latePicksRejected: latePicks,
  },
  calls: {
    expectedDeliveries: callsExpected,
    seen: callsSeen,
    lossPct: +lossPct.toFixed(3),
    duplicates: dup,
    outOfOrder: ooo,
    callsWithCorrectPick: callsWithCorrect,
    callsWithRepeatedFirstTrue: firstDupMsgs,
  },
  rounds: roundOutcomes,
  wire: {
    txFrames: wire.tx,
    rxFrames: wire.rx,
    txKB: Math.round(wire.txBytes / 1024),
    avgTxPerSec: +(wire.tx / secs).toFixed(1),
    peakTxPerSec: peak(wire.txSec),
    peakRxPerSec: peak(wire.rxSec),
    peakTxPlusRxPerSec: Math.max(
      0,
      ...[...new Set([...wire.txSec.keys(), ...wire.rxSec.keys()])].map(
        (s) => (wire.txSec.get(s) ?? 0) + (wire.rxSec.get(s) ?? 0),
      ),
    ),
    assumption:
      'Supabase Free Realtime (assumed, verify in dashboard): 200 concurrent peers, 100 msgs/s, 2M msgs/month, 256KB payload; inbound+outbound both count as messages.',
  },
  errors: [...new Set(errors)].slice(0, 20),
  errorCount: errors.length,
  findings: {
    replayOfSignedFrameAccepted: replayAccepted,
    replayChecksPerformed: replayChecks,
    notes,
  },
  violations,
  pass: violations.length === 0 && errors.length === 0,
};

const dir = fileURLToPath(new URL('./reports/', import.meta.url));
mkdirSync(dir, { recursive: true });
const file = dir + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
writeFileSync(file, JSON.stringify(report, null, 2));

const f = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : '-');
console.log(
  `\nloadtest ${cfg.transport}/${cfg.host} players=${cfg.players} rooms=${cfg.rooms} mode=${cfg.mode} tick=${cfg.tick}ms (${secs.toFixed(0)}s)`,
);
console.table([
  { metric: 'call fan-out ms', n: fan.n, p50: f(fan.p50), p95: f(fan.p95), max: f(fan.max) },
  { metric: 'pick->result ms', n: pk.n, p50: f(pk.p50), p95: f(pk.p95), max: f(pk.max) },
]);
console.log(
  `calls: ${callsSeen}/${callsExpected} delivered (loss ${lossPct.toFixed(2)}%), dup ${dup}, out-of-order ${ooo}; picks unanswered ${picksSent - picksAnswered}/${picksSent}`,
);
console.log(
  `wire: tx ${wire.tx}, rx ${wire.rx}, peak tx/s ${report.wire.peakTxPerSec}, peak rx/s ${report.wire.peakRxPerSec}, peak tx+rx/s ${report.wire.peakTxPlusRxPerSec} (free tier assumed 100 msg/s)`,
);
for (const c of roundOutcomes)
  console.log(
    `round ${c.room}: ${c.closedCalls} calls closed, ${c.completedSeats.length} completed, winners=[${c.winners.join(',')}]`,
  );
console.log(
  `errors: ${errors.length}${errors.length ? ' e.g. ' + report.errors[0] : ''}; signed-frame replay accepted: ${replayAccepted}`,
);
console.log(
  violations.length
    ? `INVARIANTS FAILED (${violations.length}):\n` +
        violations
          .slice(0, 15)
          .map((v) => `  ${v.room} ${v.inv}: ${v.detail}`)
          .join('\n')
    : 'invariants: PASS',
);
console.log('report: ' + file);
process.exit(report.pass ? 0 : 1);
