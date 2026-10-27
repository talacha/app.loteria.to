# Design system: "Feria de noche"

Describes the v1.0 baseline: what the code does today. Values live in `design/tokens.json`; this file explains them and the rules around them. Where this file and the code disagree, the code (and its tests) win; fix this file.

## 1. Principles

- **Feria de noche.** A lotería night fair: printed cards with thick ink borders on an indigo night, flat festival colours, hard drop shadows, no gradients, no blur.
- **Mobile first.** Design width 390 x 844, single column, primary action at the bottom, no horizontal scroll at 360 px. Tablet >= 768: two columns where a screen has a primary and a secondary area. Laptop/projector >= 1280: the cantor screen.
- **Honesty about language.** Every dictionary, draft or AI-voice word shows a review tag (`ReviewTag`). Never hide it to save space. Language is always shown with its name, never by colour alone.
- **No money framing.** Beans ("frijolitos"), never chips or prizes. Nobody "wins": they complete a figure. Enforced by copy-lint.
- Targets >= 44 px (`--size-tap`), primary buttons 60 px, choice tiles >= 96 px. One primary action per screen.

## 2. Sources of truth and enforcement

Order: 1) `design/tokens.json` (values), 2) `src/app/theme/tokens.css` (CSS variables), 3) the approved PDF `docs/design/look-and-feel.pdf` and the Claude Design canvas (screens), 4) behaviour from `docs/rules.md`.

| Check                                            | What it enforces                                                                                                                                                                                                                                                                                                                                                                                                                                             | Run                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| `src/app/theme/tokens.test.ts`                   | Every `tokens.json` token exists in `:root` with the same resolved value; every `theme.light` key matches both `[data-theme='light']` and the `prefers-color-scheme: light` block; contrast floors (section 3) in night, light, auto-light and contrast.                                                                                                                                                                                                      | `pnpm test`                 |
| `scripts/design-lint.ts` (`pnpm design-lint`)    | Scans `src/app/**/*.css` and `style={{}}` literals in `*.tsx` (not `tokens.css`, not tests). Rules: `raw-color` (hex, rgb(a), hsl(a), hwb, lab, lch, oklab, oklch), `named-color` (CSS colour keywords in colour properties; `transparent`, `currentColor`, `inherit` are fine), `font-family` (literals and `font` shorthand without `var()`), `radius` (raw lengths; `0` and `50%` allowed), `shadow` (only `var(--shadow-*)`, `none`, or zero-blur offset/ring in a token colour), `theme-text-on-ground`. | `pnpm design-lint`          |
| `theme-text-on-ground` (inside design-lint)      | `color: var(--paper)`, `--color-paper`, `--muted-on-night`, `--color-maiz` are dark-only. Unless the same rule paints a coloured fill (maiz, rosa, cielo, jade, maya, quechua, ink, paper, chile, bean, shadow, `--lang-*`) the text sits on the ground and must use `--color-text`, `--color-muted-on-night` or `--color-accent-text`.                                                                                                                         | `pnpm design-lint`          |
| `scripts/copy-lint.ts` (`pnpm copy-lint`)        | Lints every string in `src/content/i18n/*.json`, `src/app/**/strings.*.json`, `src/print/strings.*.json`, `cards.json`. Rules: `gendered-role-es` (jugador/a, ganador/a, niño/a, alumno/a, maestro/a and plurals), `gendered-pronoun-en` (he, she, him, his...), `winning-es` (gana, ganar, ganó...), `winning-en` (win, won, winner...), `framing` (premio, prize, apuesta, bet, chips and similar money/betting words). A fixed-phrase `ALLOWLIST` exempts innocent uses; keys named `pronoun*` are skipped. | `pnpm copy-lint`            |
| `src/app/ui/ui.test.tsx`, `pnpm lint`, `pnpm check` | Component behaviour; ESLint + Prettier; `check` runs the full gate including design-lint.                                                                                                                                                                                                                                                                                                                                                            | `pnpm test`, `pnpm check`   |

In component CSS use tokens only. Build screens from `src/app/ui/`; extend a primitive instead of recreating a button, pill or panel locally.

## 3. Themes

