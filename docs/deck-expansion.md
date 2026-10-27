# Deck expansion: 54 to 144 cards

**Status (2026-10-27):** production authorized. The selected list retains all original 54 and adds the 90 below, with no reserve swaps. All 144 cards have Spanish and English names, audio and reviewed full-cover images. Current playable coverage is 144 cards in Spanish and English, and 54 in each of Nahuatl, Yucatec Maya and Quechua. The 90 added Indigenous-language entries remain absent from the playable catalog pending source verification and community review. The 144 image files total 4,324,088 bytes; the generated unique PWA precache measures 9,255,794 bytes, within the art and installation budgets. [Decision 0023](decisions/0023-expanded-catalog-and-language-coverage.md) governs release eligibility.
**Goal:** 6 categories x 24 = **144 cards**, so a 20-player room can play 8x8 cartones (needs ≥ 137 cards). The selected catalog has 24 cards per category; the original 54 are retained.
**Inputs:** [PRD.md](PRD.md), [rules.md](rules.md), `src/content/cards.json`, `src/content/drafts/{bzd,cjp}.json` (Bribri and Cabécar drafts, not yet in the deck), `public/art/*.svg`.

Deck size needed for 20 players, by grid (the rule that no two cartones share more than half their cells, [0018](decisions/0018-cartones-share-at-most-eight-cards.md)):

| Grid | 3x3 | 4x4 | 5x5 | 6x6 | 7x7 | 8x8 |
| --- | --- | --- | --- | --- | --- | --- |
| Cards needed | 25 | 37 | 58 | 79 | 108 | 137 |

## 1. Selection criteria

A new card must pass all of these:

