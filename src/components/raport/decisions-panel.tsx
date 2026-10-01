import { deleteDecision, updateDecision } from "@/app/(app)/rapoarte/actions";
import { AddDecisionForm } from "@/components/raport/add-decision-form";
import { SubmitButton } from "@/components/submit-button";
import { DECISION_STATUS_LABELS, type Decision, type DecisionStatus, type ReportDecisions } from "@/lib/decizii";
import { formatDate } from "@/lib/totals";

const STATUSES = Object.keys(DECISION_STATUS_LABELS) as DecisionStatus[];

/** O decizie, cu starea dintr-o apăsare și ce a ieșit. */
function DecisionRow({ d, reportId, canDelete }: { d: Decision; reportId: string; canDelete: boolean }) {
  return (
    <li className="rounded-xl border border-neutral-200 p-3">
      <p className="text-sm">{d.text}</p>
      <p className="text-xs text-neutral-500">
        {[d.owner, d.due_date ? `termen ${formatDate(d.due_date)}` : null].filter(Boolean).join(" · ") || "fără responsabil"}
      </p>
      <form action={updateDecision} className="mt-2 space-y-2">
        <input type="hidden" name="id" value={d.id} />
        <input type="hidden" name="report_id" value={reportId} />
        <label htmlFor={`outcome-${d.id}`} className="sr-only">
          Ce a ieșit
        </label>
        <input
          id={`outcome-${d.id}`}
          name="outcome"
          defaultValue={d.outcome ?? ""}
          placeholder="Ce a ieșit (opțional)"
          className="input text-sm"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Starea deciziei">
          {STATUSES.map((s) => (
            <SubmitButton
              key={s}
              name="status"
              value={s}
              pendingLabel="…"
              className={`chip min-h-9 px-3 py-1 text-sm ${s === d.status ? "chip-on" : ""}`}
            >
              {DECISION_STATUS_LABELS[s]}
            </SubmitButton>
          ))}
        </div>
      </form>
      {canDelete ? (
        <form action={deleteDecision} className="mt-1 text-right">
          <input type="hidden" name="id" value={d.id} />
          <input type="hidden" name="report_id" value={reportId} />
          <SubmitButton
            className="text-xs text-neutral-500 hover:text-neutral-900 hover:underline"
            pendingLabel="Se șterge…"
            confirm="Ștergi decizia?"
            confirmLabel="Da, șterge"
          >
            Șterge
          </SubmitButton>
        </form>
      ) : null}
    </li>
  );
}

/**
 * Deciziile din pagina raportului: urmărirea celor de data trecută, apoi cele
 * luate acum. Starea se poate schimba și după trimitere — e pentru raportul
 * următor; PDF-ul trimis rămâne cu starea de la trimitere.
 */
export function DecisionsPanel({ reportId, decisions }: { reportId: string; decisions: ReportDecisions | null }) {
  if (!decisions) {
    return (
      <p className="notice text-sm">
        Deciziile se pot nota după ce se aplică migrația 20261001180000_decizii.sql în Supabase.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {decisions.followUp.length ? (
        <div>
          <p className="mb-2 text-sm font-medium">Data trecută s-a hotărât</p>
          <ul className="space-y-2">
            {decisions.followUp.map((d) => (
              <DecisionRow key={d.id} d={d} reportId={reportId} canDelete={false} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">Nicio decizie de urmărit din rapoartele anterioare.</p>
      )}
      {decisions.created.length ? (
        <div>
          <p className="mb-2 text-sm font-medium">Hotărâte în acest raport</p>
          <ul className="space-y-2">
            {decisions.created.map((d) => (
              <DecisionRow key={d.id} d={d} reportId={reportId} canDelete />
            ))}
          </ul>
        </div>
      ) : null}
      <AddDecisionForm reportId={reportId} />
    </div>
  );
}
