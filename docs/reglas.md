# Reglas del juego — Lotería de los Pueblos

**Versión:** v1 (2026-10-26) · **Dueño:** César · **Consume:** Rob (app y red) · **Fuente superior:** [PRD.md](PRD.md) · **Cambios entre versiones:** al final, en "Delta de versiones".

Este documento es el contrato del juego. Cada regla tiene un ID (`R-xx`) y uno o más ejemplos **Dado / Cuando / Entonces**. **Cada ejemplo se convierte en un test** con el ID en el nombre del test (`it('R-12.1 …')`). Si un comportamiento no tiene ejemplo, no está garantizado. Los IDs no se reutilizan: una regla eliminada deja su número libre para siempre.

Marcas:
- ✅ **decidido**: ya se puede programar.
- ❓ **decide César**: trae una recomendación (◆). Mientras no se decida, se programa la recomendación.
- 🔒 **regla dura**: no se negocia en este documento.

El juego tiene tres objetivos: **1) aprender idiomas, 2) jugar lotería, 3) inclusión.** Se canta en cinco idiomas: español, inglés, náhuatl, maya yucateco y quechua.

---

## 1. El mazo

**R-01 ✅ Mazo.** 54 cartas, numeradas del 1 al 54, en 6 categorías: animales, plantas y comida, cielo, tierra, hecho a mano y lugares. El reparto exacto está en [catalogo.md §B](catalogo.md). No hay figuras humanas ni roles humanos con género.
- R-01.1 · Dado el mazo · Cuando se cuentan las cartas · Entonces son 54, con ids únicos, y cada una tiene categoría de las 6.

**R-02 🔒 Palabras con fuente.** Cada carta tiene su nombre en los 5 idiomas. Los nombres en náhuatl, maya y quechua vienen de un diccionario citado en `cards.json` (campo `source`). Nunca se inventa una palabra.
- R-02.1 · Dado un nombre en `nah`, `yua` o `quz` sin campo `source` · Cuando se valida el contenido · Entonces la validación falla.

**R-03 🔒 Se canta en los 5 idiomas.** El mazo solo lleva cartas que tienen palabra en los 5 idiomas, así que **los 5 idiomas siempre se pueden elegir y siempre se cantan**, en todas las pantallas. Ningún idioma se oculta.
- R-03.1 · Dado el mazo · Cuando se listan los idiomas para cantar · Entonces aparecen siempre `es`, `en`, `nah`, `yua` y `quz`.
- R-03.2 · Dada cualquier carta y cualquiera de los 5 idiomas · Cuando se pide su nombre · Entonces hay texto (nunca vacío ni `null`).

## 2. Las tablas

**R-04 ✅ Forma.** Cada jugador recibe una tabla **aleatoria** de 4×4 con 16 imágenes del mazo, sin repetidas y con máximo 5 por categoría.
- R-04.1 · Dado cualquier seed e índice · Cuando se genera la tabla · Entonces tiene 16 cartas distintas y ninguna categoría pasa de 5.

**R-05 ✅ Determinismo.** La misma sala y el mismo número de tabla dan siempre la misma tabla, en el teléfono del jugador y en el cantor. La tabla no cambia entre rondas.
- R-05.1 · Dado el seed `K7M2Q9R4T6V8X3Z1` y la tabla 3 · Cuando se genera en dos dispositivos · Entonces las 16 cartas son idénticas y están en el mismo orden.
- R-05.2 · Dada la tabla 3 en la ronda 1 · Cuando empieza la ronda 2 · Entonces la tabla 3 es la misma.

**R-06 ✅ Parecido entre tablas.** Sin control, en una sala de 40 jugadores casi seguro habría dos tablas que comparten 9 o más cartas: P ≈ 0.998, y P ≈ 0.60 de compartir 10 o más (cálculo hipergeométrico, 780 pares). Por eso, al asignar una tabla, el cantor se salta los índices que compartan más de 8 cartas con alguna tabla ya repartida en la sala. Se salta ~1% de los índices.
- R-06.1 · Dadas 40 tablas repartidas · Cuando se compara cada par · Entonces ninguno comparte más de 8 cartas.

