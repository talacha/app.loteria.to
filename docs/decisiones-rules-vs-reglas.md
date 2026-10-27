# Decisiones pendientes: `rules.md` (Rob) vs `reglas.md` (César)

**Para:** Rob · **De:** César · **Fecha:** 2026-10-26 · **Compara:** [rules.md](rules.md) (commit `2163db0`) con [reglas.md](reglas.md) v1 (commit `b8ba34e`).

**Cómo usarlo:** en cada decisión marca una opción con `[x]` y, si quieres, deja una nota. Al final, el documento que pierda se ajusta al que gane. Mientras una decisión siga abierta, la app no debe mezclar las dos versiones.

**Postura de César:** reglas.md v1 manda en todo lo que contradice a rules.md (decisión 0). Donde rules.md trae algo que reglas.md no menciona, se puede sumar (decisiones 13 y 14).

---

## 0. ¿Qué documento manda?

Hoy `CLAUDE.md` dice que `rules.md` define cómo se juega una ronda y que `reglas.md` es solo "César's rules reference". Así, cualquier agente sigue rules.md cuando los dos chocan.

- [ ] **A (César):** `reglas.md` manda. `CLAUDE.md` se corrige y `rules.md` se reescribe como traducción técnica de reglas.md, o se archiva.
- [ ] **B:** `rules.md` manda y `reglas.md` se ajusta.
- Nota de Rob:

## 1. El mazo (urgente: afecta audio y textos)

| | rules.md / `main` hoy | reglas.md v1 |
|---|---|---|
| Cartas | Mazo de Rob (jaguar, colibrí, llama, cóndor, escuela, biblioteca…) | Mazo de César: [catalogo.md §B](catalogo.md), commit `8c96117` |
| Fuente de las palabras en náhuatl, maya y quechua | Campo `source` del tipo "Classical/Central Nahuatl, unverified draft" y "from memory; page not checked". Hay préstamos del español como `turtuga` (quz) | Cada palabra con la URL de un diccionario (IDIEZ, UADY, MINEDU Perú), según R-02 |
| Audio | Ninguno | 162 audios MMS en `public/audio/{nah,yua,quz}/{id}.m4a` |

Con el mazo actual, solo 23 de las 54 cartas tienen audio, y en 22 combinaciones la palabra del audio no coincide con el texto (por ejemplo, rana en náhuatl: `cueyatl` vs `pechpechin`).

- [ ] **A (César):** se restaura el mazo de César (`git show 8c96117:src/content/cards.json`) y se adaptan los campos que la app necesite (`emoji`, `tags`, `verso`, `riddle`).
- [ ] **B:** se queda el mazo de Rob. Hay que conseguir fuente con URL para sus 162 palabras indígenas y generar el audio de las 31 cartas nuevas. César puede generar el audio en minutos, pero solo para palabras con fuente.
- Nota de Rob:

## 2. ¿Qué idiomas se ofrecen?

- **rules.md §1.1:** "Only languages whose names are approved are offered in production". La app muestra "pendiente de revisión" y esconde las lenguas indígenas.
- **reglas.md R-03, R-46:** los 5 idiomas siempre se eligen y siempre se cantan. No hay textos de "pendiente de revisión".
- [ ] **A (César):** los 5 siempre. Se quitan los textos de pendiente en `src/app/home/strings.*.json`, `src/app/deck/strings.es.json`, `src/content/i18n/es.json` y `src/content/credits.json`.
- [ ] **B:** solo los idiomas aprobados.
- Nota de Rob:

## 3. Audio

- **rules.md §2.2:** "audio where a reviewed recording exists" (hoy, ninguno).
- **reglas.md R-30, R-31:** náhuatl, maya y quechua con audio MMS pregrabado; español e inglés con la voz del navegador; créditos de MMS en la pantalla de créditos.
- [ ] **A (César):** audio MMS en las 3 lenguas.
- [ ] **B:** solo grabaciones revisadas.
- Nota de Rob:

## 4. Cómo se marca una carta

- **rules.md §3:** si la carta está en tu tabla, aparecen **3 opciones de dibujo** (la correcta y 2 distractores) y marcas eligiendo la correcta. Si no, "No está en tu tabla". Si se acaba el tiempo sin elegir, no se marca.
- **reglas.md R-38, R-39:** se toca la carta **directamente en la tabla**. En Jugar se marca libre; en Practicar hay respuesta inmediata ("¡Eso!", "Esa no es. Escucha otra vez", botón "No la tengo", ayuda al tercer intento).
- [ ] **A (César):** se toca directo en la tabla (Jugar / Practicar). Es la lotería que todos conocen y el ejercicio de idioma es escuchar y encontrar la carta en tu tabla.
- [ ] **B:** 3 opciones de dibujo.
- [ ] **C:** 3 opciones como ayuda dentro de Practicar (por ejemplo, después del segundo intento).
- Nota de Rob:

## 5. ¿Se ve el dibujo de la carta cantada?

