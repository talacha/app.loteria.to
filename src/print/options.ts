// Import-light exports (no pdf-lib, no content) for UI code and the host.
export type { Paper, PrintOptions } from './layout';
export { MAX_BOARDS, clampCount, boardPageCount, boardsPerPage } from './layout';
export { newSeed, parseSeed, normalizePrintSeed } from './seed';
