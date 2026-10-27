# Reglas del juego — Lotería de los Pueblos

**Estado:** borrador v0 (2026-10-26) · **Dueño:** César · **Consume:** Rob (app y red) · **Fuente superior:** [PRD.md](PRD.md)

Este documento es el contrato del juego. Cada regla tiene un ID (`R-xx`) y uno o más ejemplos **Dado / Cuando / Entonces**. **Cada ejemplo se convierte en un test** del motor (`src/engine/**`) con el ID en el nombre del test (`it('R-12.1 …')`). Si un comportamiento no tiene ejemplo, no está garantizado.

Marcas:
- ✅ **decidido**: ya se puede programar.
- ❓ **decide César**: trae una recomendación (◆). Mientras no se decida, se programa la recomendación.
- 🔒 **regla dura**: viene del PRD y no se negocia en este documento.

---

## 1. El mazo

**R-01 ✅ Mazo.** 54 cartas originales, numeradas del 1 al 54, con 9 por categoría: animales, plantas y comida, cielo, tierra, hecho a mano, lugares. No hay figuras humanas ni roles humanos con género.
- R-01.1 · Dado el mazo · Cuando se cuenta por categoría · Entonces cada una de las 6 tiene exactamente 9.

**R-02 🔒 Nombres en lenguas indígenas.** Un nombre en `nah`, `yua` o `quz` nunca lo inventa una persona ni una IA. Cada nombre lleva fuente (diccionario o hablante) y estado: `draft` (con fuente, sin revisar), `reviewed` o `approved` (aprobado por hablante nativo). *PRD §1.5, §3.1, no-objetivos.*
- R-02.1 · Dado un nombre `nah` sin campo `source` · Cuando se valida el contenido · Entonces la validación falla.
- R-02.2 · Dado un nombre `nah` en `draft` y `VITE_HIDE_UNREVIEWED` encendido (producción) · Cuando la app pide el nombre · Entonces recibe `null` y no lo muestra.

**R-03 ✅ Idioma que se puede cantar.** Un idioma aparece en el selector del cantor solo si las 54 cartas tienen nombre en ese idioma: `approved` en producción, cualquier estado en modo validación (bandera apagada).
- R-03.1 · Dado que solo 3 cartas tienen nombre `nah` · Cuando se listan los idiomas cantables · Entonces `nah` no aparece, ni siquiera en modo validación.

## 2. Las tablas

**R-04 ✅ Forma.** 4×4 (16 cartas), sin repetidas, máximo 5 por categoría.
- R-04.1 · Dado cualquier seed e índice · Cuando se genera la tabla · Entonces tiene 16 cartas distintas y ninguna categoría pasa de 5.

**R-05 ✅ Determinismo.** La misma sala y el mismo número de tabla dan siempre la misma tabla, en el teléfono, en el papel y en el cantor. La tabla no cambia entre rondas.
- R-05.1 · Dado el seed `K7M2Q9R4T6V8X3Z1` y la tabla 3 · Cuando se genera en dos dispositivos · Entonces las 16 cartas son idénticas y están en el mismo orden.
- R-05.2 · Dada la tabla 3 en la ronda 1 · Cuando empieza la ronda 2 · Entonces la tabla 3 es la misma.

**R-06 ✅ Parecido entre tablas (decidido 2026-10-26).** Sin control, en una sala de 40 jugadores casi seguro habrá dos tablas que compartan 9 o más cartas: P ≈ 0.998, y P ≈ 0.60 de que compartan 10 o más (cálculo hipergeométrico, 780 pares). Por eso, al asignar una tabla, el cantor y la impresión se saltan los índices que compartan más de 8 cartas con alguna tabla ya repartida en la sala (teléfonos y papel). Se salta ~1% de los índices.
- R-06.1 · Dadas 40 tablas repartidas · Cuando se compara cada par · Entonces ninguno comparte más de 8 cartas.

**R-07 ✅ Una tabla por teléfono** en v1. *(En la lotería tradicional se juegan varias; queda para después.)*

## 3. La ronda

**R-08 🔒 El cantor manda.** El dispositivo cantor es la única autoridad: baraja, canta y decide cada "¡Lotería!". Los teléfonos solo muestran y piden. *PRD §3.6.*