Four preferences (`ThemePref` in `src/app/theme/prefs.ts`): `auto` (default), `dark`, `light`, `contrast`.

- **Selection:** `<html data-theme>`. Absent = auto: dark `:root` tokens, overridden by `@media (prefers-color-scheme: light) { :root:not([data-theme]) {...} }`. `dark` sets `data-theme="dark"` (no overrides). `light` and `contrast` have their own `:root[data-theme=...]` blocks.
- **Persistence:** `localStorage['loteria:theme']` (legacy `loteria.theme` is read as fallback); an inline script in `index.html` applies it before first paint. Storage errors are swallowed (preference lasts for the visit). UI switch: `ThemeSwitch` in `src/app/theme/Preferences.tsx` (radiogroup). `PlayerBoard` temporarily forces `contrast` when the player turns on its high-contrast board option and restores the previous theme on exit.
- **Tokens that change:**
  - Light: `night #F6E9CC`, `night-raised #FFFFFF`, `night-line #CDBF9E`, `night-dash #6E6AA6`, `shadow #16182F`, `muted-on-night #4A4766`, `text #16182F`, `accent-text #8A5A00`, `disabled-on-night #DDD3BA`, `focus #8A5A00`. Paper cards, ink, maiz and language colours do not change.
  - Contrast (CSS only, not in tokens.json): `night/night-raised #000`, `night-line/night-dash #FFF`, `paper #FFF`, `ink #000`, `shadow #FFF`, `muted-on-night #FFF`, `muted-on-paper #000`, `text #FFF`, `accent-text/focus #FFC233`, `jade-soft #FFF`, `disabled-on-night #000`.
- **Floors measured by `tokens.test.ts`** (night, light, auto-light, contrast): text pairs >= 4.5 (paper/text/muted on night and night-raised, ink on paper/white/maiz/maiz-soft/jade-soft/jade, muted-on-paper on paper/white, accent-text on both grounds, paper on maya/quechua/cielo/rosa); large display text >= 3 (ink and paper on rosa are asserted at 3 and also 4.5 for paper on rosa); UI parts >= 3 (ink border on paper/white/maiz; night-dash on night and night-raised). **Boundaries and focus:** `night-dash` >= 3 on night and night-raised in every theme; `focus` >= 3 on night and night-raised; on paper/white either the focus ring or the ink halo >= 3. On the light ground maiz and paper are never text on a ground (use `text`/`accent-text`).

## 4. Tokens

All are CSS custom properties named `--<group>-<name>` in `tokens.css` (`:root`, dark values).

**Colour** (`--color-*`): night `#1E2142` ground; night-raised `#2A2E58` panels; night-line `#45497F` dividers/progress track; night-dash `#8581BD` dashed hint outline; ink `#16182F` every border and text on paper; paper `#FFF6E5` cards, text on night; white `#FFFFFF` tabla cells, glyph wells, QR ground; shadow `#0C0D1E`; muted-on-night `#C9C3E6` (>= 7:1); muted-on-paper `#4A4766` (>= 7:1); maiz `#FFC233` primary action, self tile, winning cells; maiz-soft `#FFE08A` review tag; rosa `#D0126B` Español and the ¡Lotería! ground; jade `#0E9F7E` Náhuatl, correct, connected; jade-soft `#C9F2E4` correct tile; cielo `#2A64D6` English (PDF had `#2F6FE4`, darkened so paper text reaches 5.0:1); maya `#7A4BD6`; quechua `#C2410C`; chile `#E2412B` card art only, never UI state; bean `#6B2F23`, bean-dark `#4A1F16`, bean-light `#8A4A3A`; disabled-on-night `#3A3E6A` wrong/dimmed tile.

**Semantic text and focus:** `--color-text` = paper (ink on light); `--color-accent-text` = maiz (`#8A5A00` on light); `--color-focus` = maiz (`#8A5A00` on light). Global rule: `:focus-visible { outline: 3px solid var(--color-focus); outline-offset: 2px; box-shadow: 0 0 0 5px var(--color-ink) }`.

**Language** (`--lang-*`): nah = jade, yua = maya, quz = quechua, es = rosa, en = cielo.

