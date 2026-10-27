# Contest build (2026-10-26) — shared contract

**Split:** César builds **the game** (rules as pure, tested code + content). Rob builds **the app** (scaffold, network, screens, audio playback, deploy). Rob consumes César's code; César never waits on Rob except for the scaffold.

**Sources of truth, in order:** [reglas.md](../reglas.md) (behaviour, `R-xx`) → this file (code contracts) → [catalogo.md](../catalogo.md) (figures and deck) → [PRD.md](../PRD.md). Plans: [CESAR.md](CESAR.md) · [ROB.md](ROB.md).

**Out today (reglas.md D6):** paper boards / PDF, PWA offline mode, hint matcher, room-full message.

## 1. Ownership

| Path | Owner |
|---|---|
| `src/engine/**`, `src/content/**`, `public/audio/**`, `scripts/copy-lint.ts`, `docs/reglas.md`, `docs/catalogo.md` | César |
| Everything else: root config, `src/main.tsx`, `src/app/**`, `src/net/**`, `e2e/**`, `.github/**`, `vercel.json`, `README.md` | Rob |

Rule: **if it decides something about the game, it lives in `src/engine` and has a test named after its `R-xx`.** UI code never re-implements a rule; it calls the engine.

## 2. Engine contract (`src/engine/index.ts`, César)

César pushes this file first (unit G0) with real types and stub bodies, so Rob can type against it from minute one.

```ts
export type Lang = 'es' | 'en' | 'nah' | 'yua' | 'quz';
export type CardId = string;
export type Category = 'animals' | 'plants_food' | 'sky' | 'land' | 'handmade' | 'places';
export type PatternId = 'line' | 'square' | 'corners' | 'center' | 'ele' | 'x' | 'frame' | 'full';
export type Level = 'easy' | 'medium' | 'hard' | 'any';
export interface Tabla { index: number; cards: CardId[] }            // 16, row-major 4x4

export interface RoundSettings {
  pattern: PatternId | { surprise: Level };                           // R-16, R-17
  callLang: Lang | 'rotating';                                        // R-14
  speedSec: number;                                                   // 6..20
  mode: 'normal' | 'escucha';                                         // R-15
}
export interface SeatInfo { seat: string; name: string; glyph: string; pronouns?: string; labelLang: Lang; tablaIndex: number }
export interface RoomState {
  code: string; seed: string; deckSecret: string;                     // R-09: deckSecret never leaves the host
  roundNo: number; settings: RoundSettings;
  round: null | { pattern: PatternId; order: CardId[]; called: number;
    status: 'running' | 'paused' | 'claimPause' | 'ended'; winners: string[] };
  seats: Record<string, SeatInfo>; lastClaimAt: Record<string, number>; takenIndices: number[];
}
export type HostEvent =
  | { type: 'startRound'; settings: RoundSettings }
  | { type: 'next' } | { type: 'repeat' } | { type: 'pause' } | { type: 'resume' } | { type: 'end' }
  | { type: 'msg'; msg: Msg; now: number };                           // hello / claim from the network
export type Effect =
  | { type: 'speak'; cardId: CardId; lang: Lang; withVerse: boolean } // R-11
  | { type: 'claim'; seat: string; valid: boolean; cells?: number[]; missing?: CardId[] } // R-18, R-22
  | { type: 'roundEnded'; winners: string[] };                        // R-44
export interface HostOutput { state: RoomState; send: Msg[]; effects: Effect[] }

export function createRoom(rng?: () => number): RoomState;
export function hostReduce(state: RoomState, ev: HostEvent): HostOutput;   // the referee (G2)
export function tabla(seed: string, index: number): Tabla;                // uses the deck from @content
export function checkClaim(t: Tabla, called: CardId[], pattern: PatternId, marks?: CardId[]):
  { valid: boolean; cells?: number[]; missing?: CardId[] };
export const PATTERNS: Record<PatternId, number[][]>;
export const PATTERN_LEVEL: Record<PatternId, Exclude<Level, 'any'>>;

// Player-side rules (G3), pure: the phone calls these, never decides itself
export interface TapInput { mode: 'play' | 'practice'; tabla: Tabla; called: CardId[]; current: CardId | null;
  marks: CardId[]; cardId: CardId; attempts: number }
export interface TapResult { mark: boolean; feedback: null | 'ok' | 'late' | 'wrong'; attempts: number;
  reveal?: CardId | 'not-in-tabla' }                                  // R-38, R-39
export function evaluateTap(i: TapInput): TapResult;
export function evaluateNotInTabla(i: Omit<TapInput, 'cardId'>): TapResult; // R-39.4
export interface PracticeEvent { cardId: CardId; firstTry: boolean; helped: boolean }
export function practiceSummary(log: PracticeEvent[]): { heard: number; firstTry: number; review: CardId[] }; // R-41
```

## 3. Content contract (`src/content/index.ts`, César, done in G0)

