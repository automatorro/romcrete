/** Textele de pe fișa produsului, în ordinea în care apar pe ofertă. */
export const SHEET_FIELDS = [
  {
    name: "intro",
    label: "Prezentare",
    hint: "Paragraful de sub titlu: ce este produsul și pentru ce lucrări e potrivit.",
    rows: 4,
  },
  {
    name: "package_contents",
    label: "Conține",
    hint: "Ce vine în pachet, câte un element pe rând.",
    rows: 4,
  },
  {
    name: "specs_text",
    label: "Specificații tehnice",
    hint: "Câte una pe rând: „Parametru | Valoare” sau „Parametru | Valoare | Observații”. Goale, se iau din catalog și din magazin.",
    rows: 6,
  },
  {
    name: "benefits",
    label: "Avantaje și beneficii",
    hint: "Câte unul pe rând. „Nume – explicație” scrie numele îngroșat.",
    rows: 4,
  },
  {
    name: "recommendations",
    label: "Recomandări și condiții de utilizare",
    hint: "Câte una pe rând.",
    rows: 3,
  },
  {
    name: "applications",
    label: "Aplicații recomandate",
    hint: "Câte una pe rând.",
    rows: 3,
  },
] as const;

export type SheetFieldName = (typeof SHEET_FIELDS)[number]["name"];

/**
 * Câmpurile fișei produsului. Aceleași în catalog (scrise o dată, intră în
 * toate ofertele) și pe ofertă (schimbate doar pentru clientul acela).
 */
export function SheetFields({
  values,
  idPrefix = "",
}: {
  values?: Partial<Record<SheetFieldName, string | null>>;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-3">
      {SHEET_FIELDS.map((field) => (
        <div key={field.name}>
          <label className="label" htmlFor={`${idPrefix}${field.name}`}>
            {field.label}
          </label>
          <textarea
            id={`${idPrefix}${field.name}`}
            name={field.name}
            rows={field.rows}
            defaultValue={values?.[field.name] ?? ""}
            className="input text-sm"
          />
          <p className="mt-1 text-xs text-neutral-500">{field.hint}</p>
        </div>
      ))}
    </div>
  );
}