- **rules.md §2.3:** el dibujo no se muestra mientras se canta; se revela al cerrar la ventana de la carta.
- **reglas.md R-15:** el dibujo se ve. Solo se oculta si el cantor activa Escucha **y** el jugador prende "Practicar de oído". La tabla del jugador nunca se oculta (R-45).
- [ ] **A (César):** se ve por default; ocultarlo es opcional por jugador.
- [ ] **B:** oculto siempre durante el canto.
- Nota de Rob:

## 6. Puntos y empates

- **rules.md §4 y §5.3:** el primero en elegir bien gana 2 puntos. Si hay dos loterías en la misma carta, gana el que tenga más puntos.
- **reglas.md R-21, R-43:** sin puntos. Todas las loterías válidas durante la pausa cuentan, porque la latencia del Wi-Fi no es justa.
- [ ] **A (César):** sin puntos; el empate se comparte.
- [ ] **B:** puntos como desempate.
- Nota de Rob:

## 7. Qué pasa con una lotería válida

- **rules.md §5.4:** el cantor se detiene, todos ven la pantalla de ¡Lotería! y "Otra ronda" empieza con **tablas nuevas**.
- **reglas.md R-21, R-22, R-05.2:** la ronda se pausa, el cantor muestra la tabla con la figura resaltada y elige "Seguir" (más loterías) o "Terminar ronda". **La tabla se conserva** entre rondas.
- [ ] **A (César):** pausa con "Seguir / Terminar" y la misma tabla.
- [ ] **B:** se detiene y se reparten tablas nuevas.
- Nota de Rob:

## 8. Figuras

- **rules.md §1.4:** 4 figuras (line, four corners, centre, full); default: line.
- **reglas.md R-16, R-17:** 8 figuras en 3 niveles, más "Sorpresa" por nivel. Celdas en [catalogo.md §A](catalogo.md).
- [ ] **A (César):** 8 figuras + Sorpresa.
- [ ] **B:** 4 figuras.
- Nota de Rob:

## 9. Idioma del jugador

- **rules.md §1.1:** se elige un idioma de canto al entrar.
- **reglas.md R-32:** dos idiomas, "Escucho" y "Entiendo". **Se cambian en cualquier momento** de la ronda sin perder tabla ni marcas; por eso el mazo solo lleva palabras que existen en los 5 idiomas.
- [ ] **A (César):** dos idiomas, cambiables en cualquier momento.
- [ ] **B:** uno solo, al entrar.
- Nota de Rob:

## 10. Cantor automático o con controles

- **rules.md §2.1:** solo automático, sin "siguiente carta" manual; pausa, reanudar y velocidad.
- **reglas.md R-12, R-13:** automático; el reloj cuenta desde que termina el audio. Además hay "siguiente" y "repetir" manuales.
- [ ] **A (César):** automático + siguiente/repetir manuales.
- [ ] **B:** solo automático.
- Nota de Rob:

## 11. Tablas impresas

- **rules.md §1.3, §6:** hay jugadores en papel con código de 6 caracteres.
- **reglas.md D7:** todo se juega en el teléfono; R-23, R-24 y R-25 se eliminaron.
- [ ] **A (César):** sin papel hoy. Se quita §6 de rules.md y la ruta de impresión no se muestra.
- [ ] **B:** papel se queda.
- Nota de Rob:

## 12. Mensajes de red

Se derivan de las decisiones 4, 6 y 7. rules.md §7 usa `pick`, `pickResult` y `scores`; reglas.md usa `call`, `welcome`, `claim` y `claimResult` (`docs/plan/00-SHARED.md` §4 del commit `3def4dd`). Se decide al cerrar 4, 6 y 7.

## 13. Lo que rules.md trae y reglas.md no tiene (se puede sumar)

- **§5.2:** el teléfono detecta la figura completa y sugiere "¡Lotería!"; el toque sigue mandando el reclamo. ◆ César: sí, se suma a reglas.md.
- **§3.6:** distractores justos (si se adopta la decisión 4C).
- [ ] Rob está de acuerdo en sumarlas.

## 14. Proceso: commits firmados

`main` no tiene protección de rama, pero los archivos de César se quitaron por venir en commits sin firma (`43b560c`). Los 162 audios y `catalogo.md` se vuelven a subir en este mismo cambio, también sin firma.

- [ ] **A:** Rob acepta commits de César sin firma y no se vuelven a quitar.
- [ ] **B:** César configura la firma de commits en su Mac antes del siguiente push.
- Nota de Rob:

## En lo que ya estamos de acuerdo

- El cantor es la única autoridad y quien crea la sala corre la pantalla del cantor (rules §1.2, §7 · reglas R-08).
- Tabla de 4×4 con 16 cartas, una por teléfono (rules §1.3 · reglas R-04, R-07).
- "¡Casi!" sin castigo (rules §3.4, §5.5 · reglas R-20).
- Auto-marcar como ayuda de accesibilidad (rules §3.5 · reglas R-38).
- Modo Escucha que oculta el texto (rules §2.2 · reglas R-15).
- El orden del mazo sale de un secreto del cantor (reglas R-09). rules.md no lo menciona, pero no lo contradice.