**R-09 ✅ Nadie puede adivinar la siguiente carta.** *(Hallazgo de esta revisión: el plan anterior lo permitía.)* El seed de la sala viaja a los teléfonos para que armen su tabla. Si el orden del mazo saliera del mismo seed, cualquiera con conocimientos técnicos podría calcular las cartas que vienen. Por eso el orden del mazo sale de un **secreto del cantor** (`deckSecret`) que nunca sale de su dispositivo.
- R-09.1 · Dado un mensaje `round` · Cuando se inspeccionan sus campos · Entonces no contiene `deckSecret`.
- R-09.2 · Dado el mismo `seed` con dos `deckSecret` distintos · Cuando se baraja la ronda 1 · Entonces los órdenes son distintos, y las tablas no cambian.

**R-10 ✅ Sin repetir.** En una ronda, cada carta se canta una sola vez. A los 54 cantos la ronda se cierra sola.
- R-10.1 · Dada una ronda · Cuando se cantan 54 cartas · Entonces las 54 son distintas y el siguiente "siguiente" no canta nada y cierra la ronda.

**R-11 ❓ Cómo se canta una carta.** Tradicionalmente el cantor dice el verso y luego el nombre ("…¡el ajolote!").
- ◆ **Recomendación:** en modo Normal, verso y luego nombre. En modo Rápido, solo el nombre. En modo Escucha, solo el nombre y sin texto en pantalla (R-15).
- R-11.1 · Dada velocidad Normal y la carta ajolote en `es` · Cuando se canta · Entonces se dice el verso en español y después "el ajolote".

**R-12 ❓ El reloj entre cartas.**
- ◆ **Recomendación:** el intervalo (6–20 s) empieza a contar **cuando termina el audio** de la carta, no cuando empieza. Así un verso largo no se come el tiempo para buscar la carta.
- R-12.1 · Dada velocidad 10 s y un audio de 4 s · Cuando se canta · Entonces la siguiente carta llega 14 s después del inicio.

**R-13 ✅ Pausa, repetir, siguiente.**
- R-13.1 · Dada una ronda en pausa · Cuando el reloj llega a cero · Entonces no se canta nada.
- R-13.2 · Cuando se pide "repetir" · Entonces se vuelve a decir la carta actual, sin avanzar ni duplicarla en la lista de cantadas.

**R-14 ✅ Idioma rotativo.** La carta *i* se canta en `idiomas[i mod n]`, con los idiomas cantables en este orden fijo: `es, en, nah, yua, quz`.
- R-14.1 · Dados los idiomas cantables `es, en` en modo rotativo · Cuando se cantan las cartas 0, 1 y 2 · Entonces salen en `es`, `en` y `es`.

**R-15 ✅ Modo Escucha (decidido 2026-10-26).** El cantor activa Escucha para toda la ronda: nadie ve el **texto** de la carta mientras suena. Además, **cada dispositivo** (la pantalla del cantor y cada teléfono, por separado) tiene el interruptor **"Practicar de oído"**, apagado por default, que oculta también el **dibujo**. Así cada quien elige: jugar (ve el dibujo) o practicar el idioma (solo oye). Al llegar la siguiente carta, la anterior se revela completa en el historial. El mensaje `round` no cambia (`mode: 'normal' | 'escucha'`); el interruptor es local y se recuerda en localStorage.
- R-15.1 · Dado el modo Escucha y "Practicar de oído" apagado · Cuando se canta una carta · Entonces se ve el dibujo, pero no el nombre.
- R-15.2 · Dado el modo Escucha y "Practicar de oído" encendido en un teléfono · Cuando se canta · Entonces ese teléfono no muestra ni nombre ni dibujo, y otro teléfono con el interruptor apagado sí ve el dibujo.
- R-15.3 · Dado el modo Escucha · Cuando llega la carta siguiente · Entonces el historial muestra la anterior con nombre y dibujo.
- R-15.4 · Dado el modo Normal · Entonces el interruptor "Practicar de oído" no aparece.

## 4. Figuras (las formas de llenar)

**R-16 ✅ Catálogo de figuras.** v1 trae 8 figuras en 3 niveles: chorro, cuadrito, cuatro esquinas, centrito, la L, la equis, marco y llena. Las celdas exactas y su duración simulada están en [catalogo.md §A](catalogo.md), que es la fuente para el motor. `PatternId` pasa a `'line' | 'square' | 'corners' | 'center' | 'ele' | 'x' | 'frame' | 'full'`.
- R-16.1 · Dado chorro · Cuando la columna 2 (celdas 2, 6, 10, 14) está cantada y marcada · Entonces vale.
- R-16.2 · Dado cuadrito · Cuando el bloque 9, 10, 13, 14 está cantado y marcado · Entonces vale.
- R-16.3 · Dada la equis · Cuando las 8 celdas están completas salvo la 6 · Entonces es "¡Casi!" y falta la carta de la celda 6.
- R-16.4 · Para cada figura · la lista de formas válidas del motor es idéntica a la de catalogo.md §A (un test compara las dos listas).