| Group          | Tokens                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--font-*`     | display `'Bricolage Grotesque', 'Atkinson Hyperlegible', system-ui, sans-serif` (600/800); ui `'Atkinson Hyperlegible', system-ui, sans-serif` (400/700)                                                  |
| `--text-*`     | xs 11 (never smaller) · sm 13 · md 15 · base 16 · lg 18 · xl 22 · 2xl 30 · 3xl 36 · word 38 · code 40 · hero 64 (px)                                                                                   |
| `--space-*`    | 1 4 · 2 8 · 3 12 · 4 16 · 5 20 · 6 24 · 8 32 (px)                                                                                                                                                       |
| `--radius-*`   | xs 10 · sm 12 · md 16 · lg 20 · xl 24 · pill 999 (px)                                                                                                                                                   |
| `--border-*`   | thick `3px solid ink` (cards, buttons, tiles, panels) · thin `2px solid ink` (pills, tags, cells) · dashed `2px dashed night-dash` (neutral hint panels)                                                |
| `--shadow-*`   | hard `0 5px 0 shadow` · hard-sm `0 4px 0` · hard-lg `0 6px 0` (hero cards)                                                                                                                              |
| `--size-*`     | tap 44 · button 60 · choice 96 · phone 390 · tablet 768 · laptop 1280 (px)                                                                                                                              |
| `--motion-*`   | press `translateY(3px)` (pressed/disabled: shadow removed + offset) · lift `translateY(-2px)` (selected)                                                                                                |

`tokens.css` also holds values not in `tokens.json`: `--border-w: 3px`, `--text-call: clamp(3rem, 12vw, 9rem)` (called word on the host screen), and a block of **deprecated aliases** (`--night`, `--paper`, `--ink`, `--maiz`, `--jade`, `--tap`, `--shadow`, `--color-bg`, `--color-surface`, `--color-accent`, `--color-border`, `--lang-maya`, `--lang-quechua`, ...) kept until all screens use the canonical names. Do not use aliases in new code. `prefers-reduced-motion: reduce` clamps all animation/transition durations to 0.01ms. `.sr-only` and `.skip-link` live in `tokens.css`.

## 5. Typography

Bricolage Grotesque (variable, weights 600-800, tracking -0.02em on `h1-h3`) for titles, words, codes and buttons. Atkinson Hyperlegible 400/700 for everything else. Both self-hosted in `public/fonts/` as `woff2`, split into `latin` and `latin-ext` subsets with `unicode-range` and `font-display: swap`: `bricolage-grotesque-var-{latin,latin-ext}.woff2`, `atkinson-hyperlegible-{400,700}-{latin,latin-ext}.woff2` (licences in `public/fonts/LICENSES.md`). `index.html` preloads `bricolage-grotesque-var-latin.woff2` and `atkinson-hyperlegible-400-latin.woff2` (`crossorigin`). `NotoSans-Regular.ttf` in that folder is for generated assets, not the web UI. No other fonts.

## 6. Components (`src/app/ui/`, exported from `index.ts`)

| Component | Purpose / key props | States and a11y |
| --- | --- | --- |
| `Button` | `variant` primary (maiz, 60 px) / secondary (paper) / link (accent text, 44 px); `icon` (decorative), `fit`, `loading`; renders `<button>`, router `<Link>` when `to`, or `<a download>` when `href` | `disabled`/`loading` = pressed look, no shadow; `loading` sets `aria-busy` and shows a spinner; default `type="button"` |
| `Pill` | `tone` paper, night, jade, nah, yua, quz, es, en; `dot` | Always carries text (language name) |
| `ReviewTag` | `variant` word, words, ai ("palabra en revisión", plural, "voz generada por IA") | Always visible |
| `Panel` | `variant` default/dashed, `as`, `id`, `aria-labelledby` | Dashed = neutral hint, no shadow |
| `PaperCard` | `size` md/lg, `as` | Ink text on paper |
| `ProgressBar` | `value` 0-1, `tone` maiz/jade, `label` | `role="progressbar"` with aria-valuenow |
| `PapelPicado` | decorative flag band (win/cantor screens) | `aria-hidden` |
| `LanguageCard` | `lang`, `name`, `native`, `sample`, `review`, `selected`, `onSelect`, `disabled` | `role="radio"` + `aria-checked`; wrap in `role="radiogroup"`; selected = 4 px language ring + lift + check; name always shown |
| `LanguageSettings` | UI language (es/en) and spoken-language radiogroups with a play-sample button; reads/writes `useProfile` | Both groups labelled; `role="status"` note |
| `RoomCodeTiles` | `code`, `label` (maiz glyph tiles) | `role="img"` with spaced code label |
| `RosterTile` | `name`, `glyph`, `detail`, `self` | Self = maiz fill |
| `CallPanel` | `word`, `listening`, `review`, `progress`, `onReplay` | Word in `aria-live="polite"`; replay button labelled; listening replaces the word |
| `ChoiceTile` | `id`, `emoji` (fallback), `label`, `state` idle/correct/wrong, `disabled`, `onChoose` | `aria-label` appends state; correct = check badge, wrong = cross badge + dimmed (not colour-only) |
| `FeedbackStrip` | `tone` neutral/ok/casi, `title` | `role="status"`; "¡Casi!" is maiz, never red |
| `Tabla` / `TablaCell` | `cells: CellData[]` (`id`, `emoji`, `label`, `marked`, `winning`), `onToggle`, `label` | Cells are buttons with `aria-pressed` when interactive; bean marker; winning = maiz fill; board `<ul>` labelled |
| `QrCard` | `url`, `code`, `caption`; QR with `QR_QUIET = 4` module quiet zone on white | QR `role="img"` labelled with the URL |
| `WordCard` | `word`, `langName`, `tone`, `review`, `verse` | Language pill + review tag |
| `HistoryStrip` | `items`, `title` ("Ya cantadas") | Tiles have `sr-only` labels |
| `CardArt` | `id`, `emoji`, `className` | `<img src=/art/id.svg alt="" loading=lazy>`; falls back to the emoji on load error; decorative |
| `Sheet` | modal bottom sheet `title`, `open`, `onClose` | `role="dialog" aria-modal`; focus to close button; Escape/backdrop close; focus returns to opener |
| `useProfile` | `{ uiLang, spokenLang, update }` persisted in `localStorage['loteria:profile']` | n/a |

`Gallery` (`/ui`) renders every primitive and state for visual review, in the current theme.

## 7. Screens

PDF page / canvas board numbers follow `design/look-and-feel/project/canvas.json`.

| Route | Screen (code) | Reference |
| --- | --- | --- |
| `/` | `HomePage`: logo, "¿Cómo te llamas?", glyph picker, Crear una sala, join code + scan, print link, footer | PDF screen 1, board `Main.dc.html` |
| (in game flow) | Language: `LanguagePicker` / `LanguageCard`s, Escucha option, "Jugar en {idioma}" | PDF p.1, `Language.dc.html` |
| `/r/:code` | `JoinPage` + `LobbyWaiting`, `Roster` (waiting room, code tiles, roster, invite hint) | PDF p.2, `Lobby.dc.html` |
| `/host` | `HostPage` + `HostLobby`: QR + code + roster; screen use mode "Display only" / "Play too"; then `HostGame` (cantor screen: WordCard per language, timer, QrCard, progress, HistoryStrip) | PDF p.5, `Caller.dc.html` |
| `/r/:code` in game | `PlayerGame`/`PlayerBoard`: CallPanel, three ChoiceTiles, FeedbackStrip, Tabla, `SettingsSheet` | PDF p.3, `Play.dc.html` |
| (round end) | `WinScreen`: rosa ground, PapelPicado, "¡Lotería!", winning Tabla, "Otra ronda" | PDF p.4, `Win.dc.html` |
| `/solo` | `SoloPage`/`SoloGame`: one-person play against the automatic cantor | no PDF page; same primitives |
| `/deck` | `DeckPage`: browse cards and words | no PDF page |
| `/print` | `PrintPage`: printable paper boards for classrooms (printed palette, not themed) | no PDF page |
| `/creditos` | `CreditsPage` | none |
| `/ui` | `Gallery` | dev review |
| `*` | `NotFound` (real 404) | none |

**Intentional differences from the PDF:** `cielo` is `#2A64D6` (PDF `#2F6FE4`); light and high-contrast themes and the visible focus ring do not exist in the PDF; card pictures use the SVG set with an emoji fallback; the host screen adds the display/play mode choice; the PDF mentions tie-break points only if the rules use them. The PDF could not be re-read for this revision (no PDF renderer in the environment); page numbers come from the previous guide and canvas board titles.

