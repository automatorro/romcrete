import { formatMoney, formatQuantity, lineFinal, sumFinals } from "@/lib/totals";
import type { QuoteItem } from "@/lib/types";

const label = (currency: string) => (currency === "RON" ? "lei" : "EUR");

/**
 * Finalul ofertei când clientul ia toate produsele: recapitularea lor, cu
 * prețul fiecăruia, apoi totalul de plată. Sumele se adună din prețurile
 * tipărite sub produse, deci se verifică una cu alta.
 */
export function TotalSummary({
  items,
  quoteDiscountPct,
  base,
  other,
}: {
  items: QuoteItem[];
  quoteDiscountPct: number;
  base: string;
  other: { currency: string; convert: (v: number) => number } | null;
}) {
  const t = sumFinals(items, quoteDiscountPct);
  const rows: { label: string; value: number }[] = [
    { label: "Total produse fără TVA", value: t.linesNet },
    ...(t.quoteDiscount > 0 ? [{ label: `Discount ofertă ${quoteDiscountPct}%`, value: -t.quoteDiscount }] : []),
    { label: "Bază de impozitare", value: t.net },
    { label: "TVA", value: t.vat },
  ];
  const cells = (value: number) => (
    <>
      <td className="px-2 py-1 text-right whitespace-nowrap">{formatMoney(value, base)}</td>
      {other ? (
        <td className="px-2 py-1 text-right whitespace-nowrap text-brand-700">
          {formatMoney(other.convert(value), other.currency)}
        </td>
      ) : null}
    </>
  );

  return (
    <div className="text-[12px] tabular-nums">
      <table className="w-full border-collapse break-inside-avoid">
        <thead>
          <tr className="bg-neutral-800 text-white">
            <th className="px-2 py-1 text-left font-semibold">#</th>
            <th className="px-2 py-1 text-left font-semibold">Produs</th>
            <th className="px-2 py-1 text-right font-semibold">Cantitate</th>
            <th className="px-2 py-1 text-right font-semibold">Preț cu TVA, {label(base)}</th>
            {other ? <th className="px-2 py-1 text-right font-semibold">{label(other.currency)}</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} className="border-b border-neutral-200 even:bg-neutral-50">
              <td className="px-2 py-1 text-neutral-500">{i + 1}</td>
              <td className="px-2 py-1">{item.name}</td>
              <td className="px-2 py-1 text-right whitespace-nowrap">
                {formatQuantity(item.quantity)} {item.unit}
              </td>
              {cells(lineFinal(item, quoteDiscountPct).gross)}
            </tr>
          ))}
        </tbody>
      </table>

      <table className="mt-4 ml-auto w-full max-w-[120mm] border-collapse break-inside-avoid">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-neutral-200">
              <td className="px-2 py-1">{row.label}</td>
              {cells(row.value)}
            </tr>
          ))}
          <tr className="border-t-2 border-neutral-900 text-[14px] font-bold">
            <td className="px-2 py-1">Total de plată</td>
            {cells(t.gross)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
