export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Clase pentru celula din tabel, ex. `text-right tabular-nums`. */
  className?: string;
  /** Pe telefon, coloana nu mai apare pe card (e deja în titlu sau nu contează din mers). */
  hideOnMobile?: boolean;
};

/**
 * O listă care se așază după ecran: tabel pe calculator, carduri pe telefon.
 * Aceeași definiție de coloane pentru amândouă, ca să nu se despartă în timp.
 *
 * Pe card, `title` și `actions` stau sus; restul coloanelor devin perechi
 * etichetă–valoare dedesubt.
 */
export function DataList<T>({
  rows,
  rowKey,
  columns,
  title,
  actions,
  minWidth = 720,
  muted,
}: {
  rows: T[];
  rowKey: (row: T) => string;
  columns: Column<T>[];
  /** Titlul cardului pe telefon: de obicei numele sau numărul, ca link. */
  title: (row: T) => React.ReactNode;
  /** Acțiunile rândului: ultima coloană pe calculator, colțul cardului pe telefon. */
  actions?: (row: T) => React.ReactNode;
  minWidth?: number;
  /** Rândurile estompate: produse inactive, oferte arhivate. */
  muted?: (row: T) => boolean;
}) {
  return (
    <>
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full" style={{ minWidth }}>
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              {columns.map((c) => (
                <th key={c.header} className={`table-head ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
              {actions ? (
                <th className="table-head">
                  <span className="sr-only">Acțiuni</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {rows.map((row) => (
              <tr key={rowKey(row)} className={muted?.(row) ? "bg-neutral-50/60 opacity-60" : "hover:bg-neutral-50"}>
                {columns.map((c) => (
                  <td key={c.header} className={`table-cell ${c.className ?? ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
                {actions ? <td className="table-cell w-px text-right whitespace-nowrap">{actions(row)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className={`card p-3 ${muted?.(row) ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 text-[15px] font-semibold">{title(row)}</div>
              {actions ? <div className="shrink-0">{actions(row)}</div> : null}
            </div>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((c) => (
                  <div key={c.header} className="min-w-0">
                    <dt className="text-xs text-neutral-500">{c.header}</dt>
                    <dd className="break-words">{c.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
