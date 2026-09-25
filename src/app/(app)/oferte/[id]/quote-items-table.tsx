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
      <p className="px-4 py-8 text-center text-sm text-neutral-500">
        Oferta nu are încă linii. Adaugă produse din catalog sau o linie liberă.
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-neutral-200 bg-neutral-50">
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
          <tbody className="divide-y divide-neutral-200">
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
                    <SubmitButton form={`item-${item.id}`} className="btn btn-secondary btn-sm">
                      Salvează
                    </SubmitButton>
                    <SubmitButton
                      form={`item-${item.id}`}
                      formAction={remove}
                      className="btn btn-danger-ghost btn-sm"
                      pendingLabel="Se șterge…"
                      confirmLabel="Da, șterge"
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

      {/* Pe telefon fiecare linie e un card cu câmpuri mari; aceleași acțiuni ca în tabel. */}
      <ul className="divide-y divide-neutral-200 md:hidden">
        {items.map((item) => {
          const formId = `item-m-${item.id}`;
          return (
            <li key={item.id} className="space-y-2 p-3">
              <form id={formId} action={update}>
                <input type="hidden" name="item_id" value={item.id} />
                <input type="hidden" name="description" value={item.description ?? ""} />
                <input
                  name="name"
                  defaultValue={item.name}
                  required
                  aria-label="Denumire"
                  className="input min-h-11 font-medium"
                />
              </form>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Cantitate">
                  <input
                    form={formId}
                    name="quantity"
                    type="number"
                    inputMode="decimal"
                    step="0.001"
                    min="0"
                    defaultValue={item.quantity}
                    className="input min-h-11 text-right tabular-nums"
                  />
                </Field>
                <Field label="UM">
                  <select form={formId} name="unit" defaultValue={item.unit} className="input min-h-11">
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Disc. %">
                  <input
                    form={formId}
                    name="discount_pct"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max="100"
                    defaultValue={item.discount_pct}
                    className="input min-h-11 text-right tabular-nums"
                  />
                </Field>
                <Field label="Preț unitar" wide>
                  <input
                    form={formId}
                    name="unit_price"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    defaultValue={item.unit_price}
                    className="input min-h-11 text-right tabular-nums"
                  />
                </Field>
                <Field label="TVA %">
                  <input
                    form={formId}
                    name="vat_rate"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max="100"
                    defaultValue={item.vat_rate}
                    className="input min-h-11 text-right tabular-nums"
                  />
                </Field>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm">
                  Valoare: <b className="tabular-nums">{formatMoney(lineNet(item), currency)}</b>
                </span>
                <SubmitButton
                  form={formId}
                  formAction={remove}
                  className="btn btn-danger-ghost"
                  pendingLabel="Se șterge…"
                  confirmLabel="Da, șterge"
                  confirm={`Ștergi linia „${item.name}”?`}
                >
                  Șterge
                </SubmitButton>
                <SubmitButton form={formId} className="btn btn-secondary">
                  Salvează
                </SubmitButton>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${wide ? "col-span-2" : ""}`}>
      <span className="mb-0.5 block text-xs text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