**R-07 ✅ Una tabla por teléfono.**

**R-45 🔒 La tabla siempre está visible.** Un jugador no puede jugar si no ve su tabla. Mientras está en la sala, su tabla de 16 imágenes está **siempre en pantalla**: ningún modo, ajuste, aviso ni animación la oculta o la tapa por completo. Lo que se puede ocultar en Escucha o "Practicar de oído" es **la carta que se está cantando**, nunca la tabla.
- R-45.1 · Dado un jugador en cualquier modo (Jugar, Practicar, Escucha, "Practicar de oído") · Cuando se canta una carta · Entonces las 16 celdas de su tabla siguen visibles.
- R-45.2 · Dado un aviso ("¡Casi!", "Esa no es", "¡Lotería!") · Cuando aparece · Entonces no cubre la tabla completa y la tabla se puede seguir tocando, salvo en la pantalla final de ronda.

## 3. La ronda

**R-08 🔒 El cantor manda.** El dispositivo cantor es la única autoridad: baraja, canta y decide cada "¡Lotería!". Los teléfonos solo muestran y piden.

**R-09 ✅ Nadie puede adivinar la siguiente carta.** El seed de la sala viaja a los teléfonos para que armen su tabla. Si el orden del mazo saliera del mismo seed, cualquiera con conocimientos técnicos podría calcular las cartas que vienen. Por eso el orden del mazo sale de un **secreto del cantor** (`deckSecret`) que nunca sale de su dispositivo.
- R-09.1 · Dado un mensaje `round` · Cuando se inspeccionan sus campos · Entonces no contiene `deckSecret`.
- R-09.2 · Dado el mismo `seed` con dos `deckSecret` distintos · Cuando se baraja la ronda 1 · Entonces los órdenes son distintos, y las tablas no cambian.

**R-10 ✅ Sin repetir.** En una ronda, cada carta se canta una sola vez. A los 54 cantos la ronda se cierra sola.
- R-10.1 · Dada una ronda · Cuando se cantan 54 cartas · Entonces las 54 son distintas y el siguiente "siguiente" no canta nada y cierra la ronda.

**R-11 ✅ Cómo se canta una carta.** En modo Normal: verso y luego nombre ("…¡el cangrejo!"), en español o inglés. En náhuatl, maya y quechua se canta el nombre. En modo Rápido, solo el nombre en cualquier idioma.
- R-11.1 · Dada velocidad Normal y la carta cangrejo en `es` · Cuando se canta · Entonces se dice el verso en español y después "el cangrejo".
- R-11.2 · Dada la carta cangrejo en `quz` · Cuando se canta · Entonces se oye "apanquray".

**R-12 ✅ El reloj entre cartas.** El intervalo (6–20 s) empieza a contar **cuando termina el audio** de la carta, no cuando empieza. Así un verso largo no se come el tiempo para buscar la carta.
- R-12.1 · Dada velocidad 10 s y un audio de 4 s · Cuando se canta · Entonces la siguiente carta llega 14 s después del inicio.

**R-13 ✅ Pausa, repetir, siguiente.**
- R-13.1 · Dada una ronda en pausa · Cuando el reloj llega a cero · Entonces no se canta nada.
- R-13.2 · Cuando se pide "repetir" · Entonces se vuelve a decir la carta actual, sin avanzar ni duplicarla en la lista de cantadas.

**R-14 ✅ Idioma rotativo del cantor.** En modo rotativo, la bocina del cantor canta la carta *i* en `idiomas[i mod 5]`, en este orden fijo: `es, en, nah, yua, quz`.
- R-14.1 · Dado el cantor en rotativo · Cuando se cantan las cartas 0 a 5 · Entonces salen en `es`, `en`, `nah`, `yua`, `quz` y `es`.

