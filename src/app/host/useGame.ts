import { useCallback, useEffect, useRef, useState } from 'react';
import { callableLangs, cards, getCard, isAvoidedPair } from '@content';
import type { Card } from '@content';
import {
  ROOM_MAX_PLAYERS,
  choicesFor,
  pickTablaIndex,
  initialPickState,
  isCardComplete,
  resolveFullCardWinners,
  scorePick,
  tabla,
} from '@engine';
import type { CardId, Lang, PickState } from '@engine';
import type { Msg, Transport } from '@net';
import { setMediaSession, speakCall, stopAudio } from '../audio';
import type { SpeakResult } from '../audio';
import { clearRound, saveRound } from './persist';
import {
  calledCards,
  clampSpeed,
  currentCard,
  initialRound,
  langForCall,
  roundReducer,
  toSaved,
} from './roundMachine';
import type { RoundAction, RoundState, SavedRound, Settings } from './roundMachine';
import type { LeaderboardEntry } from '../ui';
import { LOCAL_SEAT, defaultsOf, lobbyMessage } from './useHostRoom';
import type { RosterPlayer } from './useHostRoom';

export interface GameRoom {
  code: string;
  seed: string;
  hostKey: string | null;
  joinUrl?: string;
  /** Languages of the people in the room (for distractor fairness and word cards). */
  langs?: Lang[];
  roundNo?: number;
  settings?: Settings;
  /** Present when resuming a round in progress. */
  saved?: SavedRound | null;
  /** Membership/roster accessors from the room (flood control, removals). */
  isMember?: (seat: string) => boolean;
  getRoster?: () => RosterPlayer[];
  /** Present in "Jugar también": the organiser's own seat, which plays on this screen. */
  local?: { seat: string; name: string; glyph: string; spokenLang: Lang } | null;
  connection?: 'connecting' | 'online' | 'offline' | 'unverified';
}

export interface GameProps {
  transport: Transport | null;
  room: GameRoom;
  roster: RosterPlayer[];
  /** Called from the ended screen to return to the lobby for the next round. */
  onNewRound?: (roundNo: number) => void;
}

export const SCORES_DEBOUNCE_MS = 500;
const ROUND_RESEND_MS = 10_000;
const HELLO_COOLDOWN_MS = 2000;

const randomUnit = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
const deck = cards.map((c) => ({ id: c.id, category: c.category }));
const ids = cards.map((c) => c.id);

function initialState(room: GameRoom): RoundState {
  const base = initialRound(room.code, room.seed, callableLangs());
  if (room.saved) return roundReducer(base, { type: 'restore', saved: room.saved, ids });
  let s: RoundState = { ...base, roundNo: room.roundNo ?? 1 };
  if (room.settings) s = roundReducer(s, { type: 'configure', patch: room.settings });
  return roundReducer(s, { type: 'start', ids, langs: callableLangs() });
}

/**
 * Automatic caller (docs/rules.md v2 §4-§7): round state, calls with choices, picks scored in
 * arrival order, callClosed at the end of each window, full-card detection after callClosed.
 *
 * - Picks are only accepted for the CURRENT call of the CURRENT round (max 2 per seat per call,
 *   enforced by scorePick). Every seat in the room may pick, whether or not the card is on its tabla.
 * - Everyone crosses a called card off at callClosed, so a tabla is complete when all 16 of its
 *   cards have been called; simultaneous completions are decided by points (ties share).
 */
