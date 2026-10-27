import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { callableLangs } from '@content';
import { ROOM_MAX_PLAYERS, ROOM_MIN_PLAYERS, roomCode } from '@engine';
import { createTransport, generateHostKeyPair, getSeat } from '@net';
import { useTranslation } from 'react-i18next';
import { useProfile } from '../ui';
import { readRawProfile, storedProfile } from '../ui/profile';
import type { Msg, Transport } from '@net';
import type { Lang } from '@engine';
import { newSeed, normalizePrintSeed } from '@print/options';
import { clearRound, loadKeyPair, loadRound, saveKeyPair, saveRound } from './persist';
import { DEFAULT_SETTINGS, clampSpeed } from './roundMachine';
import type { SavedRound, Settings } from './roundMachine';

export type Connection = 'connecting' | 'online' | 'offline' | 'unverified';
export type HostPhase = 'boot' | 'prompt' | 'lobby' | 'game';
export interface RosterPlayer {
  seat: string;
  name: string;
  glyph: string;
  pronouns?: string;
}

const REGISTER_TIMEOUT_MS = 1500;
const REREGISTER_MS = 15_000;
export const LOBBY_DEBOUNCE_MS = 300;
export const LOBBY_RESEND_MS = 10_000;
// Transports report presence as a seat list only (an explicit leave and an expiry look the same),
// so a short grace plus a fast sweep keeps leavers from lingering.
export const LEAVE_GRACE_MS = 4000;
const SWEEP_MS = 500;
const HELLO_LIMIT_MS = 2000;
/** Seat of the organiser when the host screen also plays ("Jugar también"). Never a network seat. */
export const LOCAL_SEAT = 'host-local';
export const MAX_PLAYERS = ROOM_MAX_PLAYERS;
export const MIN_PLAYERS = ROOM_MIN_PLAYERS;

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REGISTER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** A 409 counts as success when the registered key is ours (resume, retry). */
export async function registerRoom(
  code: string,
  hostKey: string,
): Promise<'ok' | 'taken' | 'failed'> {
  try {
    const res = await timedFetch('/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, hostKey }),
    });
    if (res.ok) return 'ok';
    if (res.status !== 409) return 'failed';
    const got = await timedFetch(`/api/rooms/${encodeURIComponent(code)}`);
    if (!got.ok) return 'taken';
    const body = (await got.json()) as { hostKey?: string };
    return body.hostKey === hostKey ? 'ok' : 'taken';
  } catch {
    return 'failed';
  }
}

export function lobbyMessage(
  status: 'waiting' | 'started' | 'full',
  players: RosterPlayer[],
  roundNo?: number,
  hostKey?: string | null,
  defaults?: { spokenLang: Lang; uiLang: 'es' | 'en' },
): Msg {
  return {
    t: 'lobby',
    status,
    players: players.slice(0, MAX_PLAYERS).map((p) => ({
      seat: p.seat,
      name: p.name,
      glyph: p.glyph,
      ...(p.pronouns ? { pronouns: p.pronouns } : {}),
    })),
    ...(roundNo !== undefined ? { roundNo } : {}),
    ...(hostKey ? { hostKey } : {}),
    ...(defaults ? { defaults } : {}),
  };
}

export const defaultsOf = (s: {
  defaultSpokenLang: Lang;
  defaultUiLang: 'es' | 'en';
}): { spokenLang: Lang; uiLang: 'es' | 'en' } => ({
  spokenLang: s.defaultSpokenLang,
  uiLang: s.defaultUiLang,
});