**R-15 ✅ Modo Escucha.** El cantor activa Escucha para toda la ronda: nadie ve el **texto** de la carta cantada mientras suena. Además, **cada dispositivo** tiene el interruptor **"Practicar de oído"**, apagado por default, que oculta también el **dibujo de la carta cantada**. **La tabla del jugador nunca se oculta (R-45).** Al llegar la siguiente carta, la anterior se revela completa en el historial. El mensaje `round` lleva `mode: 'normal' | 'escucha'`; el interruptor es local y se recuerda en localStorage.
- R-15.1 · Dado el modo Escucha y "Practicar de oído" apagado · Cuando se canta una carta · Entonces se ve el dibujo de la carta cantada, pero no su nombre.
- R-15.2 · Dado el modo Escucha y "Practicar de oído" encendido en un teléfono · Cuando se canta · Entonces ese teléfono no muestra ni nombre ni dibujo de la carta cantada, su tabla sigue visible, y otro teléfono con el interruptor apagado sí ve el dibujo.
- R-15.3 · Dado el modo Escucha · Cuando llega la carta siguiente · Entonces el historial muestra la anterior con nombre y dibujo.
- R-15.4 · Dado el modo Normal · Entonces el interruptor "Practicar de oído" no aparece.

## 4. Figuras (las formas de llenar)

**R-16 ✅ Catálogo de figuras.** Hay 8 figuras en 3 niveles: chorro, cuadrito, cuatro esquinas, centrito, la L, la equis, marco y llena. Las celdas exactas y su duración simulada están en [catalogo.md §A](catalogo.md), que es la fuente para el motor. `PatternId` = `'line' | 'square' | 'corners' | 'center' | 'ele' | 'x' | 'frame' | 'full'`.
- R-16.1 · Dado chorro · Cuando la columna 2 (celdas 2, 6, 10, 14) está cantada y marcada · Entonces vale.
- R-16.2 · Dado cuadrito · Cuando el bloque 9, 10, 13, 14 está cantado y marcado · Entonces vale.
- R-16.3 · Dada la equis · Cuando las 8 celdas están completas salvo la 6 · Entonces es "¡Casi!" y falta la carta de la celda 6.
- R-16.4 · Para cada figura · la lista de formas válidas del motor es idéntica a la de catalogo.md §A (un test compara las dos listas).

**R-17 ✅ Figura sorpresa.** Además de elegir una figura fija, el cantor puede elegir **"Sorpresa"** con un nivel (Fácil, Media, Difícil o Cualquiera). Al empezar la ronda, el cantor sortea una figura de ese nivel y **la anuncia antes de la primera carta**, en pantalla y en todos los teléfonos. Nadie juega sin saber qué figura busca. El sorteo usa el secreto del cantor (R-09), así que nadie lo puede adivinar, y no repite la figura de la ronda anterior si el nivel tiene más de una.
- R-17.1 · Dado "Sorpresa · Fácil" · Cuando empieza la ronda · Entonces la figura es `line` o `square`, y el mensaje `round` la lleva antes de cualquier `call`.
- R-17.2 · Dado "Sorpresa · Media" y la ronda anterior con `corners` · Cuando empieza la nueva ronda · Entonces la figura no es `corners`.
- R-17.3 · Dado el mismo secreto y la misma ronda · Cuando se sortea dos veces · Entonces sale la misma figura (determinista y reanudable tras recargar).

## 5. "¡Lotería!"

**R-18 ✅ Cuándo vale.** Vale si alguna forma completa de la figura tiene todas sus cartas **cantadas** y **marcadas**. Las marcas de más, sobre cartas no cantadas o fuera de la figura, no importan.
- R-18.1 · Dado esquinas con las 4 esquinas cantadas y marcadas, y otra carta marcada sin cantar · Cuando se pide lotería · Entonces vale.
- R-18.2 · Dadas 3 esquinas cantadas y la 4ª marcada pero no cantada · Cuando se pide lotería · Entonces es "¡Casi!" y falta la 4ª.
- R-18.3 · Dadas las 4 esquinas cantadas pero una sin marcar · Cuando se pide lotería · Entonces es "¡Casi!" y falta esa.

