"use client";

import { useActionState } from "react";

import { updateReport } from "@/app/(app)/rapoarte/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { ALL_SECTIONS, SECTION_LABELS, type ReportSection } from "@/lib/raport-sectiuni";

/**
 * Ce scrie omul peste cifre: titlul, rezumatul, ce secțiuni intră, o observație
 * sub fiecare și cui se trimite. Cifrele nu se editează: vin din date.
 */
export function ReportForm({
  id,
  title,
  summary,
  sections,
  notes,
  recipients,
}: {
  id: string;
  title: string;
  summary: string | null;
  sections: ReportSection[];
  notes: Partial<Record<ReportSection, string>>;
  recipients: string[];
}) {
  const [state, formAction] = useActionState(updateReport.bind(null, id), null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="r-title" className="label">
          Titlu
        </label>
        <input id="r-title" name="title" defaultValue={title} required className="input min-h-11" />
      </div>

      <div>
        <label htmlFor="r-summary" className="label">
          Rezumat
        </label>
        <textarea
          id="r-summary"
          name="summary"
          rows={5}
          defaultValue={summary ?? ""}
          placeholder="Pe scurt: ce a mers, ce nu, ce urmează. Apare sus, înaintea cifrelor."
          className="input"
        />
      </div>

      <fieldset>
        <legend className="label">Secțiuni și observații</legend>
        <p className="mb-2 text-xs text-neutral-500">
          Bifează ce intră în raport. Observația apare deasupra secțiunii, evidențiată.
        </p>
        <div className="space-y-2">
          {ALL_SECTIONS.map((s) => (
            <details key={s} className="rounded-xl border border-neutral-200 bg-white" open={Boolean(notes[s])}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-3">
                <input
                  type="checkbox"
                  name="sections"
                  value={s}
                  defaultChecked={sections.includes(s)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-5 w-5 accent-[var(--color-brand-600)]"
                  aria-label={`Include „${SECTION_LABELS[s]}”`}
                />
                <span className="flex-1 text-sm font-medium">{SECTION_LABELS[s]}</span>
                <span className="text-xs text-brand-700">{notes[s] ? "observație ▾" : "+ observație"}</span>
              </summary>
              <div className="px-3 pb-3">
                <textarea
                  name={`nota_${s}`}
                  rows={2}
                  defaultValue={notes[s] ?? ""}
                  placeholder="Observație pentru această secțiune (opțional)"
                  className="input text-sm"
                />
              </div>
            </details>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="r-recipients" className="label">
          Destinatari
        </label>
        <textarea
          id="r-recipients"
          name="recipients"
          rows={2}
          defaultValue={recipients.join(", ")}
          placeholder="director@firma.ro, vanzari@firma.ro"
          className="input"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Separate prin virgulă. Lista implicită se schimbă din Setări firmă.
        </p>
      </div>

      <FormMessage state={state} />
      <SubmitButton className="btn btn-ok btn-lg w-full" pendingLabel="Se salvează…">
        Salvează raportul
      </SubmitButton>
    </form>
  );
}
