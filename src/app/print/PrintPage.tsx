import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { LANGS, LANG_LABELS, callableLangs, type Lang } from '@content';
import { MAX_BOARDS, clampCount, newSeed, parseSeed, type Paper } from '@print/options';
import page from '../theme/page.module.css';
import styles from './PrintPage.module.css';

export default function PrintPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const fromUrl = parseSeed(params.get('seed'));
  const [fallbackSeed, setFallbackSeed] = useState(newSeed);
  const seed = fromUrl ?? fallbackSeed;
  const [count, setCount] = useState(8);
  const [paper, setPaper] = useState<Paper>('letter');
  const [labelLang, setLabelLang] = useState<Lang>('es');
  const [largePrint, setLargePrint] = useState(false);
  const [inkSaver, setInkSaver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<{ url: string; seed: string; degraded: boolean } | null>(
    null,
  );
  const [copiedSeed, setCopiedSeed] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const runRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const copied = copiedSeed === seed;

  const langs = LANGS.filter((l) => l === 'es' || l === 'en' || callableLangs().includes(l));

  useEffect(() => {
    if (!fromUrl) setParams({ seed: fallbackSeed }, { replace: true });
  }, [fromUrl, fallbackSeed, setParams]);
  useEffect(
    () => () => {
      runRef.current++;
      abortRef.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  function dropResult() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setResult(null);
  }

  function setNewSeed() {
    if (busy) return;
    const s = newSeed();
    setFallbackSeed(s);
    setParams({ seed: s }, { replace: true });
    dropResult();
  }

  async function copySeed() {
    try {
      await navigator.clipboard.writeText(seed);
      setCopiedSeed(seed);
    } catch {
      setCopiedSeed(null);
    }
  }

  function cancel() {
    runRef.current++;
    abortRef.current?.abort();
    setBusy(false);
    setProgress(null);
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const genSeed = seed;
    const total = clampCount(count);
    const run = ++runRef.current;
    const ac = new AbortController();
    abortRef.current = ac;
    dropResult();
    setBusy(true);
    setError(false);
    setProgress([0, total]);
    try {
      const { generateBoardsPdfDetailed } = await import('@print');
      const { bytes, degraded } = await generateBoardsPdfDetailed(
        {
          seed: genSeed,
          count: total,
          paper,
          labelLang,
          largePrint,
          inkSaver,
          origin: window.location.origin,
        },
        {
          signal: ac.signal,
          onProgress: (done, tot) => {
            if (run === runRef.current) setProgress([done, tot]);
          },
        },
      );
      if (run !== runRef.current) return;
      const next = URL.createObjectURL(
        new Blob([bytes.slice().buffer], { type: 'application/pdf' }),
      );
      urlRef.current = next;
      setResult({ url: next, seed: genSeed, degraded });
    } catch {
      if (run === runRef.current) setError(true);
    } finally {
      if (run === runRef.current) {
        setBusy(false);
        abortRef.current = null;
      }
    }
  }

  return (
    <main className={page.page} id="main">
      <nav className={page.nav}>
        <Link to="/">{t('print.home')}</Link>
      </nav>
      <header className={page.section}>
        <h1 className={page.h1}>{t('print.title')}</h1>
        <p className={page.lead}>{t('print.intro')}</p>
      </header>

      <section className={`${page.panel} ${page.section}`} aria-labelledby="print-seed">
        <h2 className={page.h2} id="print-seed">
          {t('print.seedTitle')}
        </h2>
        <p className={styles.seed} aria-live="polite">
          {seed}
        </p>
        <p>{t('print.seedNote')}</p>
        <div className={page.row}>
          <button type="button" className={page.btn} onClick={setNewSeed} disabled={busy}>
            {t('print.seedNew')}
          </button>
          <button type="button" className={page.btn} onClick={() => void copySeed()}>
            {copied ? t('common.copied') : t('print.seedCopy')}
          </button>
        </div>
      </section>

      <form className={page.section} onSubmit={(e) => void generate(e)}>
        <div className={styles.form}>
          <div className={page.field}>
            <label htmlFor="print-count">{t('print.count')}</label>
            <input
              id="print-count"
              className={page.input}
              type="number"
              min={1}
              max={MAX_BOARDS}
              step={1}
              inputMode="numeric"
              value={count}
              aria-describedby="print-count-help"
              onChange={(e) => setCount(Number(e.target.value))}
              onBlur={() => setCount(clampCount(count))}
            />
            <span id="print-count-help" className={page.muted}>
              {t('print.countHelp')}
            </span>
          </div>
          <div className={page.field}>
            <label htmlFor="print-paper">{t('print.paperSize')}</label>
            <select
              id="print-paper"
              className={page.input}
              value={paper}
              onChange={(e) => setPaper(e.target.value as Paper)}
            >
              <option value="letter">{t('print.letter')}</option>
              <option value="a4">{t('print.a4')}</option>
            </select>
          </div>
          <div className={page.field}>
            <label htmlFor="print-lang">{t('print.labelLang')}</label>
            <select
              id="print-lang"
              className={page.input}
              value={labelLang}
              onChange={(e) => setLabelLang(e.target.value as Lang)}
            >
              {langs.map((l) => (
                <option key={l} value={l}>
                  {LANG_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={largePrint}
            onChange={(e) => setLargePrint(e.target.checked)}
          />
          <span>
            {t('print.largePrint')}
            <br />
            <span className={page.muted}>{t('print.largeHelp')}</span>
          </span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={inkSaver}
            onChange={(e) => setInkSaver(e.target.checked)}
          />
          <span>
            {t('print.inkSaver')}
            <br />
            <span className={page.muted}>{t('print.inkHelp')}</span>
          </span>
        </label>

        <div className={page.row}>
          <button type="submit" className={`${page.btn} ${page.btnPrimary}`} disabled={busy}>
            {busy ? t('print.generating') : t('print.generate')}
          </button>
          {busy && (
            <button type="button" className={page.btn} onClick={cancel}>
              {t('print.cancel')}
            </button>
          )}
          {result && !busy && (
            <a
              className={page.btn}
              href={result.url}
              download={`loteria-tablas-${result.seed}.pdf`}
            >
              {t('print.download')}
            </a>
          )}
        </div>

        <div role="status">{busy ? t('print.generating') : result ? t('print.ready') : ''}</div>
        {busy && progress && (
          <div>
            <progress
              className={styles.progress}
              aria-label={t('print.progressLabel')}
              value={progress[0]}
              max={progress[1]}
            />
            <span aria-hidden="true">
              {t('print.progress', { done: progress[0], total: progress[1] })}
            </span>
          </div>
        )}
        {result?.degraded && !busy && <p className={page.notice}>{t('print.degraded')}</p>}
        {error && (
          <p role="alert" className={styles.error}>
            {t('errors.pdfFailed')}
          </p>
        )}
      </form>

      <section className={page.section}>
        <h2 className={page.h2}>{t('print.noPhoneTitle')}</h2>
        <p>{t('print.noPhoneBody')}</p>
      </section>
    </main>
  );
}