## 8. Iconography and card art

- UI icons: inline stroke SVG, 2-2.5 px, round caps, decorative ones `aria-hidden`. No emoji in UI chrome (emoji appear only as the `CardArt` fallback and in the tabla).
- Card art: `public/art/<cardId>.svg`, `viewBox 0 0 120 120`, flat fills in the festival palette, ink `#16182F` stroke 5 with round joins and caps, no text, no human figures. `chile` red is art-only. Sixteen files today (aguacate, chile, colibri, estrella, frijol, jaguar, luna, maiz, mariposa, montana, nopal, nube, rana, sol, tomate, tortuga); `design/look-and-feel/art/` mirrors them.
- **Add a card:** add the card to `src/content/cards.json` (with its `art` emoji fallback) and strings, draw `public/art/<id>.svg` to the rules above, copy it to `design/look-and-feel/art/`, run `pnpm test` (content tests) and `pnpm copy-lint`, and check it at `/ui` and `/deck`.

## 9. Share images

`public/og/default.png` and `public/og/invite.png` (1200 x 630) are rendered from `design/og/og.html` (`?variant=default|invite`; invite shows a different set of marked cells). Regenerate with `pnpm og:render` (Playwright Chromium, `scripts/render-og.mjs`) and commit the PNGs. The page meta and JSON-LD that reference them live in `src/app/seo/`. See `design/README.md`.

