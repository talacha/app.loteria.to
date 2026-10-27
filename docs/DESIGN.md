# Design: "Feria de noche"

**Source of truth for look and feel.** Every UI change follows this file and the Claude Design canvas.

- **Canvas (Claude Design artifact):** https://claude.ai/artifact/CanBtUc4RQzxzPZE2BEgWc
  Read it with the Artifact tool (`action: "read"`, `url` above; one artboard with `path: "project/Play.dc.html"`). Never WebFetch or curl it.
- **Same source in the repo (always available, no artifact access needed):** `design/look-and-feel/project/*.dc.html`, the index `design/look-and-feel/project/canvas.json`, and card art `design/look-and-feel/art/*.svg`.
- **Changing the design:** only the orchestrator republishes the canvas. Builders propose changes in their report; they don't publish to the artifact.

## Artboards → app screens

| Artboard | Screen | App owner dir |
|---|---|---|
| `Main.dc.html` 1 · Elige tu idioma | language picker before joining (Náhuatl / Español / English, Escucha toggle) | `src/app/join/` |
| `Lobby.dc.html` 2 · Sala de espera | player lobby: room code tiles, connection pill, roster grid, invite hint | `src/app/join/`, `src/app/lobby/` |
| `Play.dc.html` 3 · El cantor canta | call panel + "¿Cuál es?" three-choice claim + 4×4 tabla with beans | `src/app/game/` (rules come from `docs/rules.md`) |
| `Win.dc.html` 4 · ¡Lotería! | celebration | `src/app/game/` |
| `Caller.dc.html` 5 · Pantalla del cantor | laptop/projector host screen | `src/app/host/`, `src/app/game/HostGame.tsx` |

## Tokens (map into `src/app/theme/tokens.css`; keep existing variable names, add these)

| Token | Value | Use |
|---|---|---|
| night | `#1E2142` | app ground |
| night-raised | `#2A2E58` | panels on the ground |
| ink | `#16182F` | all borders, text on paper |
| paper | `#FFF6E5` | card faces, text on night |
| shadow | `#0C0D1E` | hard drop shadow `0 5px 0` |
| muted-on-night | `#C9C3E6` | secondary text on night (passes 4.5:1) |
| muted-on-paper | `#4A4766` | secondary text on paper |
| maiz | `#FFC233` | primary action, highlights, code tiles |
| rosa | `#E5177E` | Español, ¡Lotería! button |
| jade | `#0E9F7E` | Náhuatl, correct answer, connected |
| cielo | `#2F6FE4` | English |
| chile | `#E2412B` | art only |
| review | `#FFE08A` | "palabra en revisión" tag |
| bean | `#6B2F23` | the bean marker |

Language colours: Náhuatl = jade, Español = rosa, English = cielo. Always pair the colour with the language name (never colour alone).

## Type
- Display: **Bricolage Grotesque** 800 (titles, card words, code tiles, buttons).
- Body: **Atkinson Hyperlegible** 400/700 (everything else; chosen for low-vision and young readers).
- Self-host both (OFL) under `public/fonts/` and add them to the precache, like Noto Sans.

## Shape and components
- Thick ink borders (3 px; 2 px on small chips), radius 12–24 px, hard drop shadow `0 5px 0 #0C0D1E` instead of soft shadows. Pressed/disabled = shadow removed + `translateY(3px)`.
- Primary button: maiz fill, ink text, min-height 56–60 px, full width on phone.
- Choice tiles: square, paper fill, picture only (no word — the point is to listen). Correct = jade ring + check badge; wrong = dimmed, pressed, disabled; then a second try.
- Feedback strip (role=status): neutral dashed / correct jade "¡Eso!" / gentle maiz "¡Casi!". Never red, never a penalty.
- Tabla: paper board, 4×4 white cells with picture + small label in the player's language; bean = brown oval overlay; completed line cells turn maiz.
- Card art: flat SVG, ink stroke 5 on a 120 viewBox, festival palette. No emoji in final art (emoji are interim placeholders in `cards.json`).
- Icons: inline stroke SVG; decorative ones `aria-hidden`.

## Rules
- Mobile first: design at 390×844, then 768 (tablet) and 1280 (laptop/projector).
- 44 px minimum targets; text contrast ≥ 4.5:1; real `<button>`/`<a>`/`<label>`.
- Indigenous-language words only from `cards.json`, always with the review tag until approved. Never invent words.
- Tone: "frijolitos", no money/prize framing, no gendered human roles.
