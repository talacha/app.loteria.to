export type Lang = 'es' | 'en' | 'nah' | 'yua' | 'quz';
export type CardId = string;
export type Category = 'animals' | 'plants_food' | 'sky' | 'land' | 'handmade' | 'places';
export type PatternId = 'line' | 'corners' | 'center' | 'full';
export interface Tabla {
  index: number;
  cards: CardId[]; // length 16, row-major 4x4
}
