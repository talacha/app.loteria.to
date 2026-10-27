import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { callableLangs, LANG_LABELS } from '@content';
import { isValidName, sanitizeName } from '@net';
import type { Lang } from '@engine';
import type { PlayerProfile } from '../player/PlayerBoard';
import LobbyWaiting from '../lobby/LobbyWaiting';
import { normalizeCode, isRoomCode } from './code';
import styles from './JoinPage.module.css';

import { GLYPHS } from './glyphs';

const STORE_KEY = 'loteria:profile';

function readHashKey(): string | undefined {
  const m = /(?:^#|&)k=([^&]+)/.exec(window.location.hash);
  if (!m?.[1]) return undefined;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

async function fetchHostKey(code: string): Promise<string | undefined> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 1500);
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`, { signal: ctl.signal });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { hostKey?: unknown };
    return typeof body.hostKey === 'string' && body.hostKey ? body.hostKey : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

function loadSaved(): { name: string; glyph: string } {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Record<string, unknown>;
    return {
      name: typeof v.name === 'string' ? v.name.slice(0, 40) : '',
      glyph: typeof v.glyph === 'string' && GLYPHS.includes(v.glyph) ? v.glyph : GLYPHS[0]!,
    };
  } catch {
    return { name: '', glyph: GLYPHS[0]! };
  }
}

export default function JoinPage() {
  const { t } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();
  const code = normalizeCode(params.code ?? '');
  const validCode = isRoomCode(code);
  const [retry, setRetry] = useState('');
  const [saved] = useState(loadSaved);
  const [name, setName] = useState(saved.name);
  const [glyph, setGlyph] = useState(saved.glyph);
  const [pronouns, setPronouns] = useState('');
  const [labelLang, setLabelLang] = useState<Lang>('es');
  const [error, setError] = useState(false);
  const [paperOpen, setPaperOpen] = useState(false);
  const [joined, setJoined] = useState<{
    profile: PlayerProfile;
    hostKey?: string;
    fromQr: boolean;
  } | null>(null);
  const hostKeyP = useRef<Promise<string | undefined> | null>(null);
  const fromQr = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const pronounsRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pronounsError, setPronounsError] = useState(false);

  useEffect(() => {
    if (!validCode) return;
    const k = readHashKey();
    fromQr.current = !!k;
    hostKeyP.current = k ? Promise.resolve(k) : fetchHostKey(code);
  }, [code, validCode]);

  const langs: Lang[] = ['es', 'en', ...callableLangs().filter((l) => l !== 'es' && l !== 'en')];

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const clean = sanitizeName(name);
    const cleanPronouns = sanitizeName(pronouns);
    if (!isValidName(clean)) {
      setError(true);
      nameRef.current?.focus();
      return;
    }
    setError(false);
    if (cleanPronouns.length > 30) {
      setPronounsError(true);
      pronounsRef.current?.focus();
      return;
    }
    setPronounsError(false);
    setBusy(true);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ name: clean, glyph }));
    } catch {
      /* ignore */
    }
    const hostKey = await (hostKeyP.current ?? Promise.resolve(undefined));
    setJoined({
      profile: { name: clean, glyph, pronouns: cleanPronouns || undefined, labelLang },
      hostKey,
      fromQr: fromQr.current,
    });
  }

  if (!validCode) {
    return (
      <main className={styles.page}>
        <h1>{t('join.title')}</h1>
        <p role="alert">{t('join.codeInvalidRoom')}</p>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            const c = normalizeCode(retry);
            if (isRoomCode(c)) void navigate(`/r/${c}`, { replace: true });
          }}
        >
          <label className={styles.field}>
            <span>{t('join.codeLabel')}</span>
            <input
              value={retry}
              onChange={(e) => setRetry(e.target.value)}
              placeholder={t('join.codePlaceholder')}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
            />
          </label>
          {retry.trim() !== '' && !isRoomCode(normalizeCode(retry)) && (
            <p className={styles.error}>{t('join.codeInvalid')}</p>
          )}
          <button type="submit" className={styles.submit}>
            {t('join.codeRetry')}
          </button>
        </form>
      </main>
    );
  }

  if (joined) {
    return (
      <main>
        <LobbyWaiting
          code={code}
          profile={joined.profile}
          hostKey={joined.hostKey}
          hostKeyFromQr={joined.fromQr}
          onLeave={() => void navigate('/')}
        />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1>{t('join.title')}</h1>
      <p className={styles.code}>
        {t('join.codeLabel')}: <strong>{code}</strong>
      </p>
      <form onSubmit={(e) => void submit(e)} noValidate className={styles.form}>
        <label className={styles.field}>
          <span>{t('join.nameLabel')}</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoComplete="nickname"
            placeholder={t('join.namePlaceholder')}
            aria-invalid={error}
            aria-describedby={error ? 'name-err' : undefined}
          />
        </label>
        {error && (
          <p id="name-err" role="alert" className={styles.error}>
            {t('join.nameRequired')}
          </p>
        )}

        <fieldset className={styles.fieldset}>
          <legend>{t('join.glyphLabel')}</legend>
          <div className={styles.glyphs} role="radiogroup" aria-label={t('join.glyphs')}>
            {GLYPHS.map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={glyph === g}
                aria-label={g}
                data-selected={glyph === g}
                className={styles.glyph}
                onClick={() => setGlyph(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </fieldset>

        <label className={styles.field}>
          <span>{t('join.pronounsLabel')}</span>
          <input
            ref={pronounsRef}
            value={pronouns}
            aria-invalid={pronounsError}
            onChange={(e) => setPronouns(e.target.value)}
            maxLength={30}
            placeholder={t('join.pronounsPlaceholder')}
          />
        </label>

        {pronounsError && (
          <p role="alert" className={styles.error}>
            {t('join.pronounsInvalid')}
          </p>
        )}

        <label className={styles.field}>
          <span>{t('join.labelLang')}</span>
          <select value={labelLang} onChange={(e) => setLabelLang(e.target.value as Lang)}>
            {langs.map((l) => (
              <option key={l} value={l}>
                {LANG_LABELS[l]}
              </option>
            ))}
          </select>
        </label>

        <button type="submit" className={styles.submit} disabled={busy} aria-busy={busy}>
          {busy ? t('join.connecting') : t('join.submit')}
        </button>
      </form>

      <button
        type="button"
        className={styles.link}
        onClick={() => setPaperOpen((o) => !o)}
        aria-expanded={paperOpen}
      >
        {t('join.paperLink')}
      </button>
      {paperOpen && <p className={styles.paper}>{t('join.paperExplain')}</p>}
    </main>
  );
}
