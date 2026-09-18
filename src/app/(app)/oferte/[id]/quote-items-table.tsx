import { deleteQuoteItem, updateQuoteItem } from "@/app/(app)/oferte/actions";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney, lineNet } from "@/lib/totals";
import { UNITS, type QuoteItem } from "@/lib/types";

/**
 * Fiecare linie este un formular propriu: „Salvează” actualizează linia,
 * iar butonul de ștergere trimite același formular către alt Server Action.
 */
export function QuoteItemsTable({
  quoteId,
  items,
  currency,
}: {
  quoteId: string;
  items: QuoteItem[];
  currency: string;
}) {
  const update = updateQuoteItem.bind(null, quoteId);
  const remove = deleteQuoteItem.bind(null, quoteId);

  if (items.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-concrete-500">
        Oferta nu are încă linii. Adaugă produse din catalog sau o linie liberă.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px]">
        <thead className="border-b border-concrete-200 bg-concrete-50">
          <tr>
            <th className="table-head w-[28%]">Denumire</th>
            <th className="table-head">UM</th>
            <th className="table-head text-right">Cantitate</th>
            <th className="table-head text-right">Preț unitar</th>
            <th className="table-head text-right">Disc. %</th>
            <th className="table-head text-right">TVA %</th>
            <th className="table-head text-right">Valoare</th>
            <th className="table-head" />
          </tr>
        </thead>
        <tbody className="divide-y divide-concrete-200">
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="px-4 py-3">
                <form id={`item-${item.id}`} action={update} className="space-y-2">
                  <input type="hidden" name="item_id" value={item.id} />
                  <input
                    name="name"
                    defaultValue={item.name}
                    required
                    aria-label="Denumire"
                    className="input"
                  />
                  <textarea
                    name="description"
                    rows={1}
                    defaultValue={item.description ?? ""}
                    placeholder="Detalii (opțional)"
                    aria-label="Descriere"
                    className="input text-xs"
                  />
                </form>
              </td>
              <td className="px-2 py-3">
                <select
                  form={`item-${item.id}`}
                  name="unit"
                  defaultValue={item.unit}
                  aria-label="Unitate de măsură"
                  className="input"
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-2 py-3">
                <input
                  form={`item-${item.id}`}
                  name="quantity"
                  type="number"
                  step="0.001"
                  min="0"
                  defaultValue={item.quantity}
                  aria-label="Cantitate"
                  className="input w-24 text-right tabular-nums"
                />
              </td>
              <td className="px-2 py-3">
                <input
                  form={`item-${item.id}`}
                  name="unit_price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={item.unit_price}
                  aria-label="Preț unitar"
                  className="input w-28 text-right tabular-nums"
                />
              </td>
              <td className="px-2 py-3">
                <input
                  form={`item-${item.id}`}
                  name="discount_pct"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={item.discount_pct}
                  aria-label="Discount linie"
                  className="input w-20 text-right tabular-nums"
                />
              </td>
              <td className="px-2 py-3">
                <input
                  form={`item-${item.id}`}
                  name="vat_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={item.vat_rate}
                  aria-label="Cotă TVA"
                  className="input w-20 text-right tabular-nums"
                />
              </td>
              <td className="px-4 py-3 text-right text-sm font-medium tabular-nums">
                {formatMoney(lineNet(item), currency)}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col items-end gap-2">
                  <SubmitButton form={`item-${item.id}`} className="btn btn-secondary text-xs">
                    Salvează
                  </SubmitButton>
                  <SubmitButton
                    form={`item-${item.id}`}
                    formAction={remove}
                    className="btn btn-ghost text-xs text-red-700"
                    pendingLabel="Se șterge…"
                    confirm={`Ștergi linia „${item.name}”?`}
                  >
                    Șterge
                  </SubmitButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