**R-17 ✅ Figura sorpresa (decidido 2026-10-26: "plantillas aleatorias").** Además de elegir una figura fija, el cantor puede elegir **"Sorpresa"** con un nivel (Fácil, Media, Difícil o Cualquiera). Al empezar la ronda, el cantor sortea una figura de ese nivel y **la anuncia antes de la primera carta**, en pantalla y en todos los teléfonos. Nadie juega sin saber qué figura busca. El sorteo usa el secreto del cantor (R-09), así que nadie lo puede adivinar, y no repite la figura de la ronda anterior si el nivel tiene más de una.
- R-17.1 · Dado "Sorpresa · Fácil" · Cuando empieza la ronda · Entonces la figura es `line` o `square`, y el mensaje `round` la lleva antes de cualquier `call`.
- R-17.2 · Dado "Sorpresa · Media" y la ronda anterior con `corners` · Cuando empieza la nueva ronda · Entonces la figura no es `corners`.
- R-17.3 · Dado el mismo secreto y la misma ronda · Cuando se sortea dos veces · Entonces sale la misma figura (determinista y reanudable tras recargar).

## 5. "¡Lotería!"

**R-18 ✅ Cuándo vale.** Vale si alguna forma completa del patrón tiene todas sus cartas **cantadas** y, en teléfono, también **marcadas**. Las marcas de más, sobre cartas no cantadas o fuera del patrón, no importan.
- R-18.1 · Dado el patrón esquinas con las 4 esquinas cantadas y marcadas, y otra carta marcada sin cantar · Cuando se pide lotería · Entonces vale.
- R-18.2 · Dadas 3 esquinas cantadas y la 4ª marcada pero no cantada · Cuando se pide lotería · Entonces es "¡Casi!" y falta la 4ª.
- R-18.3 · Dadas las 4 esquinas cantadas pero una sin marcar en el teléfono · Cuando se pide lotería · Entonces es "¡Casi!" y falta esa.

**R-19 ✅ El "dormido" vale (decidido 2026-10-26).** Alguien que completó su forma en la carta 20 y pide lotería en la 25 sí tiene lotería. El juego es familiar y de salón: se premia jugar, no los reflejos.
- R-19.1 · Dada una forma completa desde el canto 20 · Cuando se pide en el canto 25 · Entonces vale.

**R-20 ✅ "¡Casi!" sin castigo.** Una lotería que no vale muestra "¡Casi!" y las cartas que faltan. Solo se espera 3 s para volver a pedir. *PRD §3.3.*
- R-20.1 · Dado un "¡Casi!" · Cuando el mismo jugador pide otra vez a los 2 s · Entonces el cantor lo ignora. A los 3.1 s sí lo revisa.

**R-21 ✅ Empates: cuentan todos (decidido 2026-10-26).** Una lotería válida pausa la ronda. Mientras está en pausa, todas las loterías válidas que lleguen cuentan; no gana "el primero en red", porque la latencia del Wi-Fi no es justa. Después el cantor elige "Seguir" (otra lotería más) o "Terminar ronda". En `end`, `winners` = todos los válidos.
- R-21.1 · Dados dos jugadores que completan con la misma carta · Cuando sus loterías llegan con 300 ms de diferencia · Entonces los dos son válidos.

**R-22 ❓ El cantor muestra la tabla ganadora.** En la lotería tradicional, el cantor revisa la tabla en voz alta.
- ◆ **Recomendación:** con una lotería válida, la pantalla del cantor muestra la tabla del jugador con la forma ganadora resaltada. Es verificable en público y le da emoción al momento.

## 6. Tablas de papel

**R-23 ✅ Código de tabla.** 6 caracteres: 5 de datos (sala + número de tabla) y 1 verificador. Se acepta en minúsculas, con espacios o guiones, y con O→0, I/L→1.
- R-23.1 · Dado un código válido · Cuando se cambia cualquier carácter por cualquier otro · Entonces se rechaza.
- R-23.2 · Dado un código de otra sala · Cuando se teclea · Entonces dice "Esta tabla es de otra sala".

