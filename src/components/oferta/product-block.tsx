import type { Spec } from "@/lib/oferta-print";
import { formatMoney, formatQuantity, lineFinal } from "@/lib/totals";
import type { QuoteItem } from "@/lib/types";

const label = (currency: string) => (currency === "RON" ? "lei" : "EUR");

/**
 * Un produs pe oferta tipărită: poza, caracteristicile, apoi prețul lui, în lei
 * și în euro. Produsele stau unul sub altul, fiecare cu prețul propriu; oferta
 * nu le adună, pe oricâte pagini s-ar întinde.
 */
export function ProductBlock({
  item,
  image,
  specs,
  index,
  quoteDiscountPct,
  base,
  other,
}: {
  item: QuoteItem;
  image: string | null;
  specs: Spec[];
  index: number;
  quoteDiscountPct: number;
  base: string;
  other: { currency: string; convert: (v: number) => number } | null;
}) {
  // Discountul pe ofertă se aplică fiecărui produs, ca prețul de sub el să fie cel final.
  const { beforeQuoteDiscount, quoteDiscount, net, vat, gross } = lineFinal(item, quoteDiscountPct);
  const lineDiscount = Number(item.discount_pct) > 0;

  const rows: { label: string; value: number; strong?: boolean }[] = [
    { label: "Preț unitar fără TVA", value: Number(item.unit_price) },
    ...(lineDiscount || Number(item.quantity) !== 1
      ? [
          {
            label: `Valoare pentru ${formatQuantity(item.quantity)} ${item.unit}${lineDiscount ? `, cu discount ${item.discount_pct}%` : ""}`,
            value: beforeQuoteDiscount,
          },
        ]
      : []),
    ...(quoteDiscount > 0 ? [{ label: `Discount ofertă ${quoteDiscountPct}%`, value: -quoteDiscount }] : []),
    { label: "Valoare fără TVA", value: net },
    { label: `TVA ${item.vat_rate}%`, value: vat },
    { label: "Preț total cu TVA", value: gross, strong: true },
  ];

  return (
    // Produsul și prețul lui stau pe aceeași pagină când încap; un produs cu
    // foarte multe caracteristici se rupe, dar tabelul de preț își poartă numele.
    <div className={`border-t border-neutral-300 break-inside-avoid ${index ? "mt-8 pt-6" : "mt-3 pt-4"}`}>
      <div className="flex gap-5 break-inside-avoid">
        {/* Un serviciu sau o linie fără poză și fără fișă nu primește un pătrat gol. */}
        {image || (specs.length && !item.is_service) ? (
          <div className="flex h-[48mm] w-[48mm] shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white p-2">
            {image ? (
              // Poza vine din magazin, de pe alt domeniu; la tipărire trebuie să fie deja în pagină.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={item.name} className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-center text-[11px] text-neutral-500">fără poză</span>
            )}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-tight font-semibold">
            <span className="text-neutral-500">{index + 1}. </span>
            {item.name}
          </p>
          {item.description ? <p className="mt-1 text-[12px] text-neutral-600">{item.description}</p> : null}

          {specs.length ? (
            <table className="mt-2 w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-neutral-800 text-white">
                  <th colSpan={2} className="px-2 py-1 text-left font-semibold">
                    Caracteristici principale
                  </th>
                </tr>
              </thead>
              <tbody>
                {specs.map((spec) => (
                  <tr key={spec.label} className="border-b border-neutral-200 even:bg-neutral-50">
                    <th className="w-[38%] px-2 py-1 text-left align-top font-medium text-neutral-600">
                      {spec.label}
                    </th>
                    <td className="px-2 py-1 align-top">{spec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>

      {/* Prețul produsului, imediat sub el, în lei și în euro. */}
      <table className="mt-4 ml-auto w-[120mm] border-collapse text-[12px] tabular-nums break-inside-avoid">
        <thead>
          <tr className="bg-neutral-800 text-white">
            <th className="px-2 py-1 text-left font-semibold">
              Preț · {index + 1}. {item.name}
            </th>
            <th className="px-2 py-1 text-right font-semibold">{label(base)}</th>
            {other ? <th className="px-2 py-1 text-right font-semibold">{label(other.currency)}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={row.strong ? "border-t-2 border-neutral-900 text-[14px] font-bold" : "border-b border-neutral-200"}
            >
              <td className="px-2 py-1">{row.label}</td>
              <td className="px-2 py-1 text-right whitespace-nowrap">{formatMoney(row.value, base)}</td>
              {other ? (
                <td className="px-2 py-1 text-right whitespace-nowrap text-brand-700">
                  {formatMoney(other.convert(row.value), other.currency)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
