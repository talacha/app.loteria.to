import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { callableLangs, cards, getCard } from '@content';
import type { Card } from '@content';
import type { CardId, Lang } from '@engine';
import type { Msg, Transport } from '@net';
import { setMediaSession, speakCall, stopAudio } from '../audio';
import type { SpeakResult } from '../audio';
import { clearRound, saveRound } from './persist';
import {
  calledCards,
  currentCard,
  initialRound,
  langForCall,
  pickTablaIndex,
  roundReducer,
  toSaved,
  validatePaperCode,
  validateSeatClaim,
} from './roundMachine';
import type { PaperOutcome, RoundAction, RoundState, SavedRound, Settings } from './roundMachine';
import { lobbyMessage } from './useHostRoom';
import type { RosterPlayer } from './useHostRoom';

export interface GameRoom {
  code: string;
  seed: string;
  hostKey: string | null;
  roundNo?: number;
  settings?: Settings;
  /** Present when resuming a round in progress. */
  saved?: SavedRound | null;
  /** Membership/roster accessors from the room (flood control, removals). */
  isMember?: (seat: string) => boolean;
  getRoster?: () => RosterPlayer[];
  connection?: 'connecting' | 'online' | 'offline' | 'unverified';
}

export interface GameProps {
  transport: Transport | null;
  room: GameRoom;
  roster: RosterPlayer[];
  /** Called from the ended screen to return to the lobby for the next round. */
  onNewRound?: (roundNo: number) => void;
}

export interface ClaimNote {
  seat: string;
  valid: boolean;
  at: number;
}

const ROUND_RESEND_MS = 10_000;
const HELLO_COOLDOWN_MS = 2000;

const deck = cards.map((c) => ({ id: c.id, category: c.category }));
const ids = cards.map((c) => c.id);

function initialState(room: GameRoom): RoundState {
  const base = initialRound(room.code, room.seed, callableLangs());
  if (room.saved) return roundReducer(base, { type: 'restore', saved: room.saved, ids });
  let s: RoundState = { ...base, roundNo: room.roundNo ?? 1 };
  if (room.settings) s = roundReducer(s, { type: 'configure', patch: room.settings });
  return roundReducer(s, { type: 'start', ids, langs: callableLangs() });
}