**R-24 ✅ Lotería en papel.** Se valida igual que R-18, pero solo con "cantadas", porque el papel no tiene marcas digitales. El cantor teclea el código.

**R-25 ✅ Rango de números.** Papel del 0 al 9999 y teléfonos del 10000 al 32767. Al imprimir dos veces nunca se repiten números.

## 7. Jugadores

**R-26 ✅ Entrar tarde.** Se puede entrar en cualquier momento. El jugador recibe su tabla y la lista de lo ya cantado; con auto-marcar, se marcan solas.
- R-26.1 · Dadas 12 cartas cantadas · Cuando entra un jugador con auto-marcar · Entonces sus cartas que ya salieron aparecen marcadas.

**R-27 ✅ Volver a entrar.** El mismo teléfono (misma pestaña o recarga) recupera su misma tabla y sus marcas.

**R-28 ❓ Sala llena.** El PRD fija un máximo de 40.
- ◆ **Recomendación:** el jugador 41 ve "La sala está llena; pide una tabla de papel". Esto agrega un mensaje `roomFull` al contrato de red; es un cambio de contrato con Rob.

**R-29 ✅ Nombres.** Texto libre de 1 a 24 caracteres. Se permiten nombres repetidos, porque el glifo los distingue. Los nombres no salen del cantor ni se guardan en ningún servidor.

## 8. Idiomas y sonido

**R-30 🔒 Sin voz sintética en lenguas indígenas.** `nah`, `yua` y `quz` suenan **solo** con grabación de hablante nativo. Sin grabación, se muestra el texto y "sin grabación todavía". *PRD §3.2, no-objetivos.*
- R-30.1 · Dada una carta en `nah` sin grabación · Cuando se canta · Entonces no se llama a la voz del navegador y se muestra "sin grabación todavía".

**R-31 ✅ Voz del navegador** solo para `es` (`es-MX`) y `en` (`en-US`), y solo si no hay grabación.

**R-32 ✅ Dos idiomas por jugador (decidido 2026-10-26).** Al entrar, cada jugador elige:
- **"Entiendo":** el idioma de los nombres en su tabla.
- **"Escucho":** el idioma en que le cantan en su teléfono.

Los dos salen de los idiomas cantables (R-03) y por default son el idioma de la interfaz. Ejemplo: el abuelo canta en maya en la bocina; la nieta entiende español y escucha maya para aprender. El dibujo siempre se ve, salvo con "Practicar de oído" (R-15).
- R-32.1 · Dada una jugadora con "entiendo = es" y "escucho = en" · Cuando se canta conejo · Entonces su tabla dice "el conejo" y su teléfono canta "the rabbit".

**R-34 ✅ Un canto, muchos idiomas.** El cantor manda **la carta, no el texto** (`call{cardId, …}`). Cada dispositivo la dice y la escribe en su propio idioma:
- La pantalla y la bocina del cantor usan el idioma del cantor (o el rotativo, R-14).
- Cada teléfono usa su idioma "Escucho".
- Quien juega en papel oye la bocina del cantor.
- R-34.1 · Dados P1 con "escucho = en" y P2 con "escucho = es" · Cuando llega `call` de conejo · Entonces P1 muestra y dice "the rabbit", y P2 "el conejo", con el mismo mensaje.
- R-34.2 · Dado el cantor en rotativo cantando en `en` · Cuando llega la carta · Entonces un teléfono con "escucho = es" la dice en español; el rotativo solo afecta la bocina del cantor.

**R-35 ✅ Sonido en el teléfono.** El interruptor "Oír en mi teléfono" viene **apagado en Jugar y encendido en Practicar**. Al encenderlo aparece "Usa audífonos": 40 teléfonos sonando a la vez en un salón es ruido, no aprendizaje. El navegador solo deja sonar audio después de un toque, así que el botón de entrar a la sala "desbloquea" el sonido. ⚠️ Hay que verificarlo en un iPhone real.
- R-35.1 · Dado "Oír en mi teléfono" apagado · Cuando llega una carta · Entonces el teléfono no reproduce nada.

**R-36 ✅ No se enciman.** Si llega una carta nueva mientras el teléfono todavía dice la anterior, la anterior se corta y suena la nueva. En el teléfono solo se dice el nombre (el verso lo dice el cantor). En Practicar hay un botón "Otra vez" que repite el nombre las veces que se quiera.
- R-36.1 · Dado un nombre sonando · Cuando llega otra carta · Entonces se cancela el primero antes de decir el segundo.