**R-19 ✅ El "dormido" vale.** Alguien que completó su figura en la carta 20 y pide lotería en la 25 sí tiene lotería. El juego es familiar y de salón: se premia jugar, no los reflejos.
- R-19.1 · Dada una figura completa desde el canto 20 · Cuando se pide en el canto 25 · Entonces vale.

**R-20 ✅ "¡Casi!" sin castigo.** Una lotería que no vale muestra "¡Casi!" y las cartas que faltan. Solo se espera 3 s para volver a pedir.
- R-20.1 · Dado un "¡Casi!" · Cuando el mismo jugador pide otra vez a los 2 s · Entonces el cantor lo ignora. A los 3.1 s sí lo revisa.

**R-21 ✅ Empates: cuentan todos.** Una lotería válida pausa la ronda. Mientras está en pausa, todas las loterías válidas que lleguen cuentan; no gana "el primero en red", porque la latencia del Wi-Fi no es justa. Después el cantor elige "Seguir" (otra lotería más) o "Terminar ronda". En `end`, `winners` = todos los válidos.
- R-21.1 · Dados dos jugadores que completan con la misma carta · Cuando sus loterías llegan con 300 ms de diferencia · Entonces los dos son válidos.

**R-22 ✅ El cantor muestra la tabla ganadora.** Con una lotería válida, la pantalla del cantor muestra la tabla del jugador con la figura resaltada y los nombres en el idioma del cantor.

## 6. Jugadores

**R-26 ✅ Entrar tarde.** Se puede entrar en cualquier momento. El jugador recibe su tabla y la lista de lo ya cantado; con auto-marcar, se marcan solas.
- R-26.1 · Dadas 12 cartas cantadas · Cuando entra un jugador con auto-marcar · Entonces sus cartas que ya salieron aparecen marcadas.

**R-27 ✅ Volver a entrar.** El mismo teléfono (misma pestaña o recarga) recupera su misma tabla, sus marcas y sus idiomas.

**R-28 ❓ Sala llena.** El PRD fija un máximo de 40.
- ◆ **Recomendación:** hoy no se programa; en la demo no habrá 40 personas.

**R-29 ✅ Nombres.** Texto libre de 1 a 24 caracteres. Se permiten nombres repetidos, porque el glifo los distingue. Los nombres no salen del cantor ni se guardan en ningún servidor.

## 7. Idiomas y canto

**R-30 ✅ Cómo suena cada idioma.** Náhuatl, maya y quechua suenan con su audio pregrabado del mazo (`public/audio/{nah|yua|quz}/{id}.m4a`, generado con Meta MMS-TTS). Español e inglés suenan con la voz del navegador (`es-MX`, `en-US`). **Las 54 cartas tienen audio en los tres idiomas**, así que toda carta se canta en el idioma elegido.
- R-30.1 · Dada cualquier carta y `nah`, `yua` o `quz` · Cuando se busca su audio · Entonces el archivo existe (un test recorre las 162 combinaciones).
- R-30.2 · Dada la carta cangrejo y "Escucho = yua" · Cuando se canta · Entonces se reproduce `public/audio/yua/cangrejo.m4a`.

**R-46 🔒 El juego canta todos los idiomas.** Los 5 idiomas se **cantan con voz**, no solo se escriben: español, inglés, náhuatl, maya yucateco y quechua. El cantor puede cantar en cualquiera de los 5 (o en rotativo, R-14) y cada teléfono canta en su idioma "Escucho" (R-32, R-34). Ningún idioma queda mudo ni se muestra solo como texto.
- R-46.1 · Para cada una de las 54 cartas y cada uno de los 5 idiomas · Cuando se canta · Entonces se produce sonido: voz del navegador en `es`/`en` y audio del mazo en `nah`/`yua`/`quz` (un test recorre las 270 combinaciones).
- R-46.2 · Dada una sala con jugadores escuchando en `es`, `nah`, `yua` y `quz` · Cuando se canta una carta · Entonces cada uno la oye en su idioma con el mismo `call`.
- R-46.3 · Dado el cantor en `yua` · Cuando se canta cangrejo · Entonces la bocina del cantor dice "bab".

