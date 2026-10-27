import QRCode from 'qrcode';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import Gallery from './Gallery';
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
} from './index';

afterEach(cleanup);

describe('Button', () => {
  it('renders variants and handles click', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Crear</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    expect(onClick).toHaveBeenCalled();
  });
  it('loading is busy and disabled', () => {
    render(<Button loading>Espera</Button>);
    const b = screen.getByRole('button', { name: 'Espera' }) as HTMLButtonElement;
    expect(b.getAttribute('aria-busy')).toBe('true');
    expect(b.disabled).toBe(true);
  });
  it('renders a link with `to`', () => {
    render(
      <MemoryRouter>
        <Button to="/print" variant="link" icon={<svg />}>
          Imprimir
        </Button>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Imprimir' }).getAttribute('href')).toBe('/print');
  });
});

describe('badges and surfaces', () => {
  it('Pill shows text with its tone', () => {
    render(
      <Pill tone="nah" dot>
        Náhuatl
      </Pill>,
    );
    expect(screen.getByText('Náhuatl').getAttribute('data-tone')).toBe('nah');
  });
  it('ReviewTag variants', () => {
    render(
      <>
        <ReviewTag variant="word" />
        <ReviewTag variant="words" />
        <ReviewTag variant="ai" />
      </>,
    );
    expect(screen.getByText('palabra en revisión')).toBeTruthy();
    expect(screen.getByText('Palabras en revisión por hablantes')).toBeTruthy();
    expect(screen.getByText('voz generada por IA · puede tener errores')).toBeTruthy();
  });
  it('Panel and PaperCard render children', () => {
    render(
      <>
        <Panel variant="dashed">a</Panel>
        <PaperCard size="lg" as="section">
          b
        </PaperCard>
      </>,
    );
    expect(screen.getByText('a').getAttribute('data-variant')).toBe('dashed');
    expect(screen.getByText('b').tagName).toBe('SECTION');
  });
  it('ProgressBar clamps and exposes value', () => {
    render(<ProgressBar value={1.7} label="Tiempo" />);
    expect(screen.getByRole('progressbar', { name: 'Tiempo' }).getAttribute('aria-valuenow')).toBe(
      '100',
    );
  });
  it('PapelPicado is decorative', () => {
    const { container } = render(<PapelPicado />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });
  it('CardArt falls back to the emoji when the image fails', () => {
    const { container } = render(<CardArt id="sol" emoji="☀️" />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/art/sol.svg');
    fireEvent.error(img);
    expect(container.textContent).toBe('☀️');
  });
});

describe('game components', () => {
  it('LanguageCard is a radio with selection state', () => {
    const onSelect = vi.fn();
    render(
      <LanguageCard
        lang="nah"
        name="Náhuatl"
        sample="ocelotl"
        review
        selected={false}
        onSelect={onSelect}
      />,
    );
    const r = screen.getByRole('radio', { name: /Náhuatl/ });
    expect(r.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('palabra en revisión')).toBeTruthy();
    fireEvent.click(r);
    expect(onSelect).toHaveBeenCalled();
  });
  it('RoomCodeTiles exposes the code once', () => {
    render(<RoomCodeTiles code="K7MPQ" />);
    expect(screen.getByRole('img', { name: 'Código de sala K 7 M P Q' })).toBeTruthy();
  });
  it('RosterTile marks the self tile', () => {
    render(<RosterTile name="Itzel" glyph="🐦" self />);
    expect(screen.getByText('Tú · Itzel')).toBeTruthy();
  });
  it('CallPanel shows the word or Escucha, with timer', () => {
    const { rerender } = render(<CallPanel word="El Jaguar" review="word" progress={0.5} />);
    expect(screen.getByText('El Jaguar')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    rerender(<CallPanel word="El Jaguar" listening />);
    expect(screen.queryByText('El Jaguar')).toBeNull();
    expect(screen.getByText('Escucha…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Repetir la carta' })).toBeTruthy();
  });
  it('ChoiceTile states', () => {
    const onChoose = vi.fn();
    const { rerender } = render(
      <ChoiceTile id="sol" emoji="☀️" label="El Sol" onChoose={onChoose} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'El Sol' }));
    expect(onChoose).toHaveBeenCalledTimes(1);
    rerender(<ChoiceTile id="sol" emoji="☀️" label="El Sol" state="correct" />);
    expect(screen.getByRole('button', { name: 'El Sol · Correcta' })).toBeTruthy();
    rerender(<ChoiceTile id="sol" emoji="☀️" label="El Sol" state="wrong" />);
    expect(
      (screen.getByRole('button', { name: 'El Sol · Incorrecta' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
  it('FeedbackStrip is a status region', () => {
    render(
      <FeedbackStrip tone="casi" title="¡Casi!">
        Otra vez
      </FeedbackStrip>,
    );
    const s = screen.getByRole('status');
    expect(s.getAttribute('data-tone')).toBe('casi');
    expect(s.textContent).toContain('¡Casi!');
  });
  it('Tabla toggles cells and shows beans', () => {
    const onToggle = vi.fn();
    const cells = [
      { id: 'sol', emoji: '☀️', label: 'El Sol', marked: true },
      { id: 'luna', emoji: '🌙', label: 'La Luna', winning: true },
    ];
    render(<Tabla cells={cells} onToggle={onToggle} />);
    expect(screen.getByRole('list', { name: 'Tu tabla' })).toBeTruthy();
    const sol = screen.getByRole('button', { name: /El Sol/ });
    expect(sol.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /La Luna/ }));
    expect(onToggle).toHaveBeenCalledWith('luna');
  });
  it('static Tabla announces marked cells', () => {
    render(<Tabla cells={[{ id: 'sol', emoji: '☀️', label: 'El Sol', marked: true }]} />);
    expect(screen.getByText('Marcada')).toBeTruthy();
  });
  it('QrCard renders an svg and the code', () => {
    const { container } = render(<QrCard url="https://app.loteria.to/r/K7MPQ" code="K7MPQ" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(screen.getByText('K7MPQ')).toBeTruthy();
    expect(screen.getByText('Únete en app.loteria.to')).toBeTruthy();
  });
  it('QrCard keeps a 4-module light margin inside the border', () => {
    const { container } = render(<QrCard url="https://app.loteria.to/r/K7MPQ" code="K7MPQ" />);
    const svg = container.querySelector('svg') as SVGSVGElement;
    const [x, y, w, h] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number) as number[];
    const n = QRCode.create('https://app.loteria.to/r/K7MPQ', { errorCorrectionLevel: 'M' }).modules
      .size;
    expect(x).toBeLessThanOrEqual(-4);
    expect(y).toBeLessThanOrEqual(-4);
    expect((w as number) + (x as number)).toBeGreaterThanOrEqual(n + 4);
    expect((h as number) + (y as number)).toBeGreaterThanOrEqual(n + 4);
    const bg = svg.querySelector('rect');
    expect(bg?.getAttribute('fill')).toBe('var(--color-white)');
    expect(Number(bg?.getAttribute('x'))).toBeLessThanOrEqual(-4);
  });
  it('WordCard shows language, word, review and verse', () => {
    render(
      <WordCard word="ocelotl" langName="Náhuatl" tone="nah" review="word" verse="uno\ndos" />,
    );
    expect(screen.getByText('Náhuatl')).toBeTruthy();
    expect(screen.getByText('ocelotl')).toBeTruthy();
    expect(screen.getByText('palabra en revisión')).toBeTruthy();
  });
  it('HistoryStrip lists cards with accessible names', () => {
    render(<HistoryStrip items={[{ id: 'sol', emoji: '☀️', label: 'El Sol' }]} />);
    expect(screen.getByText('Ya cantadas')).toBeTruthy();
    expect(screen.getByText('El Sol')).toBeTruthy();
  });
});

describe('Gallery', () => {
  it('renders every primitive', () => {
    render(
      <MemoryRouter>
        <Gallery />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('UI gallery');
    expect(screen.getAllByRole('radio').length).toBe(5);
  });
});