1. **Concrete and picturable.** One object, one silhouette, recognisable at 48 px without a label. No abstractions (time, feelings), no colours, no numbers.
2. **Child-friendly.** No weapons, nothing frightening, nothing about death, illness or alcohol.
3. **No human figures, body parts or gendered roles.** No "la mujer", "el pescador", hands or faces. Objects are drawn alone, never held.
4. **Not sacred or ritual.** No ceremonial objects, deities, sacred places or ritual plants in any of the source cultures (examples from the drafts: Bribri healers' stones, *Sibö̀* compounds, the jaguar-illness compounds, cacao as a Bribri ceremonial drink). Owls are left out (bad omen in Mesoamerica and Talamanca). Where an everyday noun has a sacred double (mushroom, sky, hearth stones), the card depicts the everyday thing and the risk is flagged.
5. **Shared across the three regions.** Found, made or used in Mesoamerica, the Andes **and** Talamanca. Region-only items (nopal, llama, condor, volcano) are what made the Bribri/Cabécar gaps; new cards avoid them.
6. **Most likely to have an attested word in all five Indigenous languages.** Prefer core vocabulary: items on the Swadesh 100/207 lists or the Leipzig–Jakarta list (fish, dog, tree, leaf, root, egg, stone, sand, fire, smoke, ash, rope, path, river, snow), native fauna and crops of all three regions, and household items documented in pictographic dictionaries (DIPALICORI's *Ù. Diccionario pictográfico de la casa tradicional bribri*). Avoid institutions and modern buildings (library, observatory, school): they produce coinages or Spanish loans.
7. **Visually distinct** from the existing 54 and from each other. Every known confusion pair is listed in the table; high-risk pairs are resolved in the art (§4) or the card moves to the reserve.
8. **No word collisions.** If one language uses the same word for two cards (e.g. Náhuatl *tianquiztli* is already "plaza", so "mercado" was not proposed), only one can stay.

## 2. Proposed new cards (90)

Risk: **L** = expected attested in all five Indigenous languages and visually clear; **M** = one language likely missing, a loan, or a confusion pair to resolve in art; **H** = two or more languages likely missing, or a strong confusion pair. "Why attestable" is a reason to expect a word, **not** a finding: no Indigenous word is proposed in this document.

| # | id | es | en | category | Why likely attestable | Visual distinctness (confusable with) | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | perro | El Perro | The Dog | animals | Swadesh 100, Leipzig–Jakarta | jaguar: draw floppy ears, wagging tail | L |
| 2 | pez | El Pez | The Fish | animals | Swadesh 100, LJ | mar (keep fish alone, no waves) | L |
| 3 | venado | El Venado | The Deer | animals | Native deer in all three regions (white-tailed, taruka) | llama: antlers, short tail | L |
| 4 | mono | El Mono | The Monkey | animals | Native in Mesoamerica and Talamanca; Quechua has an Amazonian term | none | M |
| 5 | murcielago | El Murciélago | The Bat | animals | Native everywhere; in DIPALICORI animals list | mariposa (wings): dark, membranous, upside down | M |
| 6 | hormiga | La Hormiga | The Ant | animals | Leipzig–Jakarta "ant" | hormiguero (word collision likely) | L |
| 7 | abeja | La Abeja | The Bee | animals | Stingless bees kept by Maya, known in Talamanca and Andes | mariposa, colibri (small flyers) | L |
| 8 | arana | La Araña | The Spider | animals | Universal fauna | telarana: spider without web | L |
| 9 | caracol | El Caracol | The Snail | animals | Land snails everywhere | tortuga (shell); draw land snail, never the conch trumpet | L |
| 10 | cangrejo | El Cangrejo | The Crab | animals | River and sea crabs in all regions | none | M |
| 11 | armadillo | El Armadillo | The Armadillo | animals | Native in Mexico, Yucatán, Talamanca, Andes | tortuga (shell): banded, long snout | L |
| 12 | lagartija | La Lagartija | The Lizard | animals | Generic lizard covers highland and lowland species | serpiente: four legs, upright pose | L |
| 13 | perico | El Perico | The Parrot | animals | Native parrots; Quechua term from trade | colibri, guajolote: hooked beak, green | L |
| 14 | raton | El Ratón | The Mouse | animals | Core fauna, IDS lists | none | L |
| 15 | gallina | La Gallina | The Hen | animals | Introduced 1500s, nativised words widely recorded | guajolote (strong): small, red comb, no fan tail | M |
| 16 | arbol | El Árbol | The Tree | plants_food | Swadesh 100 | selva: one tree, visible trunk | L |
| 17 | hoja | La Hoja | The Leaf | plants_food | Swadesh 100, LJ | frijol (sprout): one big leaf, no stem in soil | L |
| 18 | flor | La Flor | The Flower | plants_food | Swadesh 207 | girasol: small, pink/red, five petals | M |
| 19 | cacahuate | El Cacahuate | The Peanut | plants_food | Native South American crop, spread to Mesoamerica early | frijol (pod) | M |
| 20 | raiz | La Raíz | The Root | plants_food | Swadesh 100, LJ | papa (tuber) | M |
| 21 | calabaza | La Calabaza | The Squash | plants_food | Milpa crop in all regions | olla (round shape) | L |
| 22 | yuca | La Yuca | The Cassava | plants_food | Core crop in Talamanca, Yucatán, Amazon side of the Andes; weaker in central Mexico | papa, camote (tubers) | M |
| 23 | camote | El Camote | The Sweet Potato | plants_food | Native crop in all regions | papa (strong): purple skin, tapered | M |
| 24 | guayaba | La Guayaba | The Guava | plants_food | Native fruit, lowlands and Andean valleys | aguacate, tomate: pink cut half | M |
| 25 | algodon | El Algodón | The Cotton | plants_food | Native cotton, ancient weaving in all regions | nube, hilo: open boll on branch | M |
| 26 | huevo | El Huevo | The Egg | plants_food | Swadesh 100, LJ | none | L |
| 27 | hongo | El Hongo | The Mushroom | plants_food | Common in IDS lists | Sacred double (ritual mushrooms): draw a plain edible cap | M |
| 28 | platano | El Plátano | The Banana | plants_food | Introduced but staple in Talamanca and Yucatán; Quechua likely a loan | none | M |
| 29 | pasto | El Pasto | The Grass | plants_food | Swadesh 207 | milpa | M |
| 30 | papaya | La Papaya | The Papaya | plants_food | Native to Mesoamerica; loans likely in the Andes | aguacate (cut fruit) | M |
| 31 | fuego | El Fuego | The Fire | sky | Swadesh 100, LJ | vela (strong): open campfire, logs, no wax | M |
| 32 | humo | El Humo | The Smoke | sky | Swadesh 100, LJ | nube, volcan (strong): grey curls, no mountain | H |
| 33 | neblina | La Neblina | The Fog | sky | Swadesh 207 | nube (strong): horizontal bands over hills | H |
| 34 | granizo | El Granizo | The Hail | sky | Andes and highland Talamanca; lowland Yucatán uncertain | lluvia: white round stones | M |
| 35 | nieve | La Nieve | The Snow | sky | Swadesh 207; Andes and Nahua highlands; unlikely in Yucatec and Talamanca speech | estrella (flake shape) | H |
| 36 | hielo | El Hielo | The Ice | sky | Swadesh 207; same regional gap as snow | cristal (strong) | H |
| 37 | amanecer | El Amanecer | The Dawn | sky | Common time noun in dictionaries | sol (strong): half sun on horizon | H |
| 38 | noche | La Noche | The Night | sky | Swadesh 100 | luna, estrella (strong) | H |
| 39 | cielo | El Cielo | The Sky | sky | Swadesh 207; cosmological sense in nah and quz | nube; weak picture | H |
| 40 | sombra | La Sombra | The Shadow | sky | Common noun in all dictionaries | arbol (tree plus shadow) | M |
| 41 | rocio | El Rocío | The Dew | sky | Common noun | lluvia, hoja: drops on a leaf | M |
| 42 | remolino | El Remolino | The Whirlwind | sky | Weather noun, often recorded | viento (strong): spiral funnel | M |
| 43 | agua | El Agua | The Water | sky | Swadesh 100, LJ: the best-attested noun on this list | manantial, lluvia (strong): one big drop | M |
| 44 | ceniza | La Ceniza | The Ash | sky | Swadesh 100, LJ | weak picture: grey heap with ember | M |
| 45 | trueno | El Trueno | The Thunder | sky | Weather noun, often recorded | rayo (strong); hard to draw sound | H |
| 46 | rio | El Río | The River | land | Swadesh 207 | mar, manantial: winding band between banks | L |
| 47 | lago | El Lago | The Lake | land | Swadesh 207 | mar: closed shore, reeds | L |
| 48 | piedra | La Piedra | The Stone | land | Swadesh 100, LJ; use the plain noun, never sacred stones (Bribri note) | cristal: grey, rounded | L |
| 49 | arena | La Arena | The Sand | land | Swadesh 100, LJ | desierto (strong): sand pile, no dunes | M |
| 50 | playa | La Playa | The Beach | land | Coastal everywhere; a Bribri form is mentioned in the bzd draft notes | isla (strong): no palm, shoreline only | M |
| 51 | cascada | La Cascada | The Waterfall | land | Andes and Talamanca; flat Yucatán has none | manantial | M |
| 52 | charco | El Charco | The Puddle | land | Common noun | lluvia, lago | M |
| 53 | lodo | El Lodo | The Mud | land | A Bribri form is mentioned in the bzd draft notes | adobe | L |
| 54 | barranca | La Barranca | The Ravine | land | Andes, Mexico, Talamanca; Yucatán flat | cueva, montana | M |
| 55 | llano | El Llano | The Plain | land | Andes and Mexico; Talamanca uncertain | desierto, milpa | M |
| 56 | pantano | El Pantano | The Swamp | land | Lowlands; highland Quechua uncertain | selva, charco | M |
| 57 | ola | La Ola | The Wave | land | Coastal vocabulary | mar (strong): one curling wave | H |
| 58 | concha | La Concha | The Shell | land | Coastal and lake vocabulary; land-snail word may double | caracol | M |
| 59 | valle | El Valle | The Valley | land | Andes and Mexico; Yucatán flat | montana (strong) | H |
| 60 | tierra | La Tierra | The Soil | land | Swadesh 100 "earth"; use soil, not the deity sense (Pachamama) | lodo (strong) | H |
| 61 | hacha | El Hacha | The Axe | handmade | Stone and metal axes everywhere | martillo (strong): blade head | M |
| 62 | red | La Red | The Fishing Net | handmade | Fishing nets in all regions | hamaca, telarana | M |
| 63 | cuerda | La Cuerda | The Rope | handmade | Leipzig–Jakarta "rope" | hilo (strong): thick coiled rope | M |
| 64 | jicara | La Jícara | The Gourd Bowl | handmade | Calabash bowl used in all regions | olla, calabaza; ceremonial use in Talamanca: draw an everyday bowl | M |
| 65 | metate | El Metate | The Grinding Stone | handmade | Mesoamerican metate, Andean batán; Talamanca uncertain | none | M |
| 66 | comal | El Comal | The Griddle | handmade | Mesoamerican comal, Andean toasting pan; Talamanca uncertain | none | M |
| 67 | escoba | La Escoba | The Broom | handmade | Household noun in all regions | coa | M |
| 68 | aguja | La Aguja | The Needle | handmade | Sewing needle, bone needles pre-contact | hilo (strong): needle alone, big eye | M |
| 69 | huso | El Huso | The Spindle | handmade | Spinning in all three regions | hilo | M |
| 70 | banco | El Banco | The Stool | handmade | In the Bribri casa tradicional dictionary; Maya and Andean stools | check no ceremonial-stool sense | M |
| 71 | sombrero | El Sombrero | The Hat | handmade | Woven hats in all regions; loans possible | none | M |
| 72 | morral | El Morral | The Woven Bag | handmade | Carry bags in all regions | cesto | L |
| 73 | hamaca | La Hamaca | The Hammock | handmade | Core in Yucatán and Talamanca; not Andean | red (strong) | H |
| 74 | coa | La Coa | The Digging Stick | handmade | Planting stick in all three farming traditions | hacha, martillo | M |
| 75 | petate | El Petate | The Sleeping Mat | handmade | Woven mats in all regions | cesto (weave pattern) | M |
| 76 | camino | El Camino | The Path | places | Swadesh 207 "road" | puente | L |
| 77 | pozo | El Pozo | The Well | places | Yucatán and Andes; Talamanca uses streams | cueva; never a cenote (sacred) | H |
| 78 | nido | El Nido | The Nest | places | Common noun | huevo (eggs in nest) | L |
| 79 | colmena | La Colmena | The Beehive | places | Log hives of stingless bees (Maya, Talamanca) | abeja, cesto | M |
| 80 | hormiguero | El Hormiguero | The Anthill | places | Common noun | hormiga (word collision likely) | H |
| 81 | telarana | La Telaraña | The Spider Web | places | Common noun | arana | M |
| 82 | patio | El Patio | The Yard | places | A Bribri form is mentioned in the bzd draft notes | casa, plaza (strong) | H |
| 83 | huerto | El Huerto | The Garden | places | Common noun | milpa (strong) | H |
| 84 | cerca | La Cerca | The Fence | places | Common noun | corral (strong) | M |
| 85 | puerta | La Puerta | The Door | places | In the Bribri casa tradicional dictionary | casa | L |
| 86 | techo | El Techo | The Roof | places | In the Bribri casa tradicional dictionary | casa (strong): thatch only | M |
| 87 | escalera | La Escalera | The Ladder | places | Notched-log ladders in Talamanca and Maya houses | puente | M |
| 88 | troje | La Troje | The Granary | places | Mesoamerican and Andean storehouses; Talamanca uncertain | casa | H |
| 89 | cocina | La Cocina | The Kitchen | places | Separate kitchen huts in all regions | casa (strong): pot, smoke | H |
| 90 | corral | El Corral | The Corral | places | Andean animal pens; loans likely in nah, yua, bzd | cerca (strong) | H |

**Counts:** 15 per category; with the current 9, each category reaches 24. Risk: 23 L, 48 M, 19 H. Sky and places carry most of the H cards. **Reserve** (swap in when an H card fails): gusano (worm, Swadesh 207), zorro (fox), pato (duck), luciernaga (firefly), cántaro (water jar), pelota (rubber ball), collar (bead necklace), cuchara (spoon), remo (paddle), sal (salt, Swadesh 207), semilla (seed), leña (firewood).

## 3. Coverage

### Rule for missing words

A card may stay in the deck while lacking a name in one language. Accepted coverage rule (see [rules.md](rules.md) and decision 0023; the original 54 retain their existing eligibility without any new provenance claim):

1. A card is **available** in a language only if that language has a sourced name (`kind: attested`, or a loan attested in speech, never a coinage) and an audio clip.
2. At round start, the **room deck** is the intersection of the available cards across every spoken language present in the room.
3. The chosen **grid** is preserved when it fits, otherwise reduced to the largest size whose deck requirement for the actual player count fits the room deck (the 20-player table above is the worst case).
4. A player may switch spoken language mid-round only to a language that covers the room deck; other languages are shown disabled with a short reason.

Per-player decks (each player's cartón drawn only from their own language) were rejected: every called card must be callable to everyone, with three spelling choices, in each player's language.

### Existing cards that are weak

- **Bribri (bzd):** 17 of 54 have no attested word: llama, condor, nopal, papa, tomate, girasol, cometa, volcan, desierto, cristal, adobe, martillo, plaza, puerto, pueblo, observatorio, biblioteca. Low confidence: isla, puente; descriptive compound: tienda. **37 available.**
- **Cabécar (cjp):** 7 missing (llama, condor, nopal, cueva, adobe, observatorio, biblioteca) and 5 Spanish loans not attested in Cabécar sources (papa, tomate, volcan, cristal, martillo). Low-confidence or descriptive: cometa, puente, desierto, plaza, escuela. **42 available** (37 if the low ones fail review).
- **nah, yua, quz:** all 54 have a name, but several are Spanish loans with no cited source (Yucatec: llama, cóndor, piña, papa, cristal, adobe, puente, martillo, puerto, escuela, observatorio, biblioteca; Náhuatl: llama, cóndor, piña, papa, isla). These count only once a source shows the loan is used (DEBT-014).

**Keep all 54.** Under the rule a missing word costs nothing for the other languages, and llama, condor, papa and nopal anchor the Andes and Mesoamerica. Candidates to retire if the deck must shrink: **observatorio** and **biblioteca** (missing in both Chibchan languages, loans in Yucatec, institutions rather than things).

### Expected size per language at 144 cards

Estimates from the risk flags; replace with counts after research.

| Language | Current 54 | New 90 (estimate) | Total | Largest grid, 20 players, single-language room |
| --- | --- | --- | --- | --- |
| Español, English | 54 | 90 | 144 | 8x8 |
| Náhuatl | 54 | ~86 | ~140 | 8x8 |
| Quechua | 54 | ~83 | ~137 | 8x8 (borderline) |
| Maya yucateco | 54 | ~82 (no snow, ice, waterfall, valley, ravine) | ~136 | 7x7 (one short) |
| Cabécar | 42 | ~72 | ~114 | 7x7 |
| Bribri | 37 | ~72 | ~109 | 7x7 (barely) |

Mixed rooms take the intersection. A room with all seven languages is expected near 95-100 cards, i.e. **6x6 for 20 players** (7x7 or 8x8 for smaller rooms). To give Bribri and Cabécar 8x8, about 28 more cards attested in both would be needed; the reserve list is the first place to look.

## 4. Plans

### Research (per language)

Honesty rules, the same as the existing drafts and the PRD non-goal "no AI-generated Indigenous-language text":

- Every name cites a source (work + entry or page) and a `kind`: `attested`, `loanword` (only if attested in speech), `descriptive` (only if a source uses the phrase), or `missing` with `text: null`.
- Never coin a compound, never translate word by word, never substitute a different referent (king vulture is not a condor). Null over a guess.
- Record variety and orthography; flag sacred or taboo senses; write a `reviewQuestion` for each card.
- Status stays `draft` until a native-speaker reviewer from that community approves it; reviewers are credited and paid.

Sources:

- **Náhuatl:** Molina 1571; Karttunen 1983; Wimmer, *Gran Diccionario Náhuatl* (UNAM); Florentine Codex Book 11 (animals, plants, earth); a modern variety chosen with the reviewing community (IDIEZ Huasteca dictionary, INALI materials).
- **Maya yucateco:** *Diccionario Maya Cordemex* (Barrera Vásquez 1980); Bastarrachea et al., *Diccionario básico español-maya-español*; Bolles, *Combined Dictionary–Concordance of Yucatecan Mayan* (FAMSI); INALI 2014 orthography.
- **Quechua Cusco-Collao:** Academia Mayor de la Lengua Quechua, *Diccionario quechua-español-quechua* (2005); Cusihuamán 1976; Lira 1944; Peru Ministry of Education vocabularies; decide the 3- vs 5-vowel spelling once for all cards.
- **Bribri:** Krohn online dictionary (2025), Margery 1996, Jara & García Segura 2003/2013, DIPALICORI pictographic dictionaries (animals; casa tradicional, which should cover door, roof, stool, ladder, kitchen), Krohn 2016 for attested loans.
- **Cabécar:** Margery 1989 (archived UCR scan); Bible.is CJPTJV for spellings the MMS model can voice; González Campos & Obando 2017 (MEP alphabet) to normalise; DIPALICORI Cabécar materials.

Work order: research the 90 in the existing draft format (`src/content/drafts/{lang}.json`), compute real per-language counts, cut or swap H cards from the reserve, then hand to reviewers.

### Art

The release uses portrait WebP covers under `public/cards/`, rendered as full-card backgrounds. All 144 covers are present and reviewed. The 144 files total 4,324,088 bytes, and the generated unique PWA precache measures 9,255,794 bytes, within their 6,000,000-byte art and 10 MiB installation budgets.

- **Checks:** silhouette and legibility at phone size and in greyscale/high contrast; draw known confusion pairs distinctly; no people or hands; review culturally specific forms (log beehive, notched-log ladder, plain edible mushroom, land snail).

### Audio

Router in `scripts/audio/engines.json` ([audio.md](audio.md)):

- **es, en:** Kokoro-82M, 90 x 2 = 180 clips.
- **nah, yua, quz, cjp:** Meta MMS-TTS, one clip per available card (about 323 clips). Licence is CC-BY-NC, so native recordings must replace them before any commercial use; Cabécar spellings must use only characters in the MMS `cjp` vocabulary.
- **bzd:** `needs-recording`. About 109 native-speaker recordings for the full deck (37 existing + ~72 new), with consent, credit and payment, dropped into `public/audio/recordings/bzd/`.
- **Budget:** clips average about 5.3 KB, so 144 x 7 ≈ 1,000 clips ≈ 5.3 MB of audio against today's 2.7 MB; the PWA precache (6.7 of 10 MB) gets close to its limit. Plan to precache only the selected spoken language, or raise the budget.
- `pnpm audio:check` must allow a missing clip when the name is `missing`, instead of failing the build.
