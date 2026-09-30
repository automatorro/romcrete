/**
 * Căutarea în catalog, aceeași peste tot: pagina Catalog, oferta și terenul.
 *
 * Fără diacritice și majuscule („pompa glet” găsește „Pompă de glet”), după
 * toate cuvintele scrise, în orice ordine, și după bucăți de cod („17n3”
 * găsește 17N353, „24f853” găsește 24F-853).
 */

/** Fără diacritice și majuscule. */
export const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Codul produsului pe ecran și pe ofertă; lipsa lui înseamnă că se cere la comandă. */
export const formatSku = (sku: string | null | undefined) => sku?.trim() || "la cerere";

type Searchable = {
  name: string;
  sku: string | null;
  category?: string | null;
  description?: string | null;
  tech_type?: string | null;
  materials?: { certain?: string[]; equivalent?: string[] } | null;
};

/** Tot textul după care se caută un produs, pregătit o singură dată. */
export function searchIndex(item: Searchable): { text: string; compact: string } {
  const text = fold(
    [
      item.name,
      item.sku ?? "",
      item.category ?? "",
      item.tech_type ?? "",
      item.description ?? "",
      ...(item.materials?.certain ?? []),
      ...(item.materials?.equivalent ?? []),
    ].join(" "),
  );
  return { text, compact: text.replace(/[^a-z0-9]+/g, "") };
}

/** Cuvintele căutării; gol = nu se caută nimic. */
export const queryWords = (query: string) => fold(query).split(/\s+/).filter(Boolean);

export function matchesWords(index: { text: string; compact: string }, words: string[]): boolean {
  return words.every((w) => {
    if (index.text.includes(w)) return true;
    const compact = w.replace(/[^a-z0-9]+/g, "");
    return compact.length > 0 && index.compact.includes(compact);
  });
}
