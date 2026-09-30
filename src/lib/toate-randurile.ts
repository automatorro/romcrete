/**
 * Toate rândurile unei interogări, nu doar primele 1.000.
 *
 * Supabase întoarce cel mult 1.000 de rânduri pe cerere, fără nicio eroare:
 * restul pur și simplu lipsesc. Catalogul, cu câte o poziție pe fiecare cod,
 * trece de pragul ăsta, așa că listele lui se citesc pe pagini.
 *
 * `page` primește intervalul și trebuie să aibă o ordine stabilă (terminată,
 * de exemplu, cu `.order("id")`), altfel paginile se pot suprapune.
 */
const PAGE = 1000;

export async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}
