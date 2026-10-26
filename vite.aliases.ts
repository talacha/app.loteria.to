import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export const aliases = {
  '@engine': r('./src/engine'),
  '@app': r('./src/app'),
  '@net': r('./src/net'),
  '@ai': r('./src/ai'),
  '@content': r('./src/content'),
  '@print': r('./src/print'),
};
