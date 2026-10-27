# Catálogo base — figuras y cartas

**Estado:** borrador v0 (2026-10-26) · **Dueño:** César · Las reglas que usan este catálogo están en [reglas.md](reglas.md) (R-16, R-17 y R-44 a R-47).

Dos catálogos que comparten todos los juegos:
- **A. Figuras:** las formas que hay que llenar en la tabla para cantar "¡Lotería!".
- **B. Cartas:** las 54 imágenes del mazo, de donde se arman las tablas al azar.

---

## A. Catálogo de figuras

Tabla de 4×4. Las celdas se numeran del 0 al 15 por filas:

```
 0  1  2  3
 4  5  6  7
 8  9 10 11
12 13 14 15
```

Los números de "cartas hasta la primera lotería" vienen de **simular 2000 rondas** por figura con tablas al azar (máximo 5 cartas por categoría). El script está en el scratchpad de esta sesión y se reescribe como test del motor. El tiempo supone el modo Normal: 10 s + ~3 s de audio ≈ 13 s por carta.

| ID | Nombre (es / en) | Nivel | Celdas | Formas válidas | 10 jugadores: media (p10–p90) | 40 jugadores: media | Duración aprox. con 40 | Empate con 40 |
|---|---|---|---|---|---|---|---|---|
| `line` | Chorro / Line | Fácil | 4 | 10 (4 filas, 4 columnas, 2 diagonales) | 17 (11–23) | 13 | ~3 min | 15% |
| `square` | Cuadrito / Little square | Fácil | 4 | 9 (cualquier bloque de 2×2) | 18 (12–23) | 13 | ~3 min | 14% |
| `corners` | Cuatro esquinas / Four corners | Media | 4 | 1 | 28 (18–37) | 21 | ~4.5 min | 9% |
| `center` | Centrito / Center | Media | 4 | 1 | 28 (19–37) | 21 | ~4.5 min | 9% |
| `ele` | La L / The L | Media | 7 | 1 | 38 (31–44) | 32 | ~7 min | 10% |
| `x` | La equis / The X | Media | 8 | 1 | 39 (32–45) | 34 | ~7.5 min | 11% |
| `frame` | Marco / Frame | Difícil | 12 | 1 | 44 (39–49) | 40 | ~8.5 min | 16% |
| `full` | Llena / Full board | Difícil | 16 | 1 | 47 (43–50) | 44 | ~9.5 min | 19% |

Cómo se ve cada figura (■ = hay que llenar):

```
Chorro (una de 10)   Cuadrito (uno de 9)  Cuatro esquinas      Centrito
■ ■ ■ ■              ■ ■ □ □              ■ □ □ ■              □ □ □ □
□ □ □ □              ■ ■ □ □              □ □ □ □              □ ■ ■ □
□ □ □ □              □ □ □ □              □ □ □ □              □ ■ ■ □
□ □ □ □              □ □ □ □              ■ □ □ ■              □ □ □ □

La L                 La equis             Marco                Llena
■ □ □ □              ■ □ □ ■              ■ ■ ■ ■              ■ ■ ■ ■
■ □ □ □              □ ■ ■ □              ■ □ □ ■              ■ ■ ■ ■
■ □ □ □              □ ■ ■ □              ■ □ □ ■              ■ ■ ■ ■
■ ■ ■ ■              ■ □ □ ■              ■ ■ ■ ■              ■ ■ ■ ■
```

Celdas exactas para el motor:

| ID | Formas válidas (índices) |
|---|---|
| `line` | `[0,1,2,3] [4,5,6,7] [8,9,10,11] [12,13,14,15] [0,4,8,12] [1,5,9,13] [2,6,10,14] [3,7,11,15] [0,5,10,15] [3,6,9,12]` |
| `square` | `[0,1,4,5] [1,2,5,6] [2,3,6,7] [4,5,8,9] [5,6,9,10] [6,7,10,11] [8,9,12,13] [9,10,13,14] [10,11,14,15]` |
| `corners` | `[0,3,12,15]` |
| `center` | `[5,6,9,10]` |
| `ele` | `[0,4,8,12,13,14,15]` |
| `x` | `[0,3,5,6,9,10,12,15]` |
| `frame` | `[0,1,2,3,4,7,8,11,12,13,14,15]` |
| `full` | `[0,1,…,15]` |