**R-31 ✅ Créditos.** La pantalla de créditos dice: "Voces en náhuatl, maya y quechua generadas con Meta MMS-TTS. Palabras tomadas de diccionarios" y enlista las fuentes. Es un requisito de la licencia CC-BY-NC 4.0 de MMS, que exige atribución.

**R-32 ✅ Cada quien elige su idioma, y lo cambia cuando quiera.** Al entrar, cada jugador elige:
- **"Escucho":** el idioma en que le cantan.
- **"Entiendo":** el idioma de los nombres en su tabla.

Los dos ofrecen siempre los 5 idiomas (R-03) y **se pueden cambiar en cualquier momento de la ronda**, sin salir de la sala y sin perder la tabla ni las marcas. Esa es la razón por la que el mazo solo lleva palabras que existen en los 5 idiomas: cualquier carta se puede cantar en cualquier idioma, en cualquier momento.
- R-32.1 · Dada una jugadora con "Entiendo = es" y "Escucho = en" · Cuando se canta cangrejo · Entonces su tabla dice "el cangrejo" y le cantan "the crab".
- R-32.2 · Dada una jugadora con "Escucho = es" a media ronda · Cuando cambia a `nah` · Entonces la siguiente carta se le canta en náhuatl, "Otra vez" repite la actual en náhuatl, y su tabla y sus marcas no cambian.
- R-32.3 · Dado un cambio de "Entiendo" a `quz` · Cuando se aplica · Entonces los 16 nombres de su tabla se ven en quechua al instante.

**R-34 ✅ Un canto, muchos idiomas.** El cantor manda **la carta, no el texto** (`call{cardId, …}`). Cada dispositivo la dice y la escribe en su propio idioma:
- La bocina y la pantalla del cantor usan el idioma del cantor (o el rotativo, R-14).
- Cada teléfono usa su idioma "Escucho".
- R-34.1 · Dados P1 con "Escucho = en" y P2 con "Escucho = yua" · Cuando llega `call` de cangrejo · Entonces P1 dice "the crab" y P2 "bab", con el mismo mensaje.
- R-34.2 · Dado el cantor en rotativo cantando en `en` · Cuando llega la carta · Entonces un teléfono con "Escucho = quz" la dice en quechua; el rotativo solo afecta la bocina del cantor.

**R-35 ✅ Sonido en el teléfono.** Cada teléfono canta en su idioma "Escucho". El interruptor "Oír en mi teléfono" viene **encendido** y muestra la sugerencia "Usa audífonos". El navegador solo deja sonar audio después de un toque, así que el botón de entrar a la sala "desbloquea" el sonido. ⚠️ Hay que verificarlo en un iPhone real.
- R-35.1 · Dado "Oír en mi teléfono" apagado · Cuando llega una carta · Entonces el teléfono no reproduce nada, pero sí muestra la carta.

**R-36 ✅ No se enciman.** Si llega una carta nueva mientras el teléfono todavía dice la anterior, la anterior se corta y suena la nueva. En el teléfono solo se dice el nombre (el verso lo dice el cantor). Hay un botón "Otra vez" que repite el nombre en el idioma "Escucho" las veces que se quiera.
- R-36.1 · Dado un nombre sonando · Cuando llega otra carta · Entonces se cancela el primero antes de decir el segundo.

## 8. Tono

