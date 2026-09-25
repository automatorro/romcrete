/** Coloanele fișei produsului, aceleași în catalog și pe liniile ofertei. */
export const SHEET_COLUMNS = ["intro", "package_contents", "specs_text", "benefits", "recommendations", "applications"] as const;

export type ProductSheetTexts = Record<(typeof SHEET_COLUMNS)[number], string | null>;

/** Textele fișei dintr-un rând de catalog, gata de copiat pe ofertă. */
export function pickSheet(row: Partial<Record<string, unknown>>): ProductSheetTexts {
  return Object.fromEntries(
    SHEET_COLUMNS.map((column) => [column, typeof row[column] === "string" ? (row[column] as string) : null]),
  ) as ProductSheetTexts;
}
