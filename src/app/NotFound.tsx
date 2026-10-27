import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import page from './theme/page.module.css';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <main className={page.page} id="main">
      <h1 className={page.h1}>{t('notfound.title')}</h1>
      <p className={page.lead}>{t('notfound.body')}</p>
      <p>
        <Link className={page.link} to="/">
          {t('notfound.home')}
        </Link>
      </p>
      <p>
        <Link className={page.link} to="/solo">
          {t('solo.cta')}
        </Link>
      </p>
    </main>
  );
}