**R-33 🔒 Palabras prohibidas** en textos de pantalla y cartas: ganar, ganaste, ganador(a/es), premio(s), apuesta, apostar, dinero, fichas, win(s), winner(s), won, prize(s), bet(s), betting, money, chips, **bingo**. Se dice "¡Lotería!", "completaste" y "frijoles". El juego es **lotería** (juego tradicional mexicano) en todas sus pantallas y textos, en cualquier idioma. Este reglamento usa "ganar" y "perder" para explicar el juego; la pantalla nunca.
- R-33.1 · Dado un texto de pantalla con "bingo" · Cuando corre el copy lint · Entonces falla.

## 9. Modos del jugador: Jugar o Practicar

Cada teléfono elige su modo y lo puede cambiar a media ronda sin perder sus marcas. Una misma sala mezcla jugadores de los dos modos. En los dos modos la tabla está siempre visible (R-45).

**R-38 ✅ Jugar** (lotería tradicional). Se marca libre: se puede poner un frijol en cualquier carta y no hay corrección inmediata. Todo se revisa hasta que se pide "¡Lotería!" (R-18). Auto-marcar está disponible como ayuda de accesibilidad.
- R-38.1 · Dado Jugar · Cuando se toca una carta que no ha salido · Entonces se pone el frijol sin aviso.

**R-39 ✅ Practicar** (aprender). Cada toque recibe respuesta inmediata:
- R-39.1 · **Acierto.** Cuando se toca la carta recién cantada · Entonces se pone el frijol, aparece "¡Eso!" y la palabra se ve en los dos idiomas del jugador ("el cangrejo · apanquray").
- R-39.2 · **Atrasada.** Cuando se toca una carta que salió antes · Entonces se pone el frijol y aparece "Esa ya había salido".
- R-39.3 · **No es.** Cuando se toca una carta que no ha salido · Entonces **no** se pone el frijol, aparece "Esa no es. Escucha otra vez" con el botón "Otra vez", y cuenta como intento.
- R-39.4 · **"No la tengo".** Hay un botón para decir que la carta cantada no está en la tabla. Así se practica también cuando la carta no salió en tu tabla, que es ~70% de las veces (16 de 54). Si no está: "¡Bien! No está en tu tabla". Si sí está: "Sí la tienes, búscala", y cuenta como intento.
- R-39.5 · **Ayuda.** Al tercer intento fallido con la misma carta · Entonces la carta correcta brilla en la tabla (o aparece "No estaba en tu tabla") junto con la palabra en los dos idiomas. Esa carta queda como "para repasar".
- R-39.6 · Auto-marcar no aparece en Practicar, porque haría el ejercicio por el jugador.

**R-40 ✅ Practicar no estorba a la lotería.** En Practicar no se puede marcar una carta que no salió, así que las marcas siempre son correctas y "¡Lotería!" funciona igual que en Jugar.
- R-40.1 · Dada una jugadora en Practicar con la figura completa · Cuando pide lotería · Entonces vale igual que en Jugar.

**R-41 ✅ Resumen de práctica.** Al terminar la ronda, quien practicó ve tres cosas: cuántas palabras escuchó, cuántas acertó al primer intento y la lista "para repasar" con dibujo y la palabra en sus dos idiomas. Se queda **solo en el teléfono**: no viaja al cantor, no se guarda en ningún servidor y no hay ranking.
- R-41.1 · Dada una ronda con 12 cartas oídas, 9 al primer intento y 3 con ayuda · Cuando termina · Entonces el resumen dice 12, 9 y lista esas 3.

## 10. Cómo se gana y cómo se pierde

**R-42 ✅ Ganar = completar la figura y que el cantor lo confirme.** El jugador pide "¡Lotería!" en su teléfono y el cantor valida (R-18). En el teléfono se celebra con "¡Lotería!" y en el cantor se muestra la tabla con la figura resaltada (R-22). Pueden ganar varios en la misma carta (R-21), y el "dormido" también gana (R-19).

**R-43 ✅ Perder no castiga.** Si la ronda termina sin tu lotería, la pantalla dice "Esta vez no fue. ¡Otra ronda!" y, si practicabas, tu resumen (R-41). No hay puntos ni ranking entre rondas, y la tabla se conserva para la siguiente. Pedir lotería sin tenerla es "¡Casi!", sin castigo (R-20).