## 10. Writing and tone

Spanish first, English second; warm and short. "Frijolitos", never chips/fichas. Banned (copy-lint): gendered human roles in Spanish (jugador/a, ganador/a, niño/a, alumno/a, maestro/a), generic he/she in English, winning framing ("gana", "win"; say "completar la figura" / "complete the pattern"), and prize/bet/money words. **"El cantor" is the app's automatic voice**; the person who creates the room is "quien organiza" / "the organiser". Neutral phrases: "quien juega", "persona", "las infancias". Every Indigenous word shows its review state.

## 11. Accessibility checklist (WCAG 2.2 AA)

- [ ] Text >= 4.5:1, large text >= 3, UI parts and focus >= 3 in all four themes (`pnpm test`, tokens.test.ts).
- [ ] Focus visible on every control (3 px ring plus ink halo); no `outline: none` without replacement.
- [ ] Targets >= 44 px (24 px minimum by WCAG; we hold 44).
- [ ] Language and state never by colour alone (name text, check/cross badges, review tags).
- [ ] Real `<button>`, `<a>`, `<label>`; one `#main` per screen; skip link present.
- [ ] Live regions announce calls (`CallPanel` `aria-live`, `FeedbackStrip` `role="status"`).
- [ ] `prefers-reduced-motion` respected; no flashing.
- [ ] Dialogs trap and restore focus (`Sheet`); Escape closes.
- [ ] 360 px wide, 200% zoom and text-spacing checks: no clipping or horizontal scroll.
- [ ] Tools: `pnpm test`, `pnpm design-lint`, `pnpm copy-lint`, keyboard-only pass, VoiceOver/TalkBack pass, browser devtools contrast and forced-colours emulation.

## 12. How to change the design

1. Edit `design/tokens.json` first (for light overrides use `theme.light`; high contrast is CSS-only).
2. Mirror in `src/app/theme/tokens.css` (`:root`, and both light blocks: `[data-theme='light']` and the `prefers-color-scheme: light` block).
3. `pnpm test` (parity + contrast) then `pnpm design-lint` and `pnpm copy-lint`; fix findings in components, never by loosening a rule without discussion.
4. Update the canvas mirror in `design/look-and-feel/project/*.dc.html` (and `canvas.json`) and this file. The canvas artifact is republished separately: https://claude.ai/artifact/CanBtUc4RQzxzPZE2BEgWc.
5. Regenerate share images with `pnpm og:render` if branding or palette changed.
6. Add or change a primitive in `src/app/ui/`, show it in `Gallery`, add it to section 6.
