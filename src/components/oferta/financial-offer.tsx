import { currencyLabel, type OfferDocument } from "@/lib/oferta-document";
import { formatMoney, formatQuantity } from "@/lib/totals";

/**
 * „Oferta financiară” de la final, ca în oferta model: toate produsele într-un
 * tabel și totalul de plată. Apare doar când clientul ia toate produsele și
 * agentul a cerut totalul; sumele se adună din prețurile de sub produse.
 */
export function FinancialOffer({ doc }: { doc: OfferDocument }) {
  const { products, totals, base, other, quote } = doc;
  if (!totals) return null;

  const cur = currencyLabel(base);
  const vatRates = [...new Set(products.map((p) => Number(p.item.vat_rate)))];
  const vatHead = vatRates.length === 1 ? `TVA (${vatRates[0]}%)` : "TVA";
  const cell = "border border-neutral-300 px-2 py-1";

  return (
    <div className="text-[12px] tabular-nums">
      <table className="w-full border-collapse break-inside-avoid">
        <thead>
          <tr className="bg-neutral-100">
            <th className={`${cell} text-left`}>Part N</th>
            <th className={`${cell} text-left`}>Denumire</th>
            <th className={`${cell} text-right`}>Cant.</th>
            <th className={`${cell} text-right`}>Preț unitar {cur} fără TVA</th>
            <th className={`${cell} text-right`}>Valoare {cur} fără TVA</th>
            <th className={`${cell} text-right`}>{vatHead}</th>
          </tr>
        </thead>
        <tbody>
          {products.map(({ item, sku, price }) => (
            <tr key={item.id}>
              <td className={`${cell} whitespace-nowrap`}>{sku ?? ""}</td>
              <td className={cell}>{item.name}</td>
              <td className={`${cell} text-right whitespace-nowrap`}>
                {formatQuantity(item.quantity)} {item.unit}
              </td>
              <td className={`${cell} text-right whitespace-nowrap`}>{formatMoney(item.unit_price, base)}</td>
              <td className={`${cell} text-right whitespace-nowrap`}>{formatMoney(price.net, base)}</td>
              <td className={`${cell} text-right whitespace-nowrap`}>{formatMoney(price.vat, base)}</td>
            </tr>
          ))}
          {totals.quoteDiscount > 0 ? (
            <tr>
              <td colSpan={4} className={`${cell} text-right`}>
                din care discount ofertă {Number(quote.discount_pct)}%
              </td>
              <td className={`${cell} text-right`}>−{formatMoney(totals.quoteDiscount, base)}</td>
              <td className={cell} />
            </tr>
          ) : null}
          <tr className="font-bold">
            <td colSpan={4} className={`${cell} text-right`}>
              Total fără TVA / TVA
            </td>
            <td className={`${cell} text-right whitespace-nowrap`}>{formatMoney(totals.net, base)}</td>
            <td className={`${cell} text-right whitespace-nowrap`}>{formatMoney(totals.vat, base)}</td>
          </tr>
          <tr className="bg-neutral-800 text-[14px] font-bold text-white">
            <td colSpan={4} className="px-2 py-1.5 text-right">
              TOTAL {cur.toUpperCase()} TVA INCLUS
            </td>
            <td colSpan={2} className="px-2 py-1.5 text-right whitespace-nowrap">
              {formatMoney(totals.gross, base)}
            </td>
          </tr>
          {other ? (
            <tr className="font-semibold text-brand-700">
              <td colSpan={4} className={`${cell} text-right`}>
                Echivalent în {other.currency === "EUR" ? "euro" : "lei"}, TVA inclus
              </td>
              <td colSpan={2} className={`${cell} text-right whitespace-nowrap`}>
                {formatMoney(other.convert(totals.gross), other.currency)}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