**R-44 ✅ Cuándo se acaba la ronda.** Cuando el cantor pulsa "Terminar ronda" (en cualquier momento), o cuando ya salieron las 54 cartas (R-10). Si se acaba el mazo sin ninguna lotería pedida, el cantor ve "Se acabaron las cartas" y la ronda termina sin ganadores.
- R-44.1 · Dadas las 54 cartas cantadas y ninguna lotería · Cuando se pide "siguiente" · Entonces la ronda termina con `winners` vacío.

---

## Decisiones del concurso (2026-10-26, César)

| # | Decisión | Efecto en las reglas |
|---|---|---|
| D1 | Se canta en náhuatl, maya y quechua con palabras de diccionario **con fuente** y voz **Meta MMS-TTS pregrabada** | R-02, R-03, R-30, R-31. Licencia de MMS: CC-BY-NC 4.0 (no comercial, con atribución) |
| D2 | Náhuatl = **Huasteca oriental** (`nhe`, modelo `facebook/mms-tts-nhe`) | Las palabras se escriben en ortografía moderna sin macrones |
| D3 | Quechua = **Cusco** (`quz`, `facebook/mms-tts-quz`) · Maya = **yucateco** (`yua`, `facebook/mms-tts-yua`) | Coincide con los códigos del PRD |
| D4 | **El mazo solo lleva cartas que tienen palabra con fuente en los 5 idiomas** | Permite R-03 y R-32: cualquier carta en cualquier idioma, en cualquier momento |
| D5 | Demo con **teléfonos reales**: Rob crea Supabase + Vercel | — |
| D6 | **Fuera de alcance hoy:** modo offline (PWA) | — |
| D7 | **Todo se juega en el teléfono** | Se eliminan R-23, R-24 y R-25 |

## Decisiones abiertas

| Regla | Pregunta | ◆ Recomendación |
|---|---|---|
| R-28 | ¿Mensaje de sala llena? | No hoy |

## Cambios que esto implica en el código (`docs/plan/00-SHARED.md`)

1. **R-09:** la sala tiene `deckSecret` (solo en el cantor). `deckOrder(deckSecret, roundNo, cardIds)`, y `round` lleva solo `seed`.
2. **R-02, R-03:** cada nombre en `nah`/`yua`/`quz` lleva `source` y `audio`. Los 5 idiomas se ofrecen siempre, sin filtros.
3. **R-06:** la asignación de índices usa `pickTablaIndex(seed, taken, startAt)`.
4. **R-16/R-17:** `PatternId` tiene 8 valores; los ajustes del cantor llevan `pattern: PatternId | { surprise: 'easy' | 'medium' | 'hard' | 'any' }`. El mensaje `round` siempre lleva la figura ya sorteada.
5. **R-32, R-38, R-39:** el teléfono guarda `listenLang`, `labelLang`, `mode: 'play' | 'practice'` y `hearOnPhone`, todos cambiables a media ronda. No viajan por la red. Test ids: `mode-toggle`, `listen-lang`, `label-lang`, `hear-toggle`, `replay-button`, `not-in-tabla-button`, `practice-feedback`, `practice-summary`.
6. **R-45:** la tabla del jugador no vive dentro de ningún modal, pestaña o vista que se pueda ocultar.
7. **Contenido:** el mazo es el de [catalogo.md §B](catalogo.md).

---

## Delta de versiones

### v0 → v1 (2026-10-26)

**Solicitudes de César en este cambio y dónde quedaron**