/** Caller logic: round state, calls, claims, assignments, persistence. */
export function useGame({ transport, room, roster, onNewRound }: GameProps) {
  const [state, setStateRaw] = useState<RoundState>(() => initialState(room));
  const stateRef = useRef(state);
  const [names, setNames] = useState<Record<string, string>>({});
  const [noAudio, setNoAudio] = useState(false);
  const [claimNote, setClaimNote] = useState<ClaimNote | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [paperCode, setPaperCode] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState({ text: '', seq: 0 });
  const trRef = useRef(transport);
  const rosterRef = useRef(roster);
  const knownRef = useRef<Map<string, RosterPlayer>>(new Map());
  const lastHelloRef = useRef<Map<string, number>>(new Map());
  const hostKeyRef = useRef(room.hostKey);
  const bootRef = useRef<Transport | null>(null);
  const spokenRef = useRef(!!room.saved);

  useEffect(() => {
    trRef.current = transport;
    rosterRef.current = roster;
    hostKeyRef.current = room.hostKey;
    for (const p of roster) knownRef.current.set(p.seat, p);
  });

  const apply = useCallback((a: RoundAction): RoundState => {
    const ns = roundReducer(stateRef.current, a);
    stateRef.current = ns;
    setStateRaw(ns);
    return ns;
  }, []);

  const send = useCallback((m: Msg) => {
    try {
      trRef.current?.send(m);
    } catch {
      /* transport failures never block calling */
    }
  }, []);

  const roomRef = useRef(room);
  useEffect(() => {
    roomRef.current = room;
  });
  const players = useCallback((): RosterPlayer[] => {
    const get = roomRef.current.getRoster;
    return get ? get() : [...knownRef.current.values()];
  }, []);

  const sendLobby = useCallback(() => {
    send(lobbyMessage('started', players(), stateRef.current.roundNo, hostKeyRef.current));
  }, [players, send]);

  const sendRound = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === 'setup') return;
    send({
      t: 'round',
      seed: s.roomSeed,
      roundNo: s.roundNo,
      mode: s.settings.mode,
      pattern: s.settings.pattern,
      callLang: s.settings.callLang,
      speedSec: s.settings.speedSec,
      called: calledCards(s),
      ...(hostKeyRef.current ? { hostKey: hostKeyRef.current } : {}),
    });
  }, [send]);

  const ensureAssigned = useCallback(
    (seat: string): number => {
      const cur = stateRef.current.assignments[seat];
      if (cur !== undefined) return cur;
      const used = new Set(Object.values(stateRef.current.assignments));
      const index = pickTablaIndex(used);
      apply({ type: 'assign', seat, index });
      return index;
    },
    [apply],
  );

  const sendAssign = useCallback(
    (seat: string) => {
      send({
        t: 'assign',
        seat,
        tablaIndex: ensureAssigned(seat),
        roundNo: stateRef.current.roundNo,
      });
    },
    [ensureAssigned, send],
  );

  const assignAll = useCallback(() => {
    for (const p of players()) sendAssign(p.seat);
  }, [sendAssign, players]);

  const announce = useCallback(
    (s: RoundState, speak = true) => {
      const cardId = currentCard(s);
      const card = cardId ? getCard(cardId) : undefined;
      if (!card) return;
      const i = s.calledCount - 1;
      const lang = langForCall(s, i);
      send({ t: 'call', i, cardId: card.id, lang, at: Date.now() });
      if (!speak) return;
      const text = card.names[lang]?.text ?? card.names.es?.text ?? card.id;
      setAnnouncement((a) => ({ text, seq: a.seq + 1 }));
      setMediaSession(text, `Lotería · ${s.code}`, {
        pause: () => apply({ type: 'pause' }),
        play: () => apply({ type: 'resume' }),
      });
      void speakCall(card, lang).then((r: SpeakResult) => setNoAudio(r === 'no-audio'));
    },
    [apply, send],
  );

  const handleMessage = useCallback(
    (m: Msg) => {
      const s = stateRef.current;
      if (m.t === 'hello') {
        const p: RosterPlayer = {
          seat: m.seat,
          name: m.name,
          glyph: m.glyph,
          ...(m.pronouns ? { pronouns: m.pronouns } : {}),
        };
        if (roomRef.current.isMember && !roomRef.current.isMember(m.seat)) {
          sendLobby(); // flood control: removed or room full
          return;
        }
        knownRef.current.set(m.seat, p);
        setNames((n) => ({ ...n, [m.seat]: `${m.glyph} ${m.name}` }));
        const now = Date.now();
        const last = lastHelloRef.current.get(m.seat);
        if (last !== undefined && now - last < HELLO_COOLDOWN_MS) return;
        lastHelloRef.current.set(m.seat, now);
        // round first: unpinned (trust-on-first-use) players only accept a signed round with hostKey
        sendRound();
        sendLobby();
        sendAssign(m.seat);
      } else if (m.t === 'claim') {
        if (s.phase !== 'running' && s.phase !== 'paused') return;
        const out = validateSeatClaim(s, deck, m);
        send({
          t: 'claimResult',
          seat: m.seat,
          roundNo: s.roundNo,
          valid: out.valid,
          ...(out.valid ? {} : { missing: out.missing }),
        });
        const fresh = out.valid && !s.winners.includes(m.seat);
        if (fresh) {
          setClaimNote({ seat: m.seat, valid: true, at: Date.now() });
          setCelebrating(true);
          apply({ type: 'win', seat: m.seat });
        } else if (!out.valid) {
          setClaimNote({ seat: m.seat, valid: false, at: Date.now() });
        }
      }
    },
    [apply, send, sendAssign, sendLobby, sendRound],
  );

  // Subscribe to the room channel; bootstrap every new transport (lobby, round, assigns, call).
  useEffect(() => {
    if (!transport) return;
    const off = transport.onMessage(handleMessage);
    if (bootRef.current !== transport) {
      bootRef.current = transport;
      sendLobby();
      sendRound();
      assignAll();
      const s = stateRef.current;
      if (s.calledCount > 0 && s.phase === 'running') {
        const speak = !spokenRef.current;
        spokenRef.current = true;
        announce(s, speak);
      }
    }
    return off;
  }, [transport, handleMessage, sendLobby, sendRound, assignAll, announce]);

  // Fresh start without a transport yet: still speak the first call locally.
  useEffect(() => {
    if (!trRef.current && !spokenRef.current) {
      spokenRef.current = true;
      announce(stateRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => () => stopAudio(), []);

  useEffect(() => {
    const list = roomRef.current.getRoster?.() ?? roster;
    void saveRound({
      ...toSaved(state),
      roster: list.map((p) => ({
        ...p,
        ...(state.assignments[p.seat] !== undefined
          ? { tablaIndex: state.assignments[p.seat] }
          : {}),
      })),
    });
  }, [state, roster]);

  // Re-send round (and lobby) every 10 s so late joiners sync.
  const live = state.phase === 'running' || state.phase === 'paused';
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      sendRound();
      sendLobby();
    }, ROUND_RESEND_MS);
    return () => clearInterval(t);
  }, [live, sendRound, sendLobby]);

  // Auto-advance.
  const running = state.phase === 'running';
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => {
      const ns = apply({ type: 'next' });
      if (ns.phase === 'ended') send({ t: 'end', roundNo: ns.roundNo, winners: ns.winners });
      else announce(ns);
    }, state.settings.speedSec * 1000);
    return () => clearTimeout(t);
  }, [running, state.calledCount, state.settings.speedSec, apply, announce, send]);

  // Screen Wake Lock while running: one sentinel, released on pause/hidden/unmount.
  useEffect(() => {
    if (!running) return;
    type Sentinel = EventTarget & { release: () => Promise<void> };
    const wl = (
      navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }
    ).wakeLock;
    if (!wl) return;
    let sentinel: Sentinel | null = null;
    let pending = false;
    let cancelled = false;
    const acquire = () => {
      if (sentinel || pending || cancelled || document.visibilityState !== 'visible') return;
      pending = true;
      wl.request('screen')
        .then((s) => {
          if (cancelled || sentinel) {
            void s.release().catch(() => undefined);
            return;
          }
          sentinel = s;
          s.addEventListener('release', () => {
            if (sentinel === s) sentinel = null;
          });
        })
        .catch(() => undefined)
        .finally(() => {
          pending = false;
        });
    };
    const release = () => {
      const s = sentinel;
      sentinel = null;
      void s?.release().catch(() => undefined);
    };
    const vis = () => (document.visibilityState === 'visible' ? acquire() : release());
    acquire();
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', vis);
      release();
    };
  }, [running]);

  const next = useCallback(() => {
    const ns = apply({ type: 'next' });
    if (ns.phase === 'ended') send({ t: 'end', roundNo: ns.roundNo, winners: ns.winners });
    else announce(ns);
  }, [apply, announce, send]);

  const repeat = useCallback(() => {
    if (stateRef.current.calledCount > 0) announce(stateRef.current);
  }, [announce]);

  const togglePause = useCallback(() => {
    apply({ type: 'togglePause' });
  }, [apply]);

  const resumeCalling = useCallback(() => {
    setCelebrating(false);
    return apply({ type: 'resume' });
  }, [apply]);

  const endRound = useCallback(() => {
    const ns = apply({ type: 'end' });
    setCelebrating(false);
    stopAudio();
    send({ t: 'end', roundNo: ns.roundNo, winners: ns.winners });
  }, [apply, send]);

  const newRound = useCallback(() => {
    void clearRound();
    onNewRound?.(stateRef.current.roundNo + 1);
  }, [onNewRound]);

  const paper: PaperOutcome | null = useMemo(
    () => (paperCode === null ? null : validatePaperCode(state, deck, paperCode)),
    [paperCode, state],
  );

  const current: Card | undefined = (() => {
    const id = currentCard(state);
    return id ? getCard(id) : undefined;
  })();
  const called: CardId[] = calledCards(state);
  const currentLang: Lang | undefined =
    state.calledCount > 0 ? langForCall(state, state.calledCount - 1) : undefined;

  return {
    state,
    names,
    noAudio,
    claimNote,
    celebrating,
    paper,
    checkPaper: (code: string) => setPaperCode(code),
    clearPaper: () => setPaperCode(null),
    announcement,
    current,
    currentLang,
    called,
    next,
    repeat,
    togglePause,
    resumeCalling,
    endRound,
    newRound,
  };
}

export type Game = ReturnType<typeof useGame>;
