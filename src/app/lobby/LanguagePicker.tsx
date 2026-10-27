import { useTranslation } from 'react-i18next';
import { callableLangs, type Lang } from '@content';
import { LANG_COLORS } from '@content';
import { langInReview, sampleWord } from './langInfo';
import styles from './LanguagePicker.module.css';

const ORDER: Lang[] = ['nah', 'yua', 'quz', 'es', 'en'];

export interface LanguagePickerProps {
  value: Lang;
  onChange: (lang: Lang) => void;
  escucha: boolean;
  onEscuchaChange: (on: boolean) => void;
  onSubmit: () => void;
  /** Languages offered; defaults to the callable ones. */
  langs?: Lang[];
  busy?: boolean;
}

export default function LanguagePicker({
  value,
  onChange,
  escucha,
  onEscuchaChange,
  onSubmit,
  langs,
  busy = false,
}: LanguagePickerProps) {
  const { t } = useTranslation();
  const offered = ORDER.filter((l) => (langs ?? callableLangs()).includes(l));
  const name = (l: Lang) => t(`lobby.langs.${l}.name`);

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <span className={styles.brand}>{t('app.name')}</span>
        <span className={styles.step}>{t('lobby.step', { n: 2 })}</span>
      </div>
      <div className={styles.head}>
        <h1 className={styles.title}>{t('lobby.pickLangTitle')}</h1>
        <p className={styles.lead}>{t('lobby.pickLangLead')}</p>
      </div>

      <div role="radiogroup" aria-label={t('lobby.pickLangGroup')} className={styles.list}>
        {offered.map((l) => {
          const selected = value === l;
          const review = langInReview(l);
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={selected}
              data-selected={selected}
              className={styles.option}
              style={{ ['--chip' as string]: LANG_COLORS[l] }}
              onClick={() => onChange(l)}
            >
              <span className={styles.chip} aria-hidden="true">
                {name(l).slice(0, 1)}
              </span>
              <span className={styles.text}>
                <span className={styles.name}>{name(l)}</span>
                <span className={styles.native}>
                  {t(`lobby.langs.${l}.native`)} · «{sampleWord(l)}»
                </span>
                {review && <span className={styles.review}>{t('lobby.inReview')}</span>}
              </span>
              <span className={styles.dot} aria-hidden="true">
                {selected ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>

      <label className={styles.escucha}>
        <input
          type="checkbox"
          checked={escucha}
          onChange={(e) => onEscuchaChange(e.target.checked)}
        />
        <span>{t('lobby.listenMode')}</span>
      </label>

      <div className={styles.footer}>
        <button type="button" className={styles.cta} onClick={onSubmit} disabled={busy} aria-busy={busy}>
          {t('lobby.cta', { lang: name(value) })}
        </button>
        <p className={styles.fine}>{t('lobby.noCosts')}</p>
      </div>
    </div>
  );
}
