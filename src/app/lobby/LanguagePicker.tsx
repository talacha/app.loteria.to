import { useTranslation } from 'react-i18next';
import { callableLangs, type Lang } from '@content';
import { Button, LanguageCard } from '../ui';
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
  /** Go back to the name step. */
  onBack?: () => void;
}

/** Join step 2 (PDF p.1): which language the cantor calls in for me. */
export default function LanguagePicker({
  value,
  onChange,
  escucha,
  onEscuchaChange,
  onSubmit,
  langs,
  busy = false,
  onBack,
}: LanguagePickerProps) {
  const { t } = useTranslation();
  const offered = ORDER.filter((l) => (langs ?? callableLangs()).includes(l));
  const name = (l: Lang) => t(`lobby.langs.${l}.name`);

  return (
    <main id="main" className={styles.page}>
      <div className={styles.top}>
        {onBack ? (
          <Button variant="link" onClick={onBack}>
            {t('lobby.back')}
          </Button>
        ) : (
          <span className={styles.brand}>{t('app.name')}</span>
        )}
        <span className={styles.step}>{t('lobby.step', { n: 2 })}</span>
      </div>
      <div className={styles.head}>
        <h1 className={styles.title}>{t('lobby.pickLangTitle')}</h1>
        <p className={styles.lead}>{t('lobby.pickLangLead')}</p>
      </div>

      <div role="radiogroup" aria-label={t('lobby.pickLangGroup')} className={styles.list}>
        {offered.map((l) => (
          <LanguageCard
            key={l}
            lang={l}
            name={name(l)}
            native={t(`lobby.langs.${l}.native`)}
            sample={sampleWord(l)}
            review={langInReview(l)}
            selected={value === l}
            onSelect={() => onChange(l)}
          />
        ))}
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
        <Button onClick={onSubmit} loading={busy}>
          {t('lobby.cta', { lang: name(value) })}
        </Button>
        <p className={styles.fine}>{t('lobby.noCosts')}</p>
      </div>
    </main>
  );
}