**R-37 ✅ Sin nombre o sin grabación.** Para "Escucho" solo se ofrecen idiomas cantables (R-03). Si una carta no tiene grabación en una lengua indígena, el teléfono muestra el texto y "sin grabación todavía". Nunca se usa voz sintética (R-30).

## 9. Tono

**R-33 🔒 Palabras prohibidas** en textos de pantalla y cartas: ganar, ganaste, ganador(a/es), premio(s), apuesta, apostar, dinero, fichas, win(s), winner(s), won, prize(s), bet(s), betting, money, chips. Se dice "¡Lotería!", "completaste" y "frijoles". *PRD §3.8.* Este reglamento sí usa "ganar" y "perder" para explicar el juego; la pantalla nunca.

## 10. Modos del jugador: Jugar o Practicar

El juego tiene tres objetivos: **1) aprender idiomas, 2) jugar lotería, 3) inclusión.** Cada teléfono elige su modo y lo puede cambiar a media ronda sin perder sus marcas. Una misma sala mezcla jugadores de los dos modos y jugadores en papel.

**R-38 ✅ Jugar** (lotería tradicional). Se marca libre, como en papel: se puede poner un frijol en cualquier carta y no hay corrección inmediata. Todo se revisa hasta que se pide "¡Lotería!" (R-18). Auto-marcar está disponible como ayuda de accesibilidad.
- R-38.1 · Dado Jugar · Cuando se toca una carta que no ha salido · Entonces se pone el frijol sin aviso.

**R-39 ✅ Practicar** (aprender). Cada toque recibe respuesta inmediata:
- R-39.1 · **Acierto.** Cuando se toca la carta recién cantada · Entonces se pone el frijol, aparece "¡Eso!" y la palabra se ve en los dos idiomas ("el conejo · the rabbit").
- R-39.2 · **Atrasada.** Cuando se toca una carta que salió antes · Entonces se pone el frijol y aparece "Esa ya había salido".
- R-39.3 · **No es.** Cuando se toca una carta que no ha salido · Entonces **no** se pone el frijol, aparece "Esa no es. Escucha otra vez" con el botón "Otra vez", y cuenta como intento.
- R-39.4 · **"No la tengo".** Hay un botón para decir que la carta cantada no está en la tabla. Así se practica también cuando la carta no salió en tu tabla, que es ~70% de las veces (16 de 54). Si no está: "¡Bien! No está en tu tabla". Si sí está: "Sí la tienes, búscala", y cuenta como intento.
- R-39.5 · **Ayuda.** Al tercer intento fallido con la misma carta · Entonces la carta correcta brilla en la tabla (o aparece "No estaba en tu tabla") junto con la palabra en los dos idiomas. Esa carta queda como "para repasar".
- R-39.6 · Auto-marcar no aparece en Practicar, porque haría el ejercicio por el jugador.

**R-40 ✅ Practicar no estorba a la lotería.** En Practicar no se puede marcar una carta que no salió, así que las marcas siempre son correctas y "¡Lotería!" funciona igual que en Jugar.
- R-40.1 · Dada una jugadora en Practicar con la figura completa · Cuando pide lotería · Entonces vale igual que en Jugar.

**R-41 ✅ Resumen de práctica.** Al terminar la ronda, quien practicó ve tres cosas: cuántas palabras escuchó, cuántas acertó al primer intento y la lista "para repasar" con dibujo y la palabra en los dos idiomas. Se queda **solo en el teléfono**: no viaja al cantor, no se guarda en ningún servidor y no hay ranking (PRD §3.8, no-objetivos).
- R-41.1 · Dada una ronda con 12 cartas oídas, 9 al primer intento y 3 con ayuda · Cuando termina · Entonces el resumen dice 12, 9 y lista esas 3.

## 11. Cómo se gana y cómo se pierde

**R-42 ✅ Ganar = completar la figura y que el cantor lo confirme.** El jugador pide "¡Lotería!" (teléfono) o lo grita (papel); el cantor valida (R-18, R-24). En el teléfono se celebra con "¡Lotería!" y en el cantor se muestra la tabla con la figura resaltada (R-22). Pueden ganar varios en la misma carta (R-21), y el "dormido" también gana (R-19).

**R-43 ✅ Perder no castiga.** Si la ronda termina sin tu lotería, la pantalla dice "Esta vez no fue. ¡Otra ronda!" y, si practicabas, tu resumen (R-41). No hay puntos ni ranking entre rondas, y la tabla se conserva para la siguiente. Pedir lotería sin tenerla es "¡Casi!", sin castigo (R-20).

