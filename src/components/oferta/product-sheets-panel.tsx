import { resetQuoteItemSheet, updateQuoteItemSheet } from "@/app/(app)/oferte/actions";
import { SheetFields } from "@/components/oferta/sheet-fields";
import { SubmitButton } from "@/components/submit-button";
import type { QuoteItem } from "@/lib/types";

/**
 * Fișa fiecărui produs, așa cum apare pe ofertă: prezentarea, ce conține,
 * specificațiile, avantajele, recomandările și aplicațiile. Vin din catalog;
 * schimbate aici, rămân doar pe oferta aceasta.
 */
export function ProductSheetsPanel({ quoteId, items }: { quoteId: string; items: QuoteItem[] }) {
  if (!items.length) return null;
  const save = updateQuoteItemSheet.bind(null, quoteId);
  const reset = resetQuoteItemSheet.bind(null, quoteId);

  return (
    <section className="card">
      <header className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-base font-semibold text-neutral-900">Fișele produselor pe ofertă</h2>
        <p className="text-sm text-neutral-500">
          Textele vin din catalog. Ce schimbi aici rămâne doar pe oferta aceasta.
        </p>
      </header>
      <ul className="divide-y divide-neutral-200">
        {items.map((item, index) => {
          const filled = Boolean(item.intro || item.package_contents || item.benefits || item.specs_text);
          return (
            <li key={item.id}>
              <details className="group px-4 py-2">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium">
                  <span className="text-neutral-500">{index + 1}.</span>
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <span className={`text-xs ${filled ? "text-neutral-500" : "font-semibold text-bad"}`}>
                    {filled ? "completată" : item.is_service ? "fără fișă" : "fișă goală"}
                  </span>
                  <span className="text-brand-700 group-open:hidden">▾</span>
                </summary>
                <form action={save} className="space-y-3 pb-3">
                  <input type="hidden" name="item_id" value={item.id} />
                  <SheetFields values={item} idPrefix={`fisa-${item.id}-`} />
                  <div className="flex flex-wrap justify-end gap-2">
                    {item.catalog_item_id ? (
                      <SubmitButton
                        formAction={reset}
                        className="btn btn-secondary min-h-11"
                        pendingLabel="Se reiau…"
                        confirm="Reiei textele din catalog? Ce ai schimbat pe oferta aceasta se pierde."
                        confirmLabel="Da, reia din catalog"
                      >
                        Reia din catalog
                      </SubmitButton>
                    ) : null}
                    <SubmitButton className="btn btn-ok min-h-11" pendingLabel="Se salvează…">
                      Salvează fișa
                    </SubmitButton>
                  </div>
                </form>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
