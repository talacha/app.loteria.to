import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { isValidName, sanitizeName } from '@net';
import type { Lang } from '@engine';
import i18n from 'i18next';
import type { PlayerProfile } from '../player/PlayerBoard';
import LobbyWaiting from '../lobby/LobbyWaiting';
import LanguagePicker from '../lobby/LanguagePicker';
import UiLangSwitch from '../player/UiLangSwitch';
import { isLang, patchLocalProfile, readLocalProfile } from '../player/profile';
import { normalizeCode, isRoomCode } from './code';
import styles from './JoinPage.module.css';

import { GLYPHS } from './glyphs';

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

type Joined = { profile: PlayerProfile; hostKey?: string; fromQr: boolean };
const sessionKey = (code: string) => `loteria:session:${code}`;

function loadSession(code: string): Joined | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(sessionKey(code)) ?? 'null') as {
      profile?: Partial<PlayerProfile>;
      hostKey?: unknown;
      hostKeyFromQr?: unknown;
    } | null;
    const p = v?.profile;
    if (!p || typeof p.name !== 'string' || !isValidName(p.name) || typeof p.glyph !== 'string')
      return null;
    const lang = p.spokenLang;
    if (!isLang(lang)) return null;
    return {
      profile: {
        name: p.name,
        glyph: p.glyph,
        pronouns: typeof p.pronouns === 'string' && p.pronouns ? p.pronouns : undefined,
        spokenLang: lang,
      },
      hostKey: typeof v?.hostKey === 'string' ? v.hostKey : undefined,
      fromQr: v?.hostKeyFromQr === true,
    };
  } catch {
    return null;
  }
}

function saveSession(code: string, j: Joined): void {
  try {
    sessionStorage.setItem(
      sessionKey(code),
      JSON.stringify({ profile: j.profile, hostKey: j.hostKey, hostKeyFromQr: j.fromQr }),
    );
  } catch {
    /* ignore */
  }
}

function clearSession(code: string): void {
  try {
    sessionStorage.removeItem(sessionKey(code));
  } catch {
    /* ignore */
  }
}

function loadSaved(): { name: string; glyph: string; spokenLang: Lang } {
  const v = readLocalProfile();
  return {
    name: v.name ?? '',
    glyph: v.glyph && GLYPHS.includes(v.glyph) ? v.glyph : GLYPHS[0]!,
    // Default the voice to the menu language until the player picks one.
    spokenLang: v.spokenLang ?? (i18n.language?.startsWith('en') ? 'en' : 'es'),
  };
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
  const [spokenLang, setSpokenLang] = useState<Lang>(saved.spokenLang);
  const [error, setError] = useState(false);
  const [step, setStep] = useState<'who' | 'lang'>('who');
  const [joined, setJoined] = useState<Joined | null>(() => (validCode ? loadSession(code) : null));
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

  function next(e: FormEvent) {
    e.preventDefault();
    if (!isValidName(sanitizeName(name))) {
      setError(true);
      nameRef.current?.focus();
      return;
    }
    if (sanitizeName(pronouns).length > 30) {
      setPronounsError(true);
      pronounsRef.current?.focus();
      return;
    }
    setError(false);
    setPronounsError(false);
    setStep('lang');
  }

  async function submit() {
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
    patchLocalProfile({
      name: clean,
      glyph,
      spokenLang,
      uiLang: i18n.language?.startsWith('en') ? 'en' : 'es',
    });
    const hostKey = await (hostKeyP.current ?? Promise.resolve(undefined));
    const next: Joined = {
      profile: {
        name: clean,
        glyph,
        pronouns: cleanPronouns || undefined,
        spokenLang,
      },
      hostKey,
      fromQr: fromQr.current,
    };
    saveSession(code, next);
    setJoined(next);
  }

  if (!validCode) {
    return (
      <main id="main" className={styles.page}>
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
      <LobbyWaiting
        code={code}
        profile={joined.profile}
        hostKey={joined.hostKey}
        hostKeyFromQr={joined.fromQr}
        onLeave={() => {
          clearSession(code);
          void navigate('/');
        }}
        onCreateRoom={() => {
          clearSession(code);
          void navigate('/host');
        }}
      />
    );
  }

  if (step === 'lang') {
    return (
      <LanguagePicker
        value={spokenLang}
        onChange={setSpokenLang}
        onSubmit={() => void submit()}
        busy={busy}
        onBack={() => setStep('who')}
      />
    );
  }

  return (
    <main id="main" className={styles.page}>
      <div className={styles.topBar}>
        <UiLangSwitch />
      </div>
      <h1>{t('join.title')}</h1>
      <p className={styles.code}>
        {t('join.codeLabel')}: <strong>{code}</strong>
      </p>
      <form onSubmit={next} noValidate className={styles.form}>
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

        <button type="submit" className={styles.submit}>
          {t('join.next')}
        </button>
      </form>
    </main>
  );
}
