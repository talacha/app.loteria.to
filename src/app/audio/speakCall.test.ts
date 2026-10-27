import { afterEach, describe, expect, it, vi } from 'vitest';
import { cards } from '@content';
import { setMuted, speakCall, stopAudio } from './speakCall';

const first = cards[0]!;
/** The deck now ships recorded clips for every language; these cases test the no-clip fallbacks. */
const noClips = Object.fromEntries(
  Object.entries(first.names).map(([l, n]) => [l, { ...n, audio: undefined }]),
) as typeof first.names;
const base = { ...first, names: noClips };

afterEach(() => {
  setMuted(false);
  vi.unstubAllGlobals();
});

describe('speakCall', () => {
  it('uses speech synthesis for es', async () => {
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        constructor(public text: string) {}
      },
    );
    expect(await speakCall(base, 'es')).toBe('speech');
    expect(speak).toHaveBeenCalledOnce();
  });

  it('never synthesizes Indigenous languages', async () => {
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    vi.stubGlobal('SpeechSynthesisUtterance', class {});
    const card = {
      ...base,
      names: { ...base.names, nah: { text: 'x', status: 'draft' as const } },
    };
    for (const l of ['nah', 'yua', 'quz'] as const) {
      expect(await speakCall(card, l)).toBe('no-audio');
    }
    expect(speak).not.toHaveBeenCalled();
  });

  it('plays recorded audio when present', async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      'Audio',
      class {
        play = play;
        pause = vi.fn();
      },
    );
    const card = { ...base, names: { ...base.names, es: { ...base.names.es!, audio: '/a.mp3' } } };
    expect(await speakCall(card, 'es')).toBe('audio');
    expect(play).toHaveBeenCalled();
  });

  it('is silent when muted', async () => {
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    setMuted(true);
    expect(await speakCall(base, 'es')).toBe('muted');
    expect(speak).not.toHaveBeenCalled();
  });

  it('does not fall back to speech when playback is aborted', async () => {
    const speak = vi.fn();
    vi.stubGlobal('speechSynthesis', { speak, cancel: vi.fn(), getVoices: () => [] });
    vi.stubGlobal('SpeechSynthesisUtterance', class {});
    vi.stubGlobal(
      'Audio',
      class {
        play = () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }));
        pause = vi.fn();
        removeAttribute = vi.fn();
      },
    );
    const card = { ...base, names: { ...base.names, es: { ...base.names.es!, audio: '/a.mp3' } } };
    expect(await speakCall(card, 'es')).toBe('muted');
    expect(speak).not.toHaveBeenCalled();
  });

  it('a stale call returns muted when superseded', async () => {
    let resolve!: () => void;
    vi.stubGlobal(
      'Audio',
      class {
        play = () => new Promise<void>((r) => (resolve = r));
        pause = vi.fn();
        removeAttribute = vi.fn();
      },
    );
    const card = { ...base, names: { ...base.names, es: { ...base.names.es!, audio: '/a.mp3' } } };
    const p = speakCall(card, 'es');
    stopAudio();
    resolve();
    expect(await p).toBe('muted');
  });
});
