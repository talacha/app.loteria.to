# PRD: Lotería de los Pueblos (app.loteria.to)

**Status:** v1.0 baseline, as shipped at https://app.loteria.to (2026-10-27).
**Game rules:** [rules.md](rules.md) is the single source of truth for gameplay; this document does not restate them. **Stack:** [ARCHITECTURE.md](ARCHITECTURE.md). **Network contract:** [protocol.md](protocol.md). **Design:** [DESIGN.md](DESIGN.md). **Why things are the way they are:** [decisions/](decisions/README.md). **What's next:** [backlog.md](backlog.md).

**One line:** The picture lotería everyone grew up with, called aloud in Náhuatl, Maya yucateco, Quechua, Español and English. A room of friends, family or classmates joins from one QR code and plays on their phones.

## 1. Product pillars

Every feature serves at least one pillar. When they conflict, the earlier one wins.

1. **Learn languages by playing.** Each called card is heard in the player's spoken language and must be matched to one of three spellings. Hearing, choosing and seeing the word revealed on the cartón is the language exercise.
2. **Inclusion, and easy to add languages.** Five spoken languages at launch, chosen per player in the same room, independently of the app language. Adding a language is a content change (names in `src/content/cards.json` plus audio clips), not a code change. No accounts, no app store, any phone with a browser.
3. **Friends and family game time.** One QR code gathers the room; an automatic cantor means nobody has to "run" the game; wrong picks get a gentle "¡Casi!"; points only break ties; no money, prizes or betting, just frijoles.

## 2. Audiences

| Audience | What they need | How v1.0 serves it |
| --- | --- | --- |
| Mixed-language families | Grandparents, parents and kids play together, each in their own language | Per-player spoken language; app language separate (es/en) |
| Friends at a table or a party | Fast setup, no installs, a big shared screen | QR / link / code join; organiser's screen as the cantor; "Jugar también" so the organiser plays too |
| Heritage and second-language learners | Hear a word, recognise it, repeat | Spelling picks, replay button, solo mode against the computer |
| Classrooms and community centres | One screen, many players, sometimes no phones | Online game for phones; printed cartones live in a separate classroom mode (`/print`, see [decision 0009](decisions/0009-printing-is-a-separate-classroom-mode.md)) |

## 3. v1.0 scope (as shipped)

### 3.1 Rooms and joining

- The organiser opens a room from the home page (name + picture first); the room gets a 5-character code from an unambiguous alphabet (no I, L, O, 0, 1). Rooms hold **2–20 players**; a 21st player is told the room is full and offered a new room ([0010](decisions/0010-rooms-2-to-20-overflow-to-new-room.md)).
- Players join by **QR code, link** (`/r/{CODE}#k={hostKey}`) **or typed code**. Web Share API where available. Shared links show a room-invite preview card (Routing Middleware on `/r/*`).
- Live roster on every device; the organiser can remove a player. Reload or brief disconnects restore the same cartón, points and languages; late joiners enter the running round with 0 points. Re-crossing cards called before a join or reload is not yet implemented (backlog BUG-013).

### 3.2 Organiser screen ("pantalla del cantor")

- When creating the room the organiser picks **"Solo pantalla"** (display only) or **"Jugar también"** (the organiser also gets a cartón and spelling choices on the same screen and is scored like everyone else) ([0011](decisions/0011-host-screen-modes.md)).
- Controls: start (enabled at ≥ 2 players), pause/resume, calling speed (6–20 s per card), repeat the voice, mute/unmute, end the round early, "Otra ronda". Keyboard: Space/P pause, R repeat.
- The cantor screen is silent by default; phones carry the voices.

### 3.3 The round

- **Automatic cantor**: a voice, never a person, calls each card once in an order no player can predict. Every player sees the picture and hears the name in their own spoken language.
- **Spelling picks**: three written choices in the player's spoken language, the same three cards for everyone; one retry after "¡Casi!".
- **Scoring**: first correct pick 2 points, every other correct pick 1, wrong or none 0. Points last one round and only break ties.
- **Win**: the first full cartón (all 16) calls ¡Lotería!; simultaneous completions go to more points; equal points share.
- Cartones are 4×4 pictures only; no two cartones in a room share more than 8 cards.

Full detail: [rules.md](rules.md) §1–§9. Decision record: [0004](decisions/0004-rules-spelling-picks-points-full-card.md).

### 3.4 Languages and audio

- **App language** (Español, English) and **spoken language** (Náhuatl, Maya yucateco, Quechua Cusco-Collao, Español, English) are separate per-player settings, changeable mid-round without losing progress ([0005](decisions/0005-ui-language-separate-from-spoken-language.md)).
- All five languages are offered and treated as verified for v1.0 ([0007](decisions/0007-all-five-languages-treated-as-verified.md)); the provenance gap is tracked in the backlog (DEBT-014).
- **Audio**: pre-recorded Meta MMS-TTS clips for all 54 cards × 5 languages (270 clips, `public/audio/{lang}/{id}.m4a`), credited on `/creditos` ([0008](decisions/0008-mms-tts-audio-for-all-languages.md)).

