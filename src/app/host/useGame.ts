import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { callableLangs, cards, getCard, isAvoidedPair } from '@content';
import type { Card } from '@content';
import {
  checkClaim,
  choicesFor,
  initialPickState,
  resolveWinners,
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
  pickTablaIndex,
  roundReducer,
  toSaved,
  validatePaperCode,
} from './roundMachine';
import type { PaperOutcome, RoundAction, RoundState, SavedRound, Settings } from './roundMachine';
import { lobbyMessage } from './useHostRoom';
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
  connection?: 'connecting' | 'online' | 'offline' | 'unverified';
}

export interface GameProps {
  transport: Transport | null;
  room: GameRoom;
  roster: RosterPlayer[];
  /** Called from the ended screen to return to the lobby for the next round. */
  onNewRound?: (roundNo: number) => void;
}

export const CLAIM_GRACE_MS = 1500;
export const SCORES_DEBOUNCE_MS = 500;
const ROUND_RESEND_MS = 10_000;
const HELLO_COOLDOWN_MS = 2000;

const deck = cards.map((c) => ({ id: c.id, category: c.category }));
const ids = cards.map((c) => c.id);

interface PendingClaim {
  i: number;
  /** seat -> points at claim time; paper claimants use `paper:<n>` and 0 points. */
  claims: { seat: string; points: number; paper: boolean }[];
}

function initialState(room: GameRoom): RoundState {
  const base = initialRound(room.code, room.seed, callableLangs());
  if (room.saved) return roundReducer(base, { type: 'restore', saved: room.saved, ids });
  let s: RoundState = { ...base, roundNo: room.roundNo ?? 1 };
  if (room.settings) s = roundReducer(s, { type: 'configure', patch: room.settings });
  return roundReducer(s, { type: 'start', ids, langs: callableLangs() });
}