Lo que dicen los números:
- **Chorro y cuadrito con 40 jugadores salen en ~13 cartas.** Son ideales para salón y rondas cortas, pero 1 de cada 7 rondas trae empate. R-21 ya cubre eso: cuentan todos.
- **Esquinas y centrito duran más que el chorro aunque también son de 4 celdas**, porque solo hay una forma válida. Son figuras "de suerte".
- **Llena casi siempre se va a 40+ cartas** y tiene ~19% de empate. Es la ronda larga clásica.

---

## B. Catálogo de cartas (54): mazo del concurso

**Regla D4:** solo entran cartas con palabra **con fuente en los 5 idiomas**. Se investigaron 75 candidatas por lengua (náhuatl de la Huasteca oriental, maya yucateco, quechua de Cusco); 69 tenían palabra en las tres lenguas y de ahí se eligieron 54. Los datos con fuente por palabra están en `src/content/cards.json`, y el audio de cada palabra en `public/audio/{nah,yua,quz}/{id}.m4a` (voz Meta MMS-TTS, 162 archivos, 1.1 MB).

⚠️ = fuente débil o solo en náhuatl clásico (Molina, 1571). Se canta igual, con la etiqueta de D1.

**Fuentes:**
- **Náhuatl:** diccionario IDIEZ de Sullivan y Olko (Chicontepec) en nahuatl.wired-humanities.org; Wiktionary para 7 palabras.
- **Maya:** *Diccionario Básico Español-Maya-Español* de Bastarrachea, Yah Pech y Briceño Chel (UADY), en copia de Wayback Machine.
- **Quechua:** diccionario del Ministerio de Educación del Perú (Chuquimamani Valer et al., 2005, quechua cusqueño), en copia de Wayback Machine.

**Las categorías quedaron disparejas** (animales 17 … lugares 5). Hay más animales con palabra en las tres lenguas que lugares; las tablas siguen con máximo 5 por categoría (R-04).

**Por qué salieron estas cartas:**
- **Sin palabra en alguna lengua:** papa, hacha (nhe); tortilla, milpa (quz); hielo, río (yua).
- **Suena igual que otra carta:** miel (`kaab` en maya también es abeja).
- **Palabra con otro sentido delicado para niños:** huevo.
- **Préstamo directo del español:** puerta (nhe), jitomate (quz).
- **Sentido dudoso en la fuente:** rayo y caracol (nhe), conejo (quz: "cuy de Lima"), mosca, escalera.
- **Emoji que no representa bien la carta:** calabaza 🎃 (cara de Halloween), tierra, humo, sombrero 👒.
- **Para cerrar en 54:** cuchillo, gusano.

### Animales (17)
| n | Dibujo | es | en | náhuatl (nhe) | maya (yua) | quechua (quz) |
|---|---|---|---|---|---|---|
| 1 | 🦀 | el cangrejo | the crab | atecuicitli ⚠️ | bab ⚠️ | apanquray |
| 2 | 🐢 | la tortuga | the turtle | ayotl | áak | charapa |
| 3 | 🦋 | la mariposa | the butterfly | papalotl | péepem | pillpintu |
| 4 | 🐝 | la abeja | the bee | neuctzin | kaab | wanquyru |
| 5 | 🦌 | el venado | the deer | mazatl | kéej | taruka |
| 6 | 🦅 | el águila | the eagle | cuauhtli | kóot | anka |
| 7 | 🐸 | la rana | the frog | pechpechin | muuch | k'ayra |
| 8 | 🐕 | el perro | the dog | chichi | peek' | allqu |
| 9 | 🐍 | la serpiente | the snake | coatl | kaan | amaru |
| 10 | 🐟 | el pez | the fish | michin | kay | challwa |
| 11 | 🦉 | el búho | the owl | tecolotl | tunkuruchu | tuku |
| 12 | 🦇 | el murciélago | the bat | tzotzo | soots' | masu |
| 13 | 🕷️ | la araña | the spider | tocatl | am | apasanqa |
| 14 | 🐁 | el ratón | the mouse | quimichin | ch'o' | huk'ucha |
| 15 | 🐜 | la hormiga | the ant | axcanelin | síinik | sisi |
| 16 | 🐦 | el pájaro | the bird | tototl | ch'íich' | pisqu |
| 17 | 🦎 | la lagartija | the lizard | topitzin | meerech | qaraywa |