```ts
export interface CardName { text: string; status: 'draft' | 'reviewed' | 'approved'; source?: string;
  confidence?: 'sourced' | 'weak'; variant?: 'classical'; audio?: string; note?: string }
export interface Card { n: number; id: CardId; category: Category; art: string;
  names: Record<Lang, CardName>; verso?: { es: string; en: string } }
export const cards: Card[];                       // from cards.json, 54, sorted by n
export function cardById(id: CardId): Card;
export function cardLabel(c: Card, lang: Lang): { text: string; aiVoice: boolean; weak: boolean };
export const LANGS: Lang[];                       // ['es','en','nah','yua','quz'], all callable (reglas D4)
export const LANG_LABEL: Record<Lang, string>;    // "Español", "English", "Náhuatl", "Maaya t'aan", "Runasimi"
```

`aiVoice` is true for `nah`, `yua`, `quz`. **Every screen that shows or plays one of those words also shows the label** "Palabra de diccionario · voz generada por IA · puede tener errores" (reglas D1). That label is not optional.

## 4. Network messages (`src/net/transport.ts`, Rob)

```ts
export type Msg =
 | { t: 'round'; seed: string; roundNo: number; pattern: PatternId; mode: 'normal'|'escucha'; callLang: Lang|'rotating'; speedSec: number }
 | { t: 'call'; i: number; cardId: CardId; lang: Lang; at: number }
 | { t: 'claimResult'; seat: string; valid: boolean; missing?: CardId[] }
 | { t: 'end'; winners: string[] }
 | { t: 'welcome'; seat: string; tablaIndex: number; round: Omit<Extract<Msg,{t:'round'}>,'t'> | null; called: CardId[] }
 | { t: 'hello'; seat: string; name: string; glyph: string; pronouns?: string; labelLang: Lang }
 | { t: 'claim'; seat: string; tablaIndex: number; marks: CardId[] };
export interface Transport { join(code: string, role: 'host'|'player', seat: string): Promise<void>;
  send(m: Msg): void; onMessage(cb: (m: Msg) => void): () => void; onPresence(cb: (seats: string[]) => void): () => void; leave(): void }
```

- `round` **never** carries `deckSecret` (R-09). `pattern` is always the resolved figure (R-17).
- The host never builds messages by hand: it sends exactly `hostReduce(...).send`.
- The player's listen language, mode (Jugar/Practicar), "hear on phone" and "practice by ear" are **local to the phone**, never sent.

## 5. Test ids (Rob's e2e; César's engine doesn't care)

Home `home-host`, `home-join-code`, `home-join-submit` · Host `room-code`, `host-start`, `host-next`, `host-pause`, `host-end`, `current-call` (`data-card-id`), `claim-result`, `settings-pattern`, `settings-speed` · Join `join-name`, `join-glyph-0..11`, `join-label-lang`, `join-listen-lang`, `join-submit`, `join-waiting` · Player `tabla-cell-0..15` (`data-card-id`, `aria-pressed`), `player-current-call`, `claim-button`, `claim-feedback`, `mode-toggle`, `hear-toggle`, `replay-button`, `not-in-tabla-button`, `practice-feedback`, `practice-summary`, `ai-voice-label`.

## 6. Git, agents, ports

- Branch per unit (`cesar/g1-engine`, `rob/a2-host`), rebase on `main`, self-merge when `pnpm check` + CI are green. A change to §2–§5 is a `contract:` PR the other person OKs in chat.
- Dependencies: Rob installs them all in A0. If the lockfile conflicts: `git checkout --theirs pnpm-lock.yaml && pnpm install`.
- Secrets (Supabase URL and anon key) live only in `.env.local` and in Vercel settings.
- Ports: dev `5291`, preview `4291`, `--strictPort`.
- **Coding agent:** Sonnet 5.5. **Adversarial reviewer:** Sonnet 5.5 in **fresh context** (new subagent or session; never sees the coding conversation). Reviewer prompt below; give it nothing else.

```text
You are an adversarial code reviewer for the repo in the current directory. You have NOT seen how this code was written.
Do not trust comments, commit messages or test names; trust only what you run.
Unit: <UNIT ID>. Spec: docs/plan/00-SHARED.md, the unit's section in <docs/plan/CESAR.md | docs/plan/ROB.md>, and every R-xx it cites in docs/reglas.md.
Code: `git diff main...HEAD` plus files it touches.
1. Run `pnpm install --frozen-lockfile` and `pnpm check`; report exact failing output.
2. For every "Done when" item and every cited R-xx example: PASS/FAIL with evidence (command + output, or file:line).
3. Hunt for what the spec requires and the diff forgot, and for contract breaks vs 00-SHARED §2–§5 or file ownership (§1).
4. For each new test, mutate the code it guards (one line), show it goes red, revert. Green under mutation = finding.
Report only correctness/contract/criteria findings, max 8, most severe first. Each: Severity (BLOCKER|SHOULD-FIX) · Where (file:line) ·
What breaks (input → wrong result) · Proof · Fix (exact change) · Verify fix with (command).
End with "VERDICT: MERGE" or "VERDICT: FIX FIRST (n blockers)". If all passes, show the evidence table; do not invent findings.
```

## 7. Sync points (say it in chat when each lands)

| Lands | Unblocks |
|---|---|
| César G0 (contract stubs + content API) | Rob types against the engine |
| Rob A0 (scaffold) | César runs engine tests in CI |
| César G1 (engine core) | Rob A3 renders real tablas |
| César G2 (referee) | Rob A2 runs a real round |
| Rob A1 (network) + A2 + A3 | First host + phones round |
| Both | F1 fixes, then the demo |
