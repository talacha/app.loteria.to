# Design guide: "Feria de noche"

**Binding for every agent and every UI change.** A lotería night fair: printed cards with thick ink borders on an indigo night, flat festival colours, hard drop shadows.

## 1. Sources (in order)

1. **`docs/design/look-and-feel.pdf`** — the approved screens. When this guide and the PDF disagree, the PDF wins; fix this guide.
2. **`design/tokens.json`** — every colour, size, radius, border, shadow and font. The only place values are defined.
3. **Claude Design canvas** https://claude.ai/artifact/CanBtUc4RQzxzPZE2BEgWc (read with the Artifact tool, `action: "read"`), mirrored in `design/look-and-feel/project/*.dc.html`. Only the orchestrator republishes it.
4. Behaviour (what a tap does, who wins) comes from **`docs/rules.md`** (the PDF game: automatic cantor, three picture choices when the card is on your tabla). `docs/reglas.md` is César's rules reference. Never from this guide.

## 2. Tokens and enforcement

- `design/tokens.json` → `src/app/theme/tokens.css` defines each token as a CSS variable: `--color-<name>`, `--lang-<code>`, `--font-<name>`, `--text-<step>`, `--space-<step>`, `--radius-<name>`, `--border-<name>`, `--shadow-<name>`, `--size-<name>`, `--motion-<name>`. A test fails if `tokens.css` and `tokens.json` drift.
- **In component CSS you may only use tokens.** `pnpm design-lint` (part of `pnpm check`) fails on: raw hex/rgb/hsl colours, `font-family` literals, raw `border-radius` px values, `box-shadow` that isn't a token, and colour keywords other than `transparent`/`currentColor`/`inherit`. Only `tokens.css` and `design/**` may contain raw values.
- **Build screens from `src/app/ui/` primitives** (§5). Don't re-create a button, pill, panel or tile locally; extend the primitive instead.
- Legacy `--color-*` names that predate this guide are aliases kept only until every screen is migrated.

## 3. Foundations

| | Rule |
|---|---|
| Ground | `--color-night` everywhere; panels on it use `--color-night-raised`. |
| Surfaces | Cards are `--color-paper` with `--border-thick` and `--shadow-hard`; text on them is `--color-ink`. |
| Text on night | `--color-paper`; secondary `--color-muted-on-night`. Never grey-on-night below 4.5:1. |
| Type | Display: Bricolage Grotesque 800, tight tracking (−0.02em) for titles, words, codes, buttons. UI: Atkinson Hyperlegible 400/700 for everything else. Self-hosted in `public/fonts/`. |
| Scale (phone) | hero 64 · code 40 · word 38 · 3xl 36 · 2xl 30 · xl 22 · lg 18 · base 16 · md 15 · sm 13 · xs 11 (minimum). |
| Spacing | 4 · 8 · 12 · 16 · 20 · 24 · 32. Screen padding 20 px phone (16 on dense game screens), 32 px laptop. |
| Shape | Radius: cells 12, inputs/strips 16, tiles/board 20, cards 24, pills 999. Borders always ink: 3 px on cards/buttons/tiles, 2 px on pills, tags, tabla cells. |
| Depth | Only hard shadows (`0 5px 0` shadow colour). No blur shadows, no gradients. Pressed or disabled = shadow removed + `--motion-press`. Selected = `--motion-lift` + a 4 px coloured ring in the language/state colour. |
| Icons | Inline stroke SVG, 2–2.5 px, round caps; decorative ones `aria-hidden`. No emoji in UI chrome. |
| Card art | Flat SVG at `public/art/<cardId>.svg`: 120 viewBox, ink stroke 5, festival palette, no text, no human figures. `chile` red is art-only. |
| Language colour | nah jade · yua maya · quz quechua · es rosa · en cielo. **Always paired with the language name** (never colour alone). |
| Review honesty | Any dictionary/AI-voice or draft word shows the review tag (§5 `ReviewTag`). Never hide it to save space. |

## 4. Layout and breakpoints

- **Mobile first at 390 × 844.** Single column, primary action pinned at the bottom of the viewport, no horizontal scroll at 360 px.
- **Tablet ≥ 768:** two columns where a screen has a primary and a secondary area (lobby: code + roster; host: QR + roster/settings).
- **Laptop/projector ≥ 1280:** the caller screen (PDF p.5): main column + 340 px side column, header row with controls, history strip at the bottom.
- Targets ≥ 44 px (`--size-tap`); primary buttons 60 px (`--size-button`); choice tiles ≥ 96 px.

## 5. Components (`src/app/ui/`)

