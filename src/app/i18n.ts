import i18n from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';
import { uiCatalogs, UI_NAMESPACE } from '@content';

// Each UI area may add its own strings in src/app/<area>/strings.<lng>.json.
// They merge into the shared `ui` namespace under the area's name, so
// `t('host.foo')` can come from either the content catalog or host/strings.es.json.
type Tree = Record<string, unknown>;
const areaFiles = import.meta.glob<Tree>('./*/strings.*.json', { eager: true, import: 'default' });

function deepMerge(a: Tree, b: Tree): Tree {
  const out: Tree = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k];
    out[k] =
      prev && typeof prev === 'object' && v && typeof v === 'object'
        ? deepMerge(prev as Tree, v as Tree)
        : v;
  }
  return out;
}

function catalog(lng: 'es' | 'en'): Tree {
  let tree = uiCatalogs[lng] as Tree;
  for (const [path, strings] of Object.entries(areaFiles)) {
    const m = /^\.\/([^/]+)\/strings\.(\w+)\.json$/.exec(path);
    if (m?.[2] === lng && m[1]) tree = deepMerge(tree, { [m[1]]: strings });
  }
  return tree;
}

void i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    lng: 'es',
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    ns: [UI_NAMESPACE],
    defaultNS: UI_NAMESPACE,
    resources: {
      es: { [UI_NAMESPACE]: catalog('es') },
      en: { [UI_NAMESPACE]: catalog('en') },
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