/** Room session for the host: code, key, transport, registration, roster. */
export function useHostRoom() {
  const { t } = useTranslation();
  const profile = useProfile();
  const [phase, setPhase] = useState<HostPhase>('boot');
  const [code, setCode] = useState(() => roomCode());
  const [seed, setSeed] = useState(() => newSeed());
  const [roundNo, setRoundNo] = useState(1);
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    defaultSpokenLang: storedProfile().spokenLang,
    defaultUiLang: storedProfile().uiLang,
  }));
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  });
  const [saved, setSaved] = useState<SavedRound | null>(null);
  const [gameSaved, setGameSaved] = useState<SavedRound | null>(null);
  const [transport, setTransport] = useState<Transport | null>(null);
  const [hostKey, setHostKey] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [labels, setLabels] = useState<Record<string, Lang>>({});

  const transportRef = useRef<Transport | null>(null);
  const hostKeyRef = useRef<string | null>(null);
  const codeRef = useRef(code);
  const tokenRef = useRef(0);
  const rosterRef = useRef<RosterPlayer[]>([]);
  const presenceRef = useRef<Set<string> | null>(null);
  const missingRef = useRef<Map<string, number>>(new Map());
  const phaseRef = useRef<HostPhase>('boot');
  const roundRef = useRef(1);
  const bannedRef = useRef<Set<string>>(new Set());
  const lastHelloRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    roundRef.current = roundNo;
  }, [roundNo]);

  const updateRoster = useCallback((next: RosterPlayer[]) => {
    rosterRef.current = next;
    setRoster(next);
  }, []);

  const sendLobbyNow = useCallback(() => {
    // The 21st hello while in the lobby; the game sends its own.
    if (phaseRef.current !== 'lobby') return;
    transportRef.current?.send(
      lobbyMessage(
        'full',
        rosterRef.current,
        undefined,
        hostKeyRef.current,
        defaultsOf(settingsRef.current),
      ),
    );
  }, []);

  const onHello = useCallback(
    (m: Extract<Msg, { t: 'hello' }>) => {
      if (bannedRef.current.has(m.seat)) return;
      const now = Date.now();
      const last = lastHelloRef.current.get(m.seat);
      if (last !== undefined && now - last < HELLO_LIMIT_MS) return;
      lastHelloRef.current.set(m.seat, now);
      missingRef.current.delete(m.seat);
      setLabels((l) => (l[m.seat] === m.labelLang ? l : { ...l, [m.seat]: m.labelLang }));
      const p: RosterPlayer = {
        seat: m.seat,
        name: m.name,
        glyph: m.glyph,
        ...(m.pronouns ? { pronouns: m.pronouns } : {}),
      };
      const cur = rosterRef.current;
      const i = cur.findIndex((x) => x.seat === m.seat);
      if (i === -1) {
        if (cur.length >= MAX_PLAYERS) {
          sendLobbyNow();
          return;
        }
        updateRoster([...cur, p]);
      } else if (
        cur[i]!.name !== p.name ||
        cur[i]!.glyph !== p.glyph ||
        cur[i]!.pronouns !== p.pronouns
      ) {
        updateRoster(cur.map((x, j) => (j === i ? p : x)));
      }
    },
    [updateRoster, sendLobbyNow],
  );

  const isMember = useCallback(
    (seat: string) => rosterRef.current.some((p) => p.seat === seat),
    [],
  );
  const getRoster = useCallback(() => rosterRef.current, []);

  const removePlayer = useCallback(
    (seat: string) => {
      bannedRef.current.add(seat);
      missingRef.current.delete(seat);
      updateRoster(rosterRef.current.filter((p) => p.seat !== seat));
    },
    [updateRoster],
  );

  const onPresence = useCallback((seats: string[]) => {
    const set = new Set(seats);
    presenceRef.current = set;
    const now = Date.now();
    for (const p of rosterRef.current) {
      if (p.seat === LOCAL_SEAT) continue;
      if (set.has(p.seat)) missingRef.current.delete(p.seat);
      else if (!missingRef.current.has(p.seat)) missingRef.current.set(p.seat, now);
    }
  }, []);

  // Drop seats that left presence for more than 10 s.
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      const gone = [...missingRef.current].filter(([, at]) => now - at > LEAVE_GRACE_MS);
      if (gone.length === 0) return;
      const drop = new Set(gone.map(([s]) => s));
      for (const s of drop) missingRef.current.delete(s);
      updateRoster(rosterRef.current.filter((p) => !drop.has(p.seat)));
    }, SWEEP_MS);
    return () => clearInterval(t);
  }, [updateRoster]);

  const connect = useCallback(
    async (initial: string, retryOnTaken: boolean): Promise<void> => {
      const token = ++tokenRef.current;
      const stale = () => token !== tokenRef.current;
      let c = initial;
      for (let attempt = 0; attempt < 4; attempt++) {
        const tr = createTransport({ seat: getSeat(c, 'host') });
        let keyPair = await loadKeyPair(c);
        if (stale()) return;
        if (!keyPair) {
          try {
            keyPair = await generateHostKeyPair();
            void saveKeyPair(c, keyPair);
          } catch {
            keyPair = null;
          }
        }
        try {
          await tr.join(c, 'host', keyPair ? { keyPair } : undefined);
        } catch {
          if (!stale()) setConnection('offline');
          return;
        }
        if (stale()) {
          void tr.leave().catch(() => undefined);
          return;
        }
        transportRef.current = tr;
        setTransport(tr);
        tr.onMessage((m) => {
          if (m.t === 'hello') onHello(m);
        });
        tr.onPresence(onPresence);
        tr.onError?.(() => setConnection('offline'));
        const key = await Promise.resolve(tr.hostPublicKey?.()).then(
          (k) => k ?? '',
          () => '',
        );
        if (stale()) return;
        hostKeyRef.current = key || null;
        setHostKey(key || null);
        codeRef.current = c;
        const r = key ? await registerRoom(c, key) : 'failed';
        if (stale()) return;
        if (r === 'taken' && retryOnTaken && attempt < 3) {
          await tr.leave().catch(() => undefined);
          transportRef.current = null;
          setTransport(null);
          c = roomCode();
          setCode(c);
          continue;
        }
        setConnection(r === 'ok' ? 'online' : 'unverified');
        return;
      }
    },
    [onHello, onPresence],
  );

  // Boot: offer to resume, otherwise create the room right away.
  useEffect(() => {
    let alive = true;
    const tokens = tokenRef;
    void loadRound().then((v) => {
      if (!alive) return;
      if (v && v.phase !== 'ended') {
        setSaved(v);
        setPhase('prompt');
      } else {
        setPhase('lobby');
        void connect(codeRef.current, true);
      }
    });
    return () => {
      alive = false;
      tokens.current++;
      const tr = transportRef.current;
      transportRef.current = null;
      void tr?.leave().catch(() => undefined);
    };
  }, [connect]);

  const register = useCallback(async (): Promise<void> => {
    const key = hostKeyRef.current;
    if (!key) return;
    const r = await registerRoom(codeRef.current, key);
    if (r === 'ok') setConnection((c) => (c === 'offline' ? c : 'online'));
  }, []);
  useEffect(() => {
    const on = () => {
      setConnection((c) => (c === 'offline' ? 'unverified' : c));
      void register();
    };
    const off = () => setConnection('offline');
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [register]);
  useEffect(() => {
    if (connection !== 'unverified') return;
    const t = setInterval(() => void register(), REREGISTER_MS);
    return () => clearInterval(t);
  }, [connection, register]);

  // Lobby broadcasts: debounced on roster change, and every 10 s.
  const inLobby = phase === 'lobby';
  const sendWaiting = useCallback(() => {
    transportRef.current?.send(
      lobbyMessage(
        'waiting',
        rosterRef.current,
        undefined,
        hostKeyRef.current,
        defaultsOf(settingsRef.current),
      ),
    );
  }, []);
  useEffect(() => {
    if (!inLobby || !transport) return;
    const t = setTimeout(sendWaiting, LOBBY_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [inLobby, transport, roster, sendWaiting]);
  useEffect(() => {
    if (!inLobby || !transport) return;
    const t = setInterval(sendWaiting, LOBBY_RESEND_MS);
    return () => clearInterval(t);
  }, [inLobby, transport, sendWaiting]);

  // Persist the lobby so a reload can offer "Reanudar partida" there too.
  useEffect(() => {
    if (!inLobby) return;
    void saveRound({
      code,
      roomSeed: seed,
      roundNo,
      calledCount: 0,
      settings,
      winners: [],
      langs: callableLangs(),
      phase: 'setup',
      assignments: {},
      roster,
    });
  }, [inLobby, code, seed, roundNo, settings, roster]);

  const configure = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const n = { ...s, ...patch };
      n.speedSec = clampSpeed(n.speedSec);
      return n;
    });
  }, []);

  // "Jugar también": the organiser's own seat (name and glyph from the shared profile).
  const raw = readRawProfile();
  const localName =
    typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim().slice(0, 40)
      : t('host.lobby.you');
  const localGlyph = typeof raw.glyph === 'string' && raw.glyph ? raw.glyph.slice(0, 16) : '🌽';
  const spokenLang = profile.spokenLang;
  const hostPlays = settings.hostPlays;
  useEffect(() => {
    const rest = rosterRef.current.filter((p) => p.seat !== LOCAL_SEAT);
    const mine = rosterRef.current.find((p) => p.seat === LOCAL_SEAT);
    if (!hostPlays) {
      if (mine) updateRoster(rest);
      return;
    }
    if (mine && mine.name === localName && mine.glyph === localGlyph) return;
    updateRoster([{ seat: LOCAL_SEAT, name: localName, glyph: localGlyph }, ...rest]);
  }, [hostPlays, localName, localGlyph, updateRoster]);
  const local = useMemo(
    () => (hostPlays ? { seat: LOCAL_SEAT, name: localName, glyph: localGlyph, spokenLang } : null),
    [hostPlays, localName, localGlyph, spokenLang],
  );

  const setPrintSeed = useCallback((raw: string): boolean => {
    const s = normalizePrintSeed(raw);
    if (!s) return false;
    setSeed(s);
    return true;
  }, []);
  const randomSeed = useCallback(() => setSeed(newSeed()), []);

  const startGame = useCallback(() => {
    if (rosterRef.current.length < ROOM_MIN_PLAYERS) return;
    setGameSaved(null);
    setPhase('game');
  }, []);

  const backToLobby = useCallback((nextRound: number) => {
    setRoundNo(nextRound);
    setGameSaved(null);
    setPhase('lobby');
  }, []);

  const resume = useCallback(() => {
    if (!saved) return;
    setCode(saved.code);
    codeRef.current = saved.code;
    setSeed(saved.roomSeed);
    setRoundNo(saved.roundNo);
    setSettings({ ...DEFAULT_SETTINGS, ...saved.settings });
    const restored: RosterPlayer[] = (saved.roster ?? [])
      .filter((p) => p.seat !== LOCAL_SEAT)
      .map((p) => ({
        seat: p.seat,
        name: p.name,
        glyph: p.glyph,
        ...(p.pronouns ? { pronouns: p.pronouns } : {}),
      }));
    updateRoster(restored);
    // Seats that never come back are dropped once the grace period passes.
    const now = Date.now();
    for (const p of restored) missingRef.current.set(p.seat, now);
    if (saved.phase === 'setup') {
      setPhase('lobby');
    } else {
      setGameSaved(saved);
      setPhase('game');
    }
    setSaved(null);
    void connect(saved.code, false);
  }, [saved, connect, updateRoster]);

  const discard = useCallback(() => {
    void clearRound();
    setSaved(null);
    setPhase('lobby');
    void connect(codeRef.current, true);
  }, [connect]);

  /** Languages of the people in the room (label language chosen on join). */
  const langs = useMemo(() => {
    const out: Lang[] = [];
    for (const p of roster) {
      const l = labels[p.seat];
      if (l && !out.includes(l)) out.push(l);
    }
    return out;
  }, [roster, labels]);

  const joinUrl = useMemo(() => {
    const base = `${window.location.origin}/r/${code}`;
    return hostKey ? `${base}#k=${hostKey}` : base;
  }, [code, hostKey]);

  return {
    phase,
    saved,
    gameSaved,
    code,
    seed,
    roundNo,
    settings,
    transport,
    hostKey,
    connection,
    roster,
    local,
    canStart: roster.length >= ROOM_MIN_PLAYERS,
    missing: Math.max(0, ROOM_MIN_PLAYERS - roster.length),
    full: roster.length >= ROOM_MAX_PLAYERS,
    joinUrl,
    langs,
    isMember,
    getRoster,
    removePlayer,
    configure,
    setPrintSeed,
    randomSeed,
    startGame,
    backToLobby,
    resume,
    discard,
  };
}

export type HostRoom = ReturnType<typeof useHostRoom>;
