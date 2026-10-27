import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { credits } from '@content';

const contributors: { name: string; role: string }[] = credits.contributors;
import page from '../theme/page.module.css';

export default function CreditsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('en') ? 'en' : 'es';
  return (
    <main className={page.page} id="main">
      <nav className={page.nav}>
        <Link to="/">{t('credits.home')}</Link>
      </nav>
      <h1 className={page.h1}>{t('credits.title')}</h1>

      <section className={page.section} aria-labelledby="cr-art">
        <h2 className={page.h2} id="cr-art">
          {t('credits.artTitle')}
        </h2>
        <p>{credits.art.note[lang]}</p>
      </section>

      <section className={page.section} aria-labelledby="cr-names">
        <h2 className={page.h2} id="cr-names">
          {t('credits.namesTitle')}
        </h2>
        <p>{credits.names.note[lang]}</p>
        <p>{t('credits.licenseContent')}</p>
      </section>

      <section className={page.section} aria-labelledby="cr-people">
        <h2 className={page.h2} id="cr-people">
          {t('credits.contributorsTitle')}
        </h2>
        {contributors.length === 0 ? (
          <p className={page.muted}>{t('credits.noContributors')}</p>
        ) : (
          <ul>
            {contributors.map((c) => (
              <li key={c.name}>
                {c.name} · {c.role}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={page.section} aria-labelledby="cr-sw">
        <h2 className={page.h2} id="cr-sw">
          {t('credits.softwareTitle')}
        </h2>
        <p>{t('credits.licenseSoftware')}</p>
        <ul>
          {credits.software.map((s) => (
            <li key={s.name}>
              {s.name} · {t('credits.license', { license: s.license })}
            </li>
          ))}
        </ul>
      </section>

      <section className={page.section} aria-labelledby="cr-lic">
        <h2 className={page.h2} id="cr-lic">
          {t('credits.licenseTitle')}
        </h2>
        <ul>
          <li>{t('credits.licenseFont')}</li>
          <li>{t('credits.licenseEmoji')}</li>
        </ul>
      </section>
    </main>
  );
}
