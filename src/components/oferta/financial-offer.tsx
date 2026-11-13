import { currencyLabel, type OfferDocument } from "@/lib/oferta-document";
import { formatMoney, formatQuantity } from "@/lib/totals";

export function FinancialOffer({ doc }: { doc: OfferDocument }) {
  const { products, totals, base, other } = doc;
  if (!products.length) return null;

  const cur = currencyLabel(base);
  const cell = "border border-neutral-300 px-2 py-1";
  const amount = (value: number, inverse = false) => (
    <>
      <span>{formatMoney(value, base)}</span>
      {other ? (
        <span className={`block text-[10px] ${inverse ? "text-white/70" : "text-neutral-500"}`}>
          {formatMoney(other.convert(value), other.currency)}
        </span>
      ) : null}
    </>
  );

  return (
    <div className="text-[12px] tabular-nums">
      <table className="w-full table-fixed border-collapse break-inside-avoid">
        <colgroup>
          <col className="w-[7%]" />
          <col className="w-[13%]" />
          <col className="w-[38%]" />
          <col className="w-[10%]" />
          <col className="w-[16%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="bg-neutral-100">
            <th className={`${cell} text-center`}>Nr.crt</th>
            <th className={`${cell} text-left`}>Cod</th>
            <th className={`${cell} text-left`}>Produs</th>
            <th className={`${cell} text-right`}>Buc</th>
            <th className={`${cell} text-right`}>Preț {cur}/buc</th>
            <th className={`${cell} text-right`}>Total {cur}</th>
          </tr>
        </thead>
        <tbody>
          {products.map(({ item, sku, price }, index) => {
            const quantity = Number(item.quantity);
            const unitPrice = quantity ? price.net / quantity : price.net;
            return (
              <tr key={item.id} className="break-inside-avoid">
                <td className={`${cell} text-center`}>{index + 1}</td>
                <td className={`${cell} break-words`}>{sku ?? ""}</td>
                <td className={cell}>{item.name}</td>
                <td className={`${cell} text-right`}>
                  {formatQuantity(item.quantity)} {item.unit}
                </td>
                <td className={`${cell} text-right break-words`}>{amount(unitPrice)}</td>
                <td className={`${cell} text-right break-words`}>{amount(price.net)}</td>
              </tr>
            );
          })}
          {totals ? (
            <>
              <tr className="font-bold">
                <td colSpan={5} className={`${cell} text-right`}>Total fără TVA</td>
                <td className={`${cell} text-right`}>{amount(totals.net)}</td>
              </tr>
              <tr>
                <td colSpan={5} className={`${cell} text-right`}>TVA</td>
                <td className={`${cell} text-right`}>{amount(totals.vat)}</td>
              </tr>
              <tr className="bg-neutral-800 font-bold text-white">
                <td colSpan={5} className="px-2 py-1.5 text-right">
                  TOTAL {cur.toUpperCase()} TVA INCLUS
                </td>
                <td className="px-2 py-1.5 text-right">{amount(totals.gross, true)}</td>
              </tr>
            </>
          ) : null}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-neutral-600">
        Prețurile unitare și totalurile pe produs nu includ TVA.
      </p>
    </div>
  );
}