/**
 * Automatic caller: round state, calls with choices, picks/scores, claims, assignments.
 *
 * Rules decisions documented here (docs/rules.md):
 * - Picks are only accepted for the CURRENT call index of the CURRENT round. A pick for a closed
 *   call (or another round) is ignored and nothing is sent back.
 * - A pick for a card that is not on the seat's assigned tabla is answered with correct:false.
 * - Auto-mark (v1 trade-off): the phone sends its pick automatically at ~80% of the window; the
 *   host cannot tell it from a manual pick, so it earns points like any other pick if it is first.
 * - The crossed-out set kept here (from correct picks) is the authority for claims, never marks.
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
  const [claimNote, setClaimNote] = useState<{ seat: string; valid: boolean } | null>(null);
  const [paperCode, setPaperCode] = useState<string | null>(null);
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
  const pendingRef = useRef<PendingClaim | null>(null);
  const graceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoresTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orderCounter = useRef(0);
  const pickedRef = useRef<Set<string>>(new Set());

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

  const sendLobby = useCallback(() => {
    send(lobbyMessage('started', players(), stateRef.current.roundNo, roomRef.current.hostKey));
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
      ...(roomRef.current.hostKey ? { hostKey: roomRef.current.hostKey } : {}),
    });
  }, [send]);

  const sendScores = useCallback(() => {
    if (scoresTimer.current) clearTimeout(scoresTimer.current);
    scoresTimer.current = null;
    send({ t: 'scores', roundNo: stateRef.current.roundNo, points: { ...pickRef.current.points } });
  }, [send]);

  const scheduleScores = useCallback(() => {
    if (scoresTimer.current) return;
    scoresTimer.current = setTimeout(sendScores, SCORES_DEBOUNCE_MS);
  }, [sendScores]);

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
      const lang = langForCall(s, i);
      send({
        t: 'call',
        i,
        cardId: card.id,
        choices: choicesForCall(s, i),
        lang,
        at: Date.now(),
      });
      if (!speak) return;
      // New call window: reset pick tracking.
      pickedRef.current = new Set();
      setPickedSeats([]);
      setWindowStart(Date.now());
      const elig = players()
        .map((p) => p.seat)
        .filter((seat) => {
          const idx = s.assignments[seat];
          return idx !== undefined && tabla(s.roomSeed, idx, deck).cards.includes(card.id);
        });
      setEligible(elig);
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
      if (graceRef.current) clearTimeout(graceRef.current);
      graceRef.current = null;
      pendingRef.current = null;
      const ns = apply({ type: 'finish', winners });
      stopAudio();
      send({ t: 'end', roundNo: ns.roundNo, winners: ns.winners });
    },
    [apply, send],
  );

  /** Resolve the claims collected for one call: highest points win, ties share; paper shares. */
  const resolvePending = useCallback(() => {
    const p = pendingRef.current;
    if (!p || p.claims.length === 0) return false;
    const phones = p.claims.filter((c) => !c.paper);
    const paper = p.claims.filter((c) => c.paper).map((c) => c.seat);
    const winners = [...new Set([...resolveWinners(phones), ...paper])];
    finishRound(winners);
    return true;
  }, [finishRound]);

  const registerClaim = useCallback(
    (seat: string, paper: boolean) => {
      const s = stateRef.current;
      const i = s.calledCount - 1;
      let p = pendingRef.current;
      if (!p || p.i !== i) p = pendingRef.current = { i, claims: [] };
      if (!p.claims.some((c) => c.seat === seat)) {
        p.claims.push({ seat, points: paper ? 0 : (pickRef.current.points[seat] ?? 0), paper });
      }
      graceRef.current ??= setTimeout(() => {
        graceRef.current = null;
        resolvePending();
      }, CLAIM_GRACE_MS);
    },
    [resolvePending],
  );

  const handlePick = useCallback(
    (m: Extract<Msg, { t: 'pick' }>) => {
      const s = stateRef.current;
      if (s.phase !== 'running' && s.phase !== 'paused') return;
      const i = s.calledCount - 1;
      // Closed call or another round: ignore, send nothing.
      if (m.roundNo !== s.roundNo || m.i !== i) return;
      if (roomRef.current.isMember && !roomRef.current.isMember(m.seat)) return;
      const call = { i, cardId: s.order[i] as CardId };
      const idx = s.assignments[m.seat];
      const onTabla = idx !== undefined && tabla(s.roomSeed, idx, deck).cards.includes(m.cardId);
      const reply = (correct: boolean, first: boolean) =>
        send({ t: 'pickResult', roundNo: s.roundNo, i, seat: m.seat, correct, first });
      if (!onTabla) return reply(false, false);
      if (!pickedRef.current.has(m.seat)) {
        pickedRef.current.add(m.seat);
        setPickedSeats([...pickedRef.current]);
      }
      const { state: next, result } = scorePick(
        pickRef.current,
        { seat: m.seat, i: m.i, cardId: m.cardId, at: orderCounter.current++ },
        call,
      );
      pickRef.current = next;
      setPickState(next);
      reply(result.correct, result.first);
      if (result.correct && result.first) sendScores();
      else if (result.correct) scheduleScores();
    },
    [scheduleScores, send, sendScores],
  );

  const handleClaim = useCallback(
    (m: Extract<Msg, { t: 'claim' }>) => {
      const s = stateRef.current;
      if (s.phase !== 'running' && s.phase !== 'paused') return;
      const idx = s.assignments[m.seat];
      let valid = false;
      let missing: CardId[] = [];
      if (m.roundNo === s.roundNo && idx !== undefined && idx === m.tablaIndex) {
        // The host's crossed-out set is the authority (marks sent by the phone are ignored).
        const r = checkClaim(
          tabla(s.roomSeed, idx, deck),
          calledCards(s),
          s.settings.pattern,
          pickRef.current.crossed[m.seat] ?? [],
        );
        valid = r.valid;
        missing = [...(r.missing ?? []), ...(r.unmarked ?? [])];
      }
      send({
        t: 'claimResult',
        seat: m.seat,
        roundNo: s.roundNo,
        valid,
        ...(valid ? {} : { missing }),
      });
      setClaimNote({ seat: m.seat, valid });
      if (valid) registerClaim(m.seat, false);
    },
    [registerClaim, send],
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
        const s = stateRef.current;
        if (s.phase === 'running' || s.phase === 'paused') announce(s, false);
      } else if (m.t === 'pick') handlePick(m);
      else if (m.t === 'claim') handleClaim(m);
    },
    [announce, handleClaim, handlePick, sendAssign, sendLobby, sendRound],
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

  useEffect(
    () => () => {
      stopAudio();
      if (graceRef.current) clearTimeout(graceRef.current);
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
      if (resolvePending()) return;
      const ns = apply({ type: 'next' });
      if (ns.phase === 'ended') send({ t: 'end', roundNo: ns.roundNo, winners: ns.winners });
      else announce(ns);
    }, state.settings.speedSec * 1000);
    return () => clearTimeout(t);
  }, [running, state.calledCount, state.settings.speedSec, apply, announce, send, resolvePending]);

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

  const endRound = useCallback(() => {
    const ns = apply({ type: 'end' });
    stopAudio();
    send({ t: 'end', roundNo: ns.roundNo, winners: ns.winners });
  }, [apply, send]);

  const newRound = useCallback(() => {
    void clearRound();
    onNewRound?.(stateRef.current.roundNo + 1);
  }, [onNewRound]);

  /** Paper board: check the 6-char code; a valid one counts as a claim for this call. */
  const checkPaper = useCallback(
    (code: string) => {
      setPaperCode(code);
      const out = validatePaperCode(stateRef.current, deck, code);
      const s = stateRef.current;
      if (out.kind === 'valid' && (s.phase === 'running' || s.phase === 'paused')) {
        registerClaim(`paper:${out.index + 1}`, true);
      }
    },
    [registerClaim],
  );

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
    paper,
    checkPaper,
    clearPaper: () => setPaperCode(null),
    announcement,
    current,
    currentLang,
    called,
    points: pickState.points,
    pickedCount: pickedSeats.filter((s) => eligible.includes(s)).length,
    eligibleCount: eligible.length,
    phones: roster.length,
    windowStart,
    repeat,
    togglePause,
    setSpeed,
    endRound,
    newRound,
  };
}

export type Game = ReturnType<typeof useGame>;