| # | Solicitud | Reglas |
|---|---|---|
| 1 | Un jugador no puede jugar si no ve su tabla: tabla aleatoria de 16 imágenes (4×4), siempre visible | R-45 (nueva), R-04, R-15, §9 |
| 2 | En cualquier momento el jugador puede cambiar el idioma en que le cantan; por eso solo usamos palabras que existen en los 5 idiomas | R-32, R-27, D4 |
| 3 | Nunca decir "bingo": es lotería, un juego pensado para México | R-33 |
| 4 | Quitar todo lo que diga "pendiente de revisión por hablantes nativos" o parecido: se muestra lo que hicimos | R-02, R-03, R-30, R-31, D1; se elimina R-37 |
| 5 | Quitar las tablas impresas y el juego en papel: fuera del alcance de hoy | R-05, R-06, R-18, R-28, R-34, R-42, §9, D7; se eliminan R-23, R-24, R-25 |
| 6 | El juego canta todos los idiomas | R-46 (nueva), R-03, R-14, R-30, R-35 |

**Agregadas**
- **R-45** 🔒 La tabla siempre está visible; lo único que se puede ocultar es la carta cantada.
- **R-46** 🔒 El juego canta los 5 idiomas con voz; ningún idioma queda mudo ni solo como texto.
- **R-03.2**, **R-11.2**, **R-30.1**, **R-30.2**, **R-32.2**, **R-32.3**, **R-33.1**: ejemplos nuevos (todos los idiomas tienen texto y audio, cambio de idioma a media ronda, "bingo" prohibido).
- **D7**: todo se juega en el teléfono.

**Cambiadas**
- **R-01:** ya no exige 9 por categoría; el reparto es el del mazo de catalogo.md §B (54 cartas, 6 categorías).
- **R-02:** se quita el estado `draft`/`reviewed`/`approved` y el ocultamiento por `VITE_HIDE_UNREVIEWED`; queda "palabras con fuente, nunca inventadas".
- **R-03:** pasa de "solo idiomas aprobados" a 🔒 "los 5 idiomas siempre se eligen y se cantan".
- **R-04:** dice explícitamente "tabla aleatoria de 16 imágenes".
- **R-05, R-06:** se quitan las menciones a papel e impresión.
- **R-11, R-12, R-22:** de ❓ a ✅ (decisiones tomadas), con ejemplos del mazo actual (cangrejo).
- **R-14:** el rotativo recorre los 5 idiomas; el ejemplo es con `es, en, nah, yua, quz`.
- **R-15:** aclara que lo que se oculta es la carta cantada, nunca la tabla.
- **R-18:** sin la distinción "en teléfono" (todo es en teléfono).
- **R-27:** también recupera los idiomas elegidos.
- **R-28:** la recomendación pasa a "no hoy" (ya no menciona tablas de papel).
- **R-30:** de "sin voz sintética; 'sin grabación todavía'" a "cada idioma tiene su audio y siempre se canta".
- **R-31:** de "voz del navegador solo es/en" a "créditos de voz y fuentes"; la voz del navegador para es/en pasa a R-30.
- **R-32:** "Escucho" y "Entiendo" se pueden cambiar en cualquier momento de la ronda, sin perder tabla ni marcas; es la razón de D4.
- **R-33:** "bingo" se agrega a las palabras prohibidas; el juego se llama lotería en todas partes.
- **R-34:** se quita "quien juega en papel"; los ejemplos usan náhuatl, maya y quechua.
- **R-35:** "Oír en mi teléfono" viene encendido para todos (antes, apagado en Jugar).
- **R-36:** "Otra vez" existe en los dos modos y repite en el idioma "Escucho".
- **R-42:** se quita "lo grita (papel)".
- **§9 (Modos):** se quitan "jugadores en papel".
- **D1:** sin etiqueta de advertencia en pantalla; la atribución de MMS va en Créditos (R-31).
- **D6:** queda solo "modo offline"; las tablas impresas pasan a D7.

**Eliminadas**
- **R-23** (código de tabla impresa), **R-24** (lotería en papel), **R-25** (rango de números papel/teléfono).
- **R-37** (sin nombre o sin grabación): ya no aplica, porque todas las cartas tienen nombre y audio en los 5 idiomas (R-03, R-30).
- Los textos de "sin grabación todavía", "pendiente de revisión" y advertencias de revisión por hablantes.