| Component | Anatomy (from the PDF) | States |
|---|---|---|
| `Button` variant `primary` | maiz fill, ink text 21–22 px display 800, `--border-thick`, `--radius-lg`, `--shadow-hard`, full width on phone, min-height 60 | hover darker shadow; pressed/disabled = press offset, no shadow; `aria-busy` while waiting |
| `Button` variant `secondary` | paper fill, ink text, same border/shadow, min-height 56 | as primary |
| `Button` variant `link` | maiz text on night, 15–16 px, min-height 44, optional leading icon | underline on hover |
| `Pill` | 2 px ink border, pill radius, 13–16 px bold; tones: `jade` (Conectado / Náhuatl), `lang-*`, `paper`, `night` | — |
| `ReviewTag` | maiz-soft fill, 2 px ink border, pill, 11–14 px bold ink: "palabra en revisión" / "Palabras en revisión por hablantes" / "voz generada por IA · puede tener errores" (D1) | always visible |
| `Panel` | night-raised fill, 3 px ink border, radius 22–24, hard shadow; variant `dashed` (neutral hint: 2 px dashed night-dash, no shadow) | — |
| `PaperCard` | paper fill, ink text, 3 px border, radius 24, hard shadow (lg for hero) | — |
| `LanguageCard` (PDF p.1) | PaperCard row: 60 px coloured square with sun art, name (display 22), native + sample «word», optional ReviewTag, 30 px radio dot | selected: 4 px ring in language colour + lift + filled dot with check |
| `RoomCodeTiles` (p.2) | five maiz tiles, ink border, radius 12, display 800 40 px, gap 6; label "SALA" (14 px caps muted-on-paper) | — |
| `RosterTile` (p.2) | 2-col grid; paper tile, 3 px border, radius 16; 44 px white glyph well; name bold 16 + language/"tabla de papel" 12 | self tile maiz fill + "Tú ·" prefix |
| `CallPanel` (p.3) | Panel row: 64 px maiz round speaker button with soft halo rings, "EL CANTOR CANTA" 13 px caps muted, word display 800 38 px, ReviewTag, timer bar (night-line track, maiz fill) | Escucha: word replaced by "Escucha…" |
| `ChoiceTile` (p.3) | square paper tile, 3 px border, radius 20, art 70 px, picture only | correct: jade-soft fill + 4 px jade ring + jade check badge; wrong: disabled-on-night fill, 45% opacity, pressed; disabled |
| `FeedbackStrip` (p.3) | radius 16, min-height 52; title display 18 + text 14 | neutral: dashed night-raised; ok: jade fill paper text "¡Eso!"; casi: maiz fill ink text "¡Casi!" (never red) |
| `Tabla` + `TablaCell` (p.3) | paper board, 3 px border, radius 20, padding 8, gap 6, hard shadow; cells white, 2 px border, radius 12, art 52–56 px, label 10–11 px bold (name in player's language) | marked: bean (22×15 oval, bean colours, corner, rotated) + art at 55% opacity; winning line: maiz cell fill |
| `PapelPicado` (p.4) | top band of 6 flag shapes (maiz, jade, cielo, paper, maiz, jade) | — |
| `QrCard` (p.5) | PaperCard with white QR square (3 px border, radius 12), "Únete en app.loteria.to", code display 800 38 px tracked 0.12em | — |
| `WordCard` (p.5) | tall PaperCard, 4 px border, radius 28, Pill (language) top, word display 800 50–64 px nowrap, ReviewTag or verse footer | — |
| `HistoryStrip` (p.5) | "Ya cantadas" + 64 px paper tiles with art 48 px | — |
| `ProgressBar` | night-line track, radius pill, fill maiz (time) or jade (progress) | — |

## 6. Screens (PDF pages)

| Screen | PDF | Must have |
|---|---|---|
| 1 · Name + create/join | canvas `Main.dc.html` | logo row, "¿Cómo te llamas?", name input, glyph picker, primary "Crear una sala", "o", join panel (code input + Entrar + scan QR), link "¿Sin teléfono? Imprime tablas de papel", footer "Sin cuentas, sin dinero. Solo frijolitos." |
| 2 · Elige tu idioma | p.1 | header "Paso n de m", title "¿En qué idioma te cantamos?", LanguageCards (all callable languages), Escucha checkbox, primary "Jugar en {idioma}", footer line |
| 3 · Sala de espera | p.2 | "Salir de la sala" link, "Conectado" pill, RoomCodeTiles card with "Jugarás en {idioma}" + ReviewTag, title, Roster count + RosterTiles, dashed invite hint (QR, code, paper option) |
| 4 · Carta cantada | p.3 | header (code, "Carta n de 54", language pill), CallPanel, play area, FeedbackStrip, Tabla. Play-area behaviour follows `docs/reglas.md` |
| 5 · ¡Lotería! | p.4 | rosa ground, PapelPicado, hero "¡Lotería!" with ink text-shadow, "{nombre} completó {figura}", tilted winning Tabla, "Palabras de tu línea" PaperCard with ReviewTag, primary "Otra ronda", link "Volver a la sala" |
| 6 · Pantalla del cantor | p.5 | header (logo, Pausa, speed, automatic pill), "Carta n de 54", one WordCard per room language, timer, side column QrCard + progress Panel (+ tie-break points if the rules use them), HistoryStrip |

## 7. Writing

Spanish first, English second. Warm and short. "Frijolitos", never chips/fichas. No money, prize or betting words. **"El cantor" is the app's automatic voice**; the person who creates the room is "quien organiza" / "the organiser". No gendered human roles. Every Indigenous word shows its review state.

## 8. Accessibility (non-negotiable)

Text ≥ 4.5:1 (UI parts ≥ 3:1), verified by `tokens.test.ts`. Real `<button>`, `<a>`, `<label>`. Language and state never by colour alone. Focus visible (3 px maiz outline). `prefers-reduced-motion` respected. Live regions announce calls. One `#main` per screen.

## 9. Do / don't

- Do: thick ink borders, hard shadows, flat colour, generous type, one primary action per screen.
- Don't: gradients, blur shadows, emoji in chrome, red for errors ("¡Casi!" is maiz), new colours or fonts outside `tokens.json`, hiding review tags.
