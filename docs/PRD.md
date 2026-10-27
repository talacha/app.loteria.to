# PRD: Lotería de los Pueblos (app.loteria.to)

**Status:** v1 build spec. Companion to [ARCHITECTURE.md](ARCHITECTURE.md), which wins on stack questions.
**One line:** The picture bingo everyone grew up with, called in five languages. A whole classroom, plaza or family table joins from one QR code, and no phone is required to play.

## 1. Goals and non-goals

**Goals**
1. A cantor (host) can start a round in under 30 s and a player can hold a tabla in under 30 s from scanning a QR code. No accounts, no app store.
2. Phones, a shared tablet and printed paper boards all play in the same round.
3. A single device can run a full round for paper boards with **no network at all** (PWA, precached).
4. Calls in five languages: Nahuatl (`nah`), Maya (`yua`), Quechua (`quz`), Español (`es`), English (`en`), or a rotating language per card.
5. Honest about language: no Indigenous-language word or recording is shown as authoritative unless its status is `approved`.

**Non-goals (v1):** money, prizes, betting, accounts, chat, leaderboards across rounds, AI-generated Indigenous text, synthetic speech for Indigenous languages, native apps.

## 2. Users
- **Classroom / community centre:** one screen calls, kids play on paper or phones.
- **Mixed-language families:** a grandparent calls in Maya while kids match pictures.
- **Heritage learners:** *Escucha* mode calls only the word (no caption), learn by ear.

## 3. Functional requirements

### 3.1 Deck
- 54 original cards in 6 categories (animals, plants & food, sky, land, handmade/tools, places). No stereotyped human figures; no gendered human roles in copy.
- Each card: stable `id`, number `n`, category, art, names per language with `status` (`draft` | `reviewed` | `approved`), Spanish/English verse and riddle, tags.
- Art for v1 is placeholder emoji/SVG. Names shown for `nah`/`yua`/`quz` ship **empty/absent** until reviewed; the UI shows "pending review" and hides that call language (`VITE_HIDE_UNREVIEWED`, default on in production). **Never fabricate Indigenous-language words.**

### 3.2 Cantor (host)
- Home → "Ser cantor" creates a room: 5-letter code from an unambiguous alphabet, random seed, QR + URL `https://app.loteria.to/r/{CODE}`.
- Settings: call language (one of 5, or *rotating*), speed (6–20 s, presets: Calmado / Normal / Rápido), pattern (line, four corners, center square, full board), Escucha mode (audio/word only), captions on/off.
- Controls: start, pause/resume, next, repeat, end round; keyboard (Space, N, R, L = check paper code, P = pause).
- Shuffle = `deckOrder(roomSeed, roundNo)`; no card repeats in a round. Screen Wake Lock while running. State saved to IndexedDB after each call so reload resumes.
- Audio: play recorded clip if present; Spanish/English may fall back to Web Speech; **Indigenous languages never use synthetic speech** (show caption only, with a "no recording yet" note).
- Claim handling: phone claims arrive over the channel; host validates with `checkClaim`; result broadcast. Paper claims: press `L`, type 6-char code, host validates locally.

### 3.3 Player (phone / tablet)
- Join by QR → `/r/{CODE}` → enter name (free text) + pick a glyph (no photos) + optional pronouns + label language → receive a 4×4 tabla (16 cards, ≤5 per category) derived from `tabla(seed, index)`.
- Mark by tap (bean animation; respects reduced motion). Marks stay on the phone (sessionStorage). Optional **auto-mark** accessibility aid.
- "¡Lotería!" button sends `claim`. Invalid claim → friendly "¡Casi!" with no penalty and no lockout beyond a 3 s rate limit.
- Current call shown large with caption (unless Escucha). Listen-only mode. Adjustable text size, high-contrast theme.

### 3.4 Paper play
- `/print`: choose count, paper size (Letter/A4), label language, large print, ink saver. PDF built in the browser (`pdf-lib`, Web Worker). Each board prints a 6-char Crockford base32 check code (with checksum) encoding seed ref + index.
- Works fully offline.

