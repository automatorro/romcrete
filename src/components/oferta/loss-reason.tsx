import { setLossReason } from "@/app/(app)/oferte/actions";
import { SubmitButton } from "@/components/submit-button";
import { LOSS_REASONS } from "@/lib/pierderi";
import type { Quote } from "@/lib/types";

/**
 * De ce s-a pierdut: apare doar la o ofertă respinsă sau expirată. Motivul se
 * alege dintr-o listă scurtă, ca raportul lunar să le poată număra.
 */
export function LossReason({ quote }: { quote: Quote }) {
  if (quote.status !== "rejected" && quote.status !== "expired") return null;

  // Coloana lipsește până se aplică migrația: întrebarea nu are unde se salva.
  if (!("loss_reason" in quote)) {
    return (
      <p className="notice mt-3 text-xs">
        Motivul pierderii se poate nota după ce se aplică migrația 20261001150000_motiv_pierdere.sql în Supabase.
      </p>
    );
  }

  return (
    <form action={setLossReason} className="mt-4 space-y-2 rounded-xl border border-neutral-200 p-3">
      <input type="hidden" name="quote_id" value={quote.id} />
      <fieldset>
        <legend className="text-sm font-medium text-neutral-900">De ce s-a pierdut?</legend>
        <p className="mb-2 text-xs text-neutral-500">Apare în raportul lunar, la „De ce pierdem”.</p>
        <div className="flex flex-wrap gap-2">
          {LOSS_REASONS.map((r) => (
            <label key={r.id} className="chip has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600">
              <input
                type="radio"
                name="loss_reason"
                value={r.id}
                defaultChecked={quote.loss_reason === r.id}
                className="sr-only"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`loss-note-${quote.id}`} className="sr-only">
        Ce a spus clientul
      </label>
      <textarea
        id={`loss-note-${quote.id}`}
        name="loss_note"
        rows={2}
        defaultValue={quote.loss_note ?? ""}
        placeholder="Ce a spus clientul, pe scurt (opțional)"
        className="input text-sm"
      />
      <SubmitButton className="btn btn-secondary" pendingLabel="Se salvează…">
        {quote.loss_reason ? "Actualizează motivul" : "Salvează motivul"}
      </SubmitButton>
    </form>
  );
}
