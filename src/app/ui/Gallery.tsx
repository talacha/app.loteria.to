import { useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { cards, cardName, getCard, type Card } from '@content';
import type { Lang } from '@engine';
import {
  Button,
  CallPanel,
  CardArt,
  ChoiceTile,
  FeedbackStrip,
  HistoryStrip,
  LanguageCard,
  PapelPicado,
  PaperCard,
  Panel,
  Pill,
  ProgressBar,
  QrCard,
  ReviewTag,
  RoomCodeTiles,
  RosterTile,
  Tabla,
  WordCard,
  type CellData,
} from './index';
import styles from './Gallery.module.css';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.group}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

const pick = (id: string): Card => getCard(id) ?? (cards[0] as Card);
const label = (c: Card) => cardName(c, 'es')?.text ?? c.id;

/** Dev-only: every primitive and state, for visual review. Mount at /ui. */
export default function Gallery() {
  const [lang, setLang] = useState<Lang>('es');
  const [marked, setMarked] = useState<string[]>(['sol']);
  const ids = [
    'sol',
    'luna',
    'jaguar',
    'nopal',
    'maiz',
    'rana',
    'frijol',
    'nube',
    'montana',
    'colibri',
    'tortuga',
    'estrella',
    'mariposa',
    'aguacate',
    'chile',
    'tomate',
  ];
  const cells: CellData[] = ids.map((id) => {
    const c = pick(id);
    return {
      id: c.id,
      emoji: c.art,
      label: label(c),
      marked: marked.includes(id),
      winning: id === 'luna',
    };
  });
  const langs: [Lang, string, string][] = [
    ['nah', 'Náhuatl', 'ocelotl'],
    ['yua', 'Maya yucateco', 'balam'],
    ['quz', 'Quechua', ''],
    ['es', 'Español', 'el Jaguar'],
    ['en', 'English', 'the Jaguar'],
  ];
  return (
    <MemoryRouter>
      <main className={styles.gallery} id="main">
        <h1>UI gallery</h1>

        <Group title="Button">
          <div className={styles.row}>
            <Button fit>Crear una sala</Button>
            <Button fit variant="secondary">
              Entrar
            </Button>
            <Button fit variant="link">
              Imprimir tablas
            </Button>
            <Button fit loading>
              Cargando
            </Button>
            <Button fit disabled>
              Deshabilitado
            </Button>
            <Button fit to="/">
              Enlace
            </Button>
          </div>
        </Group>

        <Group title="Pill / ReviewTag">
          <div className={styles.row}>
            <Pill tone="jade" dot>
              Conectado
            </Pill>
            <Pill tone="nah">Náhuatl</Pill>
            <Pill tone="yua">Maya yucateco</Pill>
            <Pill tone="quz">Quechua</Pill>
            <Pill tone="es">Español</Pill>
            <Pill tone="en">English</Pill>
            <Pill tone="paper">Papel</Pill>
            <Pill tone="night">Automático</Pill>
          </div>
          <div className={styles.row}>
            <ReviewTag variant="word" />
            <ReviewTag variant="words" />
            <ReviewTag variant="ai" />
          </div>
        </Group>

        <Group title="Panel / PaperCard">
          <div className={styles.cols}>
            <Panel>Panel</Panel>
            <Panel variant="dashed">Panel dashed</Panel>
            <PaperCard>PaperCard</PaperCard>
            <PaperCard size="lg">PaperCard lg</PaperCard>
          </div>
        </Group>

        <Group title="LanguageCard">
          <div role="radiogroup" aria-label="Idioma" className={styles.cols}>
            {langs.map(([l, name, sample]) => (
              <LanguageCard
                key={l}
                lang={l}
                name={name}
                sample={sample || undefined}
                review={l === 'nah' || l === 'yua' || l === 'quz'}
                selected={lang === l}
                onSelect={() => setLang(l)}
              />
            ))}
          </div>
        </Group>

        <Group title="RoomCodeTiles / RosterTile">
          <div className={styles.cols}>
            <PaperCard size="lg">
              <RoomCodeTiles code="K7MPQ" />
            </PaperCard>
            <div className={styles.group}>
              <RosterTile name="Itzel" glyph={<CardArt id="colibri" emoji="🐦" />} self />
              <RosterTile
                name="Mateo"
                glyph={<CardArt id="jaguar" emoji="🐆" />}
                detail="Español"
              />
              <RosterTile
                name="Ana"
                glyph={<CardArt id="rana" emoji="🐸" />}
                detail="tabla de papel"
              />
            </div>
          </div>
        </Group>

        <Group title="CallPanel / ProgressBar / FeedbackStrip">
          <CallPanel word="El Jaguar" review="word" progress={0.4} />
          <CallPanel word="El Jaguar" listening progress={0.7} />
          <ProgressBar value={0.6} tone="jade" label="Progreso" />
          <FeedbackStrip>Escucha y elige la carta.</FeedbackStrip>
          <FeedbackStrip tone="ok" title="¡Eso!">
            +2 puntos
          </FeedbackStrip>
          <FeedbackStrip tone="casi" title="¡Casi!">
            Prueba otra vez.
          </FeedbackStrip>
        </Group>

        <Group title="ChoiceTile">
          <div className={styles.row}>
            <div style={{ width: '7rem' }}>
              <ChoiceTile id="sol" emoji="☀️" label="El Sol" />
            </div>
            <div style={{ width: '7rem' }}>
              <ChoiceTile id="luna" emoji="🌙" label="La Luna" state="correct" />
            </div>
            <div style={{ width: '7rem' }}>
              <ChoiceTile id="nube" emoji="☁️" label="La Nube" state="wrong" />
            </div>
            <div style={{ width: '7rem' }}>
              <ChoiceTile id="rana" emoji="🐸" label="La Rana" disabled />
            </div>
          </div>
        </Group>

        <Group title="Tabla (marcar con un toque)">
          <div style={{ maxWidth: '24rem' }}>
            <Tabla
              cells={cells}
              onToggle={(id) =>
                setMarked((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]))
              }
            />
          </div>
        </Group>

        <Group title="PapelPicado">
          <div className={styles.ground}>
            <PapelPicado />
          </div>
        </Group>

        <Group title="QrCard / WordCard">
          <div className={styles.cols}>
            <QrCard url="https://app.loteria.to/r/K7MPQ" code="K7MPQ" />
            <WordCard word="ocelotl" langName="Náhuatl" tone="nah" review="word" />
            <WordCard
              word="El Jaguar"
              langName="Español"
              tone="es"
              verse={'Manchas de luz entre la selva,\nel jaguar camina sin hacer ruido.'}
            />
          </div>
        </Group>

        <Group title="HistoryStrip">
          <HistoryStrip
            items={ids
              .slice(0, 8)
              .map((id) => ({ id, emoji: pick(id).art, label: label(pick(id)) }))}
          />
        </Group>
      </main>
    </MemoryRouter>
  );
}