### 3.5 Solo mode

`/solo`: one player against 1+ computer players on one device, no network. Levels Fácil / Normal / Difícil change computer accuracy and reaction time. No language model ([0012](decisions/0012-solo-mode-vs-cpu-no-in-browser-llm.md)).

### 3.6 Look, feel and accessibility

- "Feria de noche" design system; themes **auto, light, dark, high-contrast** from a theme switch in the shell ([0013](decisions/0013-themes-and-design-system-enforcement.md)).
- Mobile first (390 × 844), then tablet (768) and laptop (1280). WCAG 2.2 AA target: keyboard operable, visible focus ≥ 3:1, 44 px targets, reduced motion respected, state never shown by colour alone.

### 3.7 Public pages, SEO and sharing

- Prerendered public pages (`/`, `/solo`, `/deck`, `/creditos`, `/print`) with meta, Open Graph and JSON-LD; `robots.txt`, `sitemap.xml`, `llms.txt`; private routes (`/host`, `/r/*`, `/ui`) are `noindex`; a real 404 ([0001](decisions/0001-vite-spa-pwa-on-vercel-prerendered.md)).
- Installable PWA; shell, content, art and audio precached (6.7 MB of a 10 MB budget).

### 3.8 Platform

Vercel (static PWA + `api/*` Functions), Supabase Realtime broadcast for rooms with the organiser's device as the only authority and ECDSA-signed host messages, Upstash Redis for the room key registry and rate limits, Supabase Postgres as the only database ([0002](decisions/0002-realtime-broadcast-host-authority-signed-messages.md), [0003](decisions/0003-upstash-and-supabase-postgres-only.md)). Without Supabase credentials the app falls back to a same-browser transport for dev and e2e.

## 4. Non-goals (v1.0)

- **Money, prizes, betting** or any copy that frames them (rules §9.5).
- **Accounts**, profiles or server-side storage of names, cartones or marks.
- **Rankings across rounds**, leaderboards, streaks.
- **In-browser language model** for solo mode, hints or banter — evaluated and rejected for now ([evaluation](evaluations/solo-mode-slm.md)).
- **AI-generated Indigenous-language text** of any kind.
- **Printing in the online game.** Paper cartones are a separate classroom mode, not mixed into an online round.
- Figures/patterns (line, corners…) as win conditions; manual "next card"; native apps; chat.

## 5. Success measures

| Measure | Target | How measured |
| --- | --- | --- |
| Time to gather a room | Organiser has a room open in < 30 s; a player holds a cartón < 30 s after scanning | Manual timing on real phones; e2e lobby flow |
| Round completes for 2–20 players | 0 lost calls, 0 invariant violations | `loadtest/` report (`pass: true`) |
| Language practice happens | Most players pick on most calls | Anonymous counters (`/api/metrics`, honours DNT/GPC) |
| Rooms come back | "Otra ronda" used in a majority of rooms | Anonymous counters |
| Accessibility | axe: no serious violations on home, host, player; contrast ≥ 4.5:1 text, ≥ 3:1 controls in every theme | `pnpm e2e`, `pnpm design-lint` |
| Weight | Precache < 10 MB; no single precached file > 3 MB | Build output (`sw.js` manifest) |
| Quality gate | `pnpm check && pnpm build` green on every deploy | Vercel build command ([0014](decisions/0014-deploy-gate-and-rollback.md)) |

## 6. Constraints

- **Non-commercial.** Meta MMS-TTS voices are CC-BY-NC 4.0. The app stays free, ad-free and non-commercial while it ships these clips, and credits them on `/creditos`.
- **Honesty about Indigenous words.** Never invent Náhuatl, Maya or Quechua words; names come only from `src/content/cards.json`. v1.0 treats all five languages as verified, but the Indigenous names still cite "unverified draft" sources; closing that gap with dictionary citations and native-speaker review is the top backlog item (DEBT-014). Public copy must not claim more review than has happened.
- **Accessibility.** WCAG 2.2 AA is a release requirement, not a nice-to-have.
- **Respectful content.** Cards never show people; copy never uses gendered human roles; copy lint enforces the banned word list.
- **Privacy.** No accounts, no tracking cookies; player names travel only on the room channel.
- **Budget.** Free tiers (Vercel Hobby, Supabase Free Realtime, Upstash free) define the load envelope; see the loadtest findings in the backlog.

## 7. Release history

| Version | Date | Notes |
| --- | --- | --- |
| v1.0 | 2026-10-27 | Baseline described here. Rules v2 (spelling picks, 2/1 points, full card), host modes, solo, themes, SEO/share previews. |