### 3.5 Offline / PWA
- Service worker precaches shell, content, art, audio of enabled languages (< 10 MB). `/api/*` is network-only. Host plays a full round with no network (paper players).

### 3.6 Networking
- Supabase Realtime broadcast channel `loteria:{code}` + Presence; ≤ 40 players. Messages per ARCHITECTURE §5.3, zod-validated. Host is authority.
- A `Transport` interface with two implementations: `SupabaseTransport` and `LocalTransport` (BroadcastChannel, same-browser tabs) used for dev, tests and when env vars are absent. The app must run and be e2e-testable with no Supabase credentials.

### 3.7 i18n / accessibility
- UI strings in `es` (default) and `en`; catalogs for the call languages hold card names only. i18next with ICU plurals.
- WCAG 2.2 AA: keyboard operable, visible focus, 44 px targets, `prefers-reduced-motion`, colour is never the only signal, axe-clean in Playwright.

### 3.8 Privacy and tone
- No accounts, no tracking cookies. Players are names + glyphs; pronouns optional. No server stores names, tablas or marks. Optional anonymous counters, with opt-out, are **out of v1** (stub only).
- Copy lint forbids gendered human roles, "win/prize/bet/money" framing; "beans" not "chips".

### 3.9 Explicitly deferred (stub behind interface, no implementation)
AI hints (`HintProvider` with offline tag matcher only), Claude banter, reviewer tool (`/review`), `/admin`, metrics. Provide the interfaces and the offline matcher; leave online providers unimplemented.

### 3.10 Current focus: session setup and lobby (owner direction, 2026-10-26)
The build priority is the multiplayer scaffold, not round rules. Turn-by-turn play will be specified later in `docs/rules.md`; until then the round screens are placeholders behind a single game boundary.
- **Mobile first, works on tablet and laptop.** Every screen is designed at 360 px first, then 768 px (tablet) and 1280 px (laptop). The host can be a phone as well as a projector.
- **Create:** Home → "Crear sala" → room code, signed host key, lobby.
- **Share:** QR code, copyable link `/r/{CODE}#k={hostKey}`, Web Share API where available, and the code in large type for typing at `/` → "Unirme".
- **Join:** link, QR or typed code → name + glyph (+ optional pronouns) → lobby.
- **Lobby:** a live roster (glyph + name) on every device via a signed host-only `lobby` message, updated on join/leave; the host sees a count and can start. Names travel only on the room channel and are never stored on a server.
- **Start:** host taps "Empezar" → host sends `lobby{status:'started'}` + `round` → every device switches to the game screen. Late joiners after start go straight into the game.
- **Game boundary:** `src/app/game/` exposes `HostGame` and `PlayerGame` components with props `{transport, room, roster}`; everything round-specific lives behind it so `docs/rules.md` can replace it.

## 4. Module contracts (binding for parallel work)

All paths are under the repo root. Aliases: `@engine`, `@app`, `@net`, `@ai`, `@content`, `@print`.