export function useGame({ transport, room, roster, onNewRound }: GameProps) {
  const [state, setStateRaw] = useState<RoundState>(() => initialState(room));
  const stateRef = useRef(state);
  const [pickState, setPickState] = useState<PickState>(
    () => room.saved?.pick ?? initialPickState(),
  );
  const pickRef = useRef(pickState);
  const [names, setNames] = useState<Record<string, string>>({});
  const [noAudio, setNoAudio] = useState(false);
  const [announcement, setAnnouncement] = useState({ text: '', seq: 0 });
  const [pickedSeats, setPickedSeats] = useState<string[]>([]);
  const [eligible, setEligible] = useState<string[]>([]);
  const [windowStart, setWindowStart] = useState(() => Date.now());
  const trRef = useRef(transport);
  const rosterRef = useRef(roster);
  const roomRef = useRef(room);
  const knownRef = useRef<Map<string, RosterPlayer>>(new Map());
  const lastHelloRef = useRef<Map<string, number>>(new Map());
  const bootRef = useRef<Transport | null>(null);
  const spokenRef = useRef(!!room.saved);
  const choicesRef = useRef<Map<number, [CardId, CardId, CardId]>>(new Map());
  const scoresTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderCounter = useRef(0);
  const pickedRef = useRef<Set<string>>(new Set());
  const [localWrong, setLocalWrong] = useState<{ i: number; ids: CardId[] }>({ i: -1, ids: [] });
  const hostPlays = !!room.local;
  const [currentChoices, setCurrentChoices] = useState<CardId[]>([]);

  useEffect(() => {
    trRef.current = transport;
    rosterRef.current = roster;
    roomRef.current = room;
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

  const players = useCallback((): RosterPlayer[] => {
    const get = roomRef.current.getRoster;
    return get ? get() : [...knownRef.current.values()];
  }, []);

  const sendLobby = useCallback(
    (status: 'started' | 'full' = 'started') => {
      send(
        lobbyMessage(
          status,
          players(),
          stateRef.current.roundNo,
          roomRef.current.hostKey,
          defaultsOf(stateRef.current.settings),
        ),
      );
    },
    [players, send],
  );

  const sendRound = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === 'setup') return;
    send({
      t: 'round',
      seed: s.roomSeed,
      roundNo: s.roundNo,
      speedSec: s.settings.speedSec,
      gridSize: s.settings.gridSize,
      ...(roomRef.current.hostKey ? { hostKey: roomRef.current.hostKey } : {}),
    });
  }, [send]);

  /** Squares crossed per seat, counting the first `closed` calls of the round. */
  const crossedCounts = useCallback(
    (closed: number): Record<string, number> => {
      const s = stateRef.current;
      const done = new Set(s.order.slice(0, Math.max(0, closed)));
      const out: Record<string, number> = {};
      for (const p of players()) {
        const idx = s.assignments[p.seat];
        if (idx === undefined) continue;
        out[p.seat] = tabla(s.roomSeed, idx, deck, s.settings.gridSize).cards.filter((c) =>
          done.has(c),
        ).length;
      }
      return out;
    },
    [players],
  );

  /** `closed` = calls whose window has ended; a mid-window send counts all but the current call. */
  const sendScores = useCallback(
    (closed?: number) => {
      if (scoresTimer.current) clearTimeout(scoresTimer.current);
      scoresTimer.current = null;
      const s = stateRef.current;
      const n = typeof closed === 'number' ? closed : Math.max(0, s.calledCount - 1);
      send({
        t: 'scores',
        roundNo: s.roundNo,
        points: { ...pickRef.current.points },
        crossed: crossedCounts(n),
      });
    },
    [crossedCounts, send],
  );

  const scheduleScores = useCallback(() => {
    if (scoresTimer.current) return;
    scoresTimer.current = setTimeout(() => sendScores(), SCORES_DEBOUNCE_MS);
  }, [sendScores]);

  const ensureAssigned = useCallback(
    (seat: string): number => {
      const cur = stateRef.current.assignments[seat];
      if (cur !== undefined) return cur;
      const taken = Object.values(stateRef.current.assignments);
      const index = pickTablaIndex(
        stateRef.current.roomSeed,
        taken,
        deck,
        randomUnit,
        stateRef.current.settings.gridSize,
      );
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
        closed: stateRef.current.order.slice(
          0,
          stateRef.current.phase === 'ended'
            ? stateRef.current.calledCount
            : Math.max(0, stateRef.current.calledCount - 1),
        ),
      });
    },
    [ensureAssigned, send],
  );

  const assignAll = useCallback(() => {
    for (const p of players()) sendAssign(p.seat);
  }, [sendAssign, players]);

  /** Three choices for call i; computed once per call so resends are identical. */
  const choicesForCall = useCallback((s: RoundState, i: number): [CardId, CardId, CardId] => {
    const cached = choicesRef.current.get(i);
    if (cached) return cached;
    const langs = roomRef.current.langs;
    const correct = s.order[i] as CardId;
    const out = choicesFor(s.roomSeed, s.roundNo, i, correct, deck, (a, b) =>
      isAvoidedPair(a, b, langs && langs.length ? langs : undefined),
    );
    choicesRef.current.set(i, out);
    return out;
  }, []);

  const announce = useCallback(
    (s: RoundState, speak = true) => {
      const cardId = currentCard(s);
      const card = cardId ? getCard(cardId) : undefined;
      if (!card) return;
      const i = s.calledCount - 1;
      const choices = choicesForCall(s, i);
      setCurrentChoices(choices);
      const lang = roomRef.current.local?.spokenLang ?? langForCall(s, i);
      send({
        t: 'call',
        i,
        cardId: card.id,
        choices,
        at: Date.now(),
      });
      if (!speak) return;
      // New call window: reset pick tracking.
      pickedRef.current = new Set();
      setPickedSeats([]);
      setWindowStart(Date.now());
      setEligible(players().map((p) => p.seat));
      const text = card.names[lang]?.text ?? card.names.es?.text ?? card.id;
      setAnnouncement((a) => ({ text, seq: a.seq + 1 }));
      setMediaSession(text, `Lotería · ${s.code}`, {
        pause: () => apply({ type: 'pause' }),
        play: () => {
          setWindowStart(Date.now());
          apply({ type: 'resume' });
        },
      });
      void speakCall(card, lang).then((r: SpeakResult) => setNoAudio(r === 'no-audio'));
    },
    [apply, choicesForCall, players, send],
  );

  const finishRound = useCallback(
    (winners: string[]) => {
      const ns = apply({ type: 'finish', winners });
      stopAudio();
      send({ t: 'end', roundNo: ns.roundNo, winners: ns.winners, reason: 'full-card' });
    },
    [apply, send],
  );

  /** Seats whose whole tabla has been called (everyone crosses off every called card). */
  const completedSeats = useCallback(
    (s: RoundState): string[] => {
      const called = new Set(calledCards(s));
      const out: string[] = [];
      for (const p of players()) {
        const idx = s.assignments[p.seat];
        if (idx === undefined) continue;
        const t = tabla(s.roomSeed, idx, deck, s.settings.gridSize);
        if (
          isCardComplete(
            t,
            t.cards.filter((c) => called.has(c)),
          )
        )
          out.push(p.seat);
      }
      return out;
    },
    [players],
  );

  /** End of a call window: callClosed, then full-card detection (ties broken by points). */
  const closeCall = useCallback((): boolean => {
    const s = stateRef.current;
    const i = s.calledCount - 1;
    send({ t: 'callClosed', roundNo: s.roundNo, i });
    sendScores(s.calledCount);
    const done = completedSeats(s);
    if (done.length === 0) return false;
    finishRound(resolveFullCardWinners(done, pickRef.current.points));
    return true;
  }, [completedSeats, finishRound, send, sendScores]);

  const handlePick = useCallback(
    (m: Extract<Msg, { t: 'pick' }>) => {
      const s = stateRef.current;
      if (s.phase !== 'running' && s.phase !== 'paused') return;
      const i = s.calledCount - 1;
      // Closed call or another round: ignore, send nothing.
      if (m.roundNo !== s.roundNo || m.i !== i) return;
      if (roomRef.current.isMember && !roomRef.current.isMember(m.seat)) return;
      if (!pickedRef.current.has(m.seat)) {
        pickedRef.current.add(m.seat);
        setPickedSeats([...pickedRef.current]);
      }
      const call = { i, cardId: s.order[i] as CardId };
      const { state: next, result } = scorePick(
        pickRef.current,
        { seat: m.seat, i: m.i, cardId: m.cardId, at: orderCounter.current++ },
        call,
      );
      pickRef.current = next;
      setPickState(next);
      send({
        t: 'pickResult',
        roundNo: s.roundNo,
        i,
        seat: m.seat,
        correct: result.correct,
        points: result.points,
        first: result.first,
      });
      if (result.correct && result.first) sendScores();
      else if (result.correct) scheduleScores();
    },
    [scheduleScores, send, sendScores],
  );

  /**
   * The organiser's own pick ("Jugar también"). It is fed through exactly the same scorePick path as
   * a network pick, in the order it is enqueued, so it gets no head start.
   */
  const localPick = useCallback(
    (cardId: CardId) => {
      const s = stateRef.current;
      if (s.phase !== 'running') return;
      const i = s.calledCount - 1;
      handlePick({ t: 'pick', seat: LOCAL_SEAT, roundNo: s.roundNo, i, cardId });
      if (cardId !== s.order[i]) {
        setLocalWrong((w) => ({
          i,
          ids: w.i === i && w.ids.includes(cardId) ? w.ids : [...(w.i === i ? w.ids : []), cardId],
        }));
      }
    },
    [handlePick],
  );

  const handleMessage = useCallback(
    (m: Msg) => {
      if (m.t === 'hello') {
        const p: RosterPlayer = {
          seat: m.seat,
          name: m.name,
          glyph: m.glyph,
          ...(m.pronouns ? { pronouns: m.pronouns } : {}),
        };
        if (roomRef.current.isMember && !roomRef.current.isMember(m.seat)) {
          // Removed, or the 21st player: the room is full.
          sendLobby(players().length >= ROOM_MAX_PLAYERS ? 'full' : 'started');
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
        const s = stateRef.current;
        sendScores(s.phase === 'ended' ? s.calledCount : Math.max(0, s.calledCount - 1));
        if (s.phase === 'running' || s.phase === 'paused') announce(s, false);
      } else if (m.t === 'pick') handlePick(m);
    },
    [announce, handlePick, players, sendAssign, sendLobby, sendRound, sendScores],
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
      sendScores(s.phase === 'ended' ? s.calledCount : Math.max(0, s.calledCount - 1));
      if (s.calledCount > 0 && s.phase === 'running') {
        const speak = !spokenRef.current;
        spokenRef.current = true;
        announce(s, speak);
      }
    }
    return off;
  }, [transport, handleMessage, sendLobby, sendRound, assignAll, announce, sendScores]);

  // Fresh start without a transport yet: still speak the first call locally.
  useEffect(() => {
    if (!trRef.current && !spokenRef.current) {
      spokenRef.current = true;
      announce(stateRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // The organiser's own seat gets a tabla like any other seat.
  useEffect(() => {
    if (hostPlays) ensureAssigned(LOCAL_SEAT);
  }, [hostPlays, ensureAssigned]);

  useEffect(
    () => () => {
      stopAudio();
      if (scoresTimer.current) clearTimeout(scoresTimer.current);
    },
    [],
  );

  useEffect(() => {
    const list = roomRef.current.getRoster?.() ?? roster;
    void saveRound({
      ...toSaved(state),
      pick: pickState,
      roster: list.map((p) => ({
        ...p,
        ...(state.assignments[p.seat] !== undefined
          ? { tablaIndex: state.assignments[p.seat] }
          : {}),
      })),
    });
  }, [state, roster, pickState]);

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

  // Automatic caller: advance every speedSec while running. Pending claims resolve first.
  const running = state.phase === 'running';
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => {
      if (closeCall()) return;
      const ns = apply({ type: 'next' });
      if (ns.phase === 'ended') {
        send({ t: 'end', roundNo: ns.roundNo, winners: ns.winners, reason: 'full-card' });
      } else announce(ns);
    }, state.settings.speedSec * 1000);
    return () => clearTimeout(t);
  }, [running, state.calledCount, state.settings.speedSec, apply, announce, send, closeCall]);

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

  const repeat = useCallback(() => {
    if (stateRef.current.calledCount > 0) announce(stateRef.current, true);
  }, [announce]);

  const togglePause = useCallback(() => {
    const ns = apply({ type: 'togglePause' });
    // The call window restarts on resume, matching the caller timer.
    if (ns.phase === 'running') setWindowStart(Date.now());
  }, [apply]);

  const setSpeed = useCallback(
    (sec: number) => {
      apply({ type: 'configure', patch: { speedSec: clampSpeed(sec) } });
      setWindowStart(Date.now());
      sendRound();
    },
    [apply, sendRound],
  );

  const newRound = useCallback(() => {
    void clearRound();
    onNewRound?.(stateRef.current.roundNo + 1);
  }, [onNewRound]);

  const current: Card | undefined = (() => {
    const id = currentCard(state);
    return id ? getCard(id) : undefined;
  })();
  const called: CardId[] = calledCards(state);
  const idx = state.assignments[LOCAL_SEAT];
  const i = state.calledCount - 1;
  const closedCount = state.phase === 'ended' ? state.calledCount : Math.max(0, i);
  const localCards: CardId[] =
    hostPlays && idx !== undefined
      ? tabla(state.roomSeed, idx, deck, state.settings.gridSize).cards
      : [];
  const closed = new Set(state.order.slice(0, closedCount));
  const localCrossed = localCards.filter((c) => closed.has(c));
  const localChoices = hostPlays ? currentChoices : [];
  const local = hostPlays
    ? {
        cards: localCards,
        crossed: localCrossed,
        choices: localChoices,
        wrong: localWrong.i === i ? localWrong.ids : [],
        picksUsed: pickState.picks[i]?.[LOCAL_SEAT] ?? 0,
        callPoints: pickState.scored[i]?.[LOCAL_SEAT] ?? 0,
        first: pickState.firstByCall[i] === LOCAL_SEAT,
        points: pickState.points[LOCAL_SEAT] ?? 0,
        squaresLeft: localCards.length - localCrossed.length,
        pick: localPick,
      }
    : null;
  const standings: LeaderboardEntry[] = roster.map((p) => {
    const at = state.assignments[p.seat];
    return {
      seat: p.seat,
      name: p.name,
      glyph: p.glyph,
      points: pickState.points[p.seat] ?? 0,
      crossed:
        at === undefined
          ? 0
          : tabla(state.roomSeed, at, deck, state.settings.gridSize).cards.filter((c) =>
              closed.has(c),
            ).length,
    };
  });
  const currentLang: Lang | undefined =
    state.calledCount > 0 ? langForCall(state, state.calledCount - 1) : undefined;

  return {
    state,
    names,
    noAudio,
    announcement,
    current,
    currentLang,
    called,
    local,
    points: pickState.points,
    standings,
    pickedCount: pickedSeats.filter((s) => eligible.includes(s)).length,
    eligibleCount: eligible.length,
    phones: roster.length,
    windowStart,
    repeat,
    togglePause,
    setSpeed,
    newRound,
  };
}

export type Game = ReturnType<typeof useGame>;