### Plantas y comida (9)
| n | Dibujo | es | en | náhuatl (nhe) | maya (yua) | quechua (quz) |
|---|---|---|---|---|---|---|
| 18 | 🌽 | el maíz | the corn | cintli | ixi'im | sara |
| 19 | 🌶️ | el chile | the chili | chilli | iik | uchu |
| 20 | 🌸 | la flor | the flower | xochitl | lool | t'ika |
| 21 | 🍄 | el hongo | the mushroom | nanacatl ⚠️ | kuuxum | k'allampa |
| 22 | 🥑 | el aguacate | the avocado | ahuacatl | oom | paltay |
| 23 | 🌱 | la semilla | the seed | xinachtli | neek' | muhu |
| 24 | 🍃 | la hoja | the leaf | izhuatl | le' | rapi |
| 25 | 🌳 | el árbol | the tree | cuahuitl | che' | sach'a |
| 26 | 🫘 | el frijol | the bean | etl | bu'ul | purutu |

### Cielo (9)
| n | Dibujo | es | en | náhuatl (nhe) | maya (yua) | quechua (quz) |
|---|---|---|---|---|---|---|
| 27 | ☀️ | el sol | the sun | tonatiuh | k'iin | inti |
| 28 | 🌙 | la luna | the moon | metztli | uj | killa |
| 29 | ⭐ | la estrella | the star | citlalin | eek' | quyllur |
| 30 | ☁️ | la nube | the cloud | mixtli | múuyal | phuyu |
| 31 | 🌧️ | la lluvia | the rain | quiahuitl ⚠️ | cháak | para |
| 32 | 🌈 | el arcoíris | the rainbow | cuacemalotl | chéel | k'uychi |
| 33 | 💨 | el viento | the wind | ehecatl | iik' | wayra |
| 34 | 🌃 | la noche | the night | yohualli | áak'ab | tuta |
| 35 | 🌌 | el cielo | the sky | elhuicatl | ka'an | hanaq pacha |

### Tierra (6)
| n | Dibujo | es | en | náhuatl (nhe) | maya (yua) | quechua (quz) |
|---|---|---|---|---|---|---|
| 36 | ⛰️ | el cerro | the mountain | tepetl | wiits | urqu |
| 37 | 🪨 | la piedra | the stone | tetl | tuunich | rumi |
| 38 | 💧 | el agua | the water | atl | ja' | unu |
| 39 | 🔥 | el fuego | the fire | tlitl | k'áak' | nina |
| 40 | 🌊 | el mar | the sea | hueyi atl | k'áak'náab | mama qucha |
| 41 | 🏖️ | la arena | the sand | xalli | sam ⚠️ | aqu |

### Lugares (5)
| n | Dibujo | es | en | náhuatl (nhe) | maya (yua) | quechua (quz) |
|---|---|---|---|---|---|---|
| 42 | 🏠 | la casa | the house | calli | naj | wasi |
| 43 | 🛣️ | el camino | the road | ohtli | bej | ñan |
| 44 | 🏘️ | el pueblo | the town | altepetl | kaaj | llaqta |
| 45 | 🛒 | el mercado | the market | tianquiz | k'íiwik | qhatu |
| 46 | 🕳️ | la cueva | the cave | oztoctli | áaktun | mach'ay |

### Hecho a mano (8)
| n | Dibujo | es | en | náhuatl (nhe) | maya (yua) | quechua (quz) |
|---|---|---|---|---|---|---|
| 47 | 🏺 | la olla | the clay pot | comitl | kuum | manka |
| 48 | 🧺 | la canasta | the basket | chiquihuitl | xaak | isanka |
| 49 | 🪘 | el tambor | the drum | huehuetl ⚠️ | tunk'ul | tinya |
| 50 | 🪈 | la flauta | the flute | tlapitzalli | piitoo ⚠️ | pinkullu |
| 51 | 🧵 | el hilo | the thread | icpatl | k'uuch | q'aytu |
| 52 | 🪢 | la cuerda | the rope | mecatl | suum | waskha |
| 53 | 🪡 | la aguja | the needle | acoxah | púuts' | yawri |
| 54 | 🩴 | la sandalia | the sandal | tecactli | xanab | usuta |