```ts
// src/engine/types.ts  (owner: engine agent; others import only)
export type Lang = 'es' | 'en' | 'nah' | 'yua' | 'quz';
export type CardId = string;
export type Category = 'animals' | 'plants_food' | 'sky' | 'land' | 'handmade' | 'places';
export type PatternId = 'line' | 'corners' | 'center' | 'full';
export interface Tabla { index: number; cards: CardId[] } // length 16, row-major 4x4

// src/engine/index.ts
export function deckOrder(roomSeed: string, roundNo: number, cardIds: CardId[]): CardId[];
export function tabla(seed: string, index: number, cards: {id: CardId; category: Category}[]): Tabla;
export function tablaCode(seed: string, index: number): string;        // 6 chars, Crockford, checksum
export function decodeTablaCode(code: string): { ok: boolean; seedRef?: number; index?: number };
export function checkClaim(t: Tabla, called: CardId[], pattern: PatternId, marks?: CardId[]):
  { valid: boolean; completedPattern?: PatternId; missing?: CardId[] };
export function roomCode(rng?: () => number): string;                  // 5 chars, no 0/O/1/I/L
export const PATTERNS: Record<PatternId, number[][]>;                  // winning index sets

// src/content/index.ts  (owner: content agent)
export interface Card { n: number; id: CardId; category: Category; art: string; tags: string[];
  names: Partial<Record<Lang, { text: string; ipa?: string; status: 'draft'|'reviewed'|'approved'; audio?: string }>>;
  verso: {es: string; en: string}; riddle: {es: string; en: string} }
export const cards: Card[];                      // 54, zod-validated at load
export function callableLangs(opts?: {hideUnreviewed?: boolean}): Lang[];
export function cardName(c: Card, lang: Lang): { text: string; status: string } | null;

// src/net/transport.ts  (owner: net agent)
export type Msg =
 | {t:'round'; seed:string; roundNo:number; mode:'normal'|'escucha'; pattern:PatternId; callLang:Lang|'rotating'; speedSec:number}
 | {t:'call'; i:number; cardId:CardId; lang:Lang; at:number}
 | {t:'claimResult'; seat:string; valid:boolean; missing?:CardId[]}
 | {t:'end'; winners:string[]}
 | {t:'hello'; seat:string; name:string; glyph:string; pronouns?:string; labelLang:Lang}
 | {t:'claim'; seat:string; tablaIndex:number; marks:CardId[]};
export interface Transport { join(code:string, role:'host'|'player'): Promise<void>;
  send(m:Msg): void; onMessage(cb:(m:Msg)=>void): ()=>void; onPresence(cb:(seats:string[])=>void): ()=>void; leave(): void }
export function createTransport(): Transport;   // Supabase if env set, else Local

// src/ai/hint.ts
export interface HintProvider { name:'matcher'; pick(call:{cardId?:string; audioOnly:boolean}, myCards:CardId[]): Promise<{cardId:CardId|null; confidence:number}> }
```

## 5. Milestones and ownership (disjoint file sets)

| # | Milestone | Owner dir(s) | Depends on |
|---|---|---|---|
| M0 | Scaffold: Vite+React+TS strict, pnpm, ESLint/Prettier, Vitest, Playwright config, vite-plugin-pwa, i18next, react-router, aliases, `pnpm check`, `vercel.json`, `.env.example`, `.gitignore`, CI workflow | root config, `src/main.tsx`, `src/app/App.tsx` shell | — |
| M1 | Engine + property tests | `src/engine/**` | M0 |
| M2 | Content: 54 cards, art, i18n catalogs, zod schema, validation script | `src/content/**`, `scripts/validate-content.ts` | M0 |
| M3 | Net: transports, message schemas, tests | `src/net/**` | M0 |
| M4 | Host UI + audio + persistence | `src/app/host/**`, `src/app/audio/**` | M1–M3 |
| M5 | Player UI + join flow | `src/app/player/**`, `src/app/join/**` | M1–M3 |
| M6 | Home, print/PDF, theme, a11y, copy lint | `src/app/home/**`, `src/print/**`, `src/app/theme/**`, `scripts/copy-lint.ts` | M1–M2 |
| M7 | E2E (host + 2 players over LocalTransport, offline round, axe), integration fixes, README | `e2e/**`, `README.md` | M4–M6 |

M1–M3 run in parallel; M4–M6 run in parallel; M7 last.

## 6. Acceptance criteria
- `pnpm check` (lint, typecheck, unit tests, content validation, copy lint) passes; `pnpm build` succeeds.
- Engine properties: same seed ⇒ same deck/tablas; no tabla has duplicates; ≤5 per category; tablaCode round-trips; single-character typo in a code is detected; `checkClaim` has no false positives.
- Playwright: host + 2 players complete a round over LocalTransport; invalid claim shows "¡Casi!"; round continues offline (`setOffline`); axe finds no serious violations on home, host, player.
- No unreviewed Indigenous-language string is rendered as a call when `VITE_HIDE_UNREVIEWED` is on.
- Precache < 10 MB.

## 7. Open items needing the owner (not blocking the build)
Domain/DNS and Vercel project for `app.loteria.to`; Supabase project + keys; native-speaker reviewers and recordings; commissioned art; code license. **Deploy is not part of this build run.**