**R-44 ✅ Cuándo se acaba la ronda.** Cuando el cantor pulsa "Terminar ronda" (en cualquier momento), o cuando ya salieron las 54 cartas (R-10). Si se acaba el mazo sin ninguna lotería pedida, el cantor ve "Se acabaron las cartas" y la ronda termina sin ganadores.
- R-44.1 · Dadas las 54 cartas cantadas y ninguna lotería · Cuando se pide "siguiente" · Entonces la ronda termina con `winners` vacío.

---

## Decisiones del concurso (2026-10-26, César)

| # | Decisión | Efecto en las reglas |
|---|---|---|
| D1 | Cantar en náhuatl, maya y quechua **hoy**, sin hablante nativo: palabras de diccionario **con fuente** y voz **Meta MMS-TTS pregrabada**, con etiqueta visible "Palabra de diccionario · voz generada por IA · puede tener errores" | **Sustituye** el 🔒 de R-02, R-30 y R-37 durante el concurso: el estado `draft` con fuente se puede cantar si lleva la etiqueta. Sigue prohibido inventar palabras: sin fuente no hay palabra. Rob tiene que aceptar el cambio al PRD. Licencia de MMS: CC-BY-NC 4.0 (no comercial) ⚠️ |
| D2 | Náhuatl = **Huasteca oriental** (`nhe`, modelo `facebook/mms-tts-nhe`) | Las palabras se escriben en ortografía moderna sin macrones ("tochtli", no "tōchtli") |
| D3 | Quechua = **Cusco** (`quz`, `facebook/mms-tts-quz`) · Maya = **yucateco** (`yua`, `facebook/mms-tts-yua`) | Coincide con los códigos del PRD |
| D5 | Demo con **teléfonos reales**: Rob crea Supabase + Vercel | SupabaseTransport ya no es opcional hoy |
| D6 | **Fuera hoy:** tablas de papel/PDF y modo offline (PWA) | R-23 a R-25 y el modo offline quedan para después; las e2e y el copy lint se quedan |
| D4 | **El mazo solo lleva cartas que tienen palabra con fuente en los 5 idiomas.** Las "modernas" (escuela, ciudad, campamento…) salen | R-03 se cumple por construcción: los 5 idiomas son cantables. catalogo.md §B se rehace con la investigación por lengua (75 candidatos → 54) |
| R-11 | Verso y luego nombre en Normal; solo nombre en Rápido y en lenguas indígenas (no hay versos indígenas con fuente) | ✅ |
| R-12 | El reloj cuenta desde que termina el audio | ✅ |
| R-22 | Con una lotería válida, el cantor muestra la tabla con la figura resaltada | ✅ |

## Decisiones abiertas (resumen)

| Regla | Pregunta | ◆ Recomendación |
|---|---|---|
| R-28 | ¿Mensaje de sala llena? | Sí (cambio de contrato con Rob) |

## Cambios que esto implica en `docs/plan/00-SHARED.md`

1. **R-09:** la sala gana `deckSecret` (solo en el cantor). `deckOrder(deckSecret, roundNo, cardIds)` sustituye a `deckOrder(roomSeed, …)`, y `round` sigue llevando solo `seed`.
2. **R-02:** el `Card.names[lang]` de `nah`/`yua`/`quz` gana un campo `source` obligatorio.
3. **R-06 (aprobada):** la asignación de índices (cantor e impresión) usa `pickTablaIndex(seed, taken, startAt)`, una función nueva del motor.
4. **R-28:** si se aprueba, nuevo mensaje `{ t: 'roomFull'; seat }`.
5. **R-16/R-17:** `PatternId` pasa a 8 valores; los ajustes del cantor ganan `pattern: PatternId | { surprise: 'easy' | 'medium' | 'hard' | 'any' }`. El mensaje `round` siempre lleva la figura ya sorteada.
6. **R-32/R-38/R-39:** el jugador guarda en su teléfono `listenLang`, `mode: 'play' | 'practice'` y `hearOnPhone`; no viajan por la red. Nuevos test ids: `mode-toggle`, `listen-lang`, `hear-toggle`, `replay-button`, `not-in-tabla-button`, `practice-feedback`, `practice-summary`.
7. **Contenido:** el catálogo de 54 cartas de [catalogo.md §B](catalogo.md) sustituye la regla genérica de R1 en el plan de Rob.
