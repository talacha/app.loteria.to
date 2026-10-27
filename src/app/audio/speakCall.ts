import { cardName } from '@content';
import type { Card, Lang } from '@content';

export type SpeakResult = 'audio' | 'speech' | 'no-audio' | 'muted';

const SPEECH_LANGS: Partial<Record<Lang, string>> = { es: 'es', en: 'en' };

let muted = false;
let current: HTMLAudioElement | null = null;
let gen = 0;
const listeners = new Set<(m: boolean) => void>();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (m) stopAudio();
  listeners.forEach((l) => l(m));
}

export function onMutedChange(cb: (m: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function stopAudio(): void {
  gen++;
  try {
    current?.pause();
    current?.removeAttribute('src');
    current?.load?.();
  } catch {
    /* ignore */
  }
  current = null;
  try {
    globalThis.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

function pickVoice(prefix: string): SpeechSynthesisVoice | undefined {
  try {
    return globalThis.speechSynthesis
      ?.getVoices()
      .find((v) => v.lang.toLowerCase().startsWith(prefix));
  } catch {
    return undefined;
  }
}

/**
 * Plays a recorded clip when the card has one for `lang`; otherwise es/en fall back to
 * Web Speech. Indigenous languages NEVER use speech synthesis: returns 'no-audio'.
 */
export async function speakCall(card: Card, lang: Lang): Promise<SpeakResult> {
  const name = card.names[lang];
  const src = name?.audio;
  if (muted) return src || SPEECH_LANGS[lang] ? 'muted' : 'no-audio';
  stopAudio();
  const mine = gen;
  if (src && typeof Audio !== 'undefined') {
    try {
      const el = new Audio(src);
      current = el;
      await el.play();
      return mine === gen ? 'audio' : 'muted';
    } catch (e) {
      // Interrupted by a newer call / stop / mute: never fall through to speech.
      if (mine !== gen || (e as { name?: string } | null)?.name === 'AbortError') return 'muted';
    }
  }
  if (mine !== gen || muted) return 'muted';
  const prefix = SPEECH_LANGS[lang];
  if (!prefix) return 'no-audio';
  const text = cardName(card, lang)?.text;
  const synth = globalThis.speechSynthesis;
  if (!text || !synth || typeof SpeechSynthesisUtterance === 'undefined') return 'no-audio';
  const u = new SpeechSynthesisUtterance(text);
  u.lang = prefix;
  const voice = pickVoice(prefix);
  if (voice) u.voice = voice;
  if (mine !== gen || muted) return 'muted';
  synth.speak(u);
  return 'speech';
}

/** Publish the current card to the OS media controls (lock screen etc.). */
export function setMediaSession(
  title: string,
  artist: string,
  handlers?: { pause?: () => void; play?: () => void; next?: () => void },
): void {
  const ms = (globalThis.navigator as Navigator | undefined)?.mediaSession;
  if (!ms || typeof MediaMetadata === 'undefined') return;
  try {
    ms.metadata = new MediaMetadata({ title, artist });
    ms.setActionHandler('pause', handlers?.pause ?? null);
    ms.setActionHandler('play', handlers?.play ?? null);
    ms.setActionHandler('nexttrack', handlers?.next ?? null);
  } catch {
    /* unsupported action */
  }
}
