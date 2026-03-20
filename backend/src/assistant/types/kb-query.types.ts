/** Metadatos no sensibles devueltos junto a filas KB (interno + contrato opcional). */
export interface KbQueryMeta {
  searchActive: boolean;
  /** Cuántos términos se aplicaron en el AND (0 = listado reciente). */
  tokenCount: number;
  resultLimit: number;
  articleCount: number;
}
