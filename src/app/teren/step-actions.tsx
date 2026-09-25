"use client";

import { useState } from "react";

import { markStepDone, rescheduleStep, startVisit } from "@/app/teren/actions";
import { SubmitButton } from "@/components/submit-button";
import { quickDates, shortDay } from "@/lib/agenda";

type Props = {
  visitId: string;
  clientId: string;
  phone: string | null;
  /** Adresa completă, pentru navigație. Lipsă = butonul nu apare. */
  mapQuery: string | null;
  today: string;
  /** Pe lista de firme vizita se pornește din fișă; butonul ar fi în plus. */
  withStartVisit?: boolean;
};

type Panel = "done" | "move" | null;

/**
 * Acțiunile unei sarcini din agendă, cu ținte de atingere mari. „Făcut” nu
 * închide pur și simplu pasul: întreabă când revii, ca firma să nu rămână
 * fără o dată în agendă. Închiderea fără revenire e o alegere explicită.
 */
export function StepActions({ visitId, clientId, phone, mapQuery, today, withStartVisit = true }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  return (
    <div className="mt-2.5">
      <div className="grid grid-cols-2 gap-2">
        {withStartVisit ? (
          <form action={startVisit} className={phone || mapQuery ? "" : "col-span-2"}>
            <input type="hidden" name="client_id" value={clientId} />
            <SubmitButton className="btn btn-primary btn-lg w-full" pendingLabel="Se deschide…">
              Începe vizita
            </SubmitButton>
          </form>
        ) : null}
        {phone ? (
          <a href={`tel:${phone}`} className="btn btn-secondary btn-lg">
            Sună
          </a>
        ) : null}
        {mapQuery ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
            target="_blank"
            rel="noreferrer"
            className={`btn btn-secondary btn-lg ${phone && withStartVisit ? "col-span-2" : ""}`}
          >
            Navighează
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => toggle("done")}
          aria-expanded={panel === "done"}
          className="btn btn-ok btn-lg"
        >
          ✓ Făcut
        </button>
        <button
          type="button"
          onClick={() => toggle("move")}
          aria-expanded={panel === "move"}
          className="btn btn-secondary btn-lg"
        >
          Amână
        </button>
      </div>

      {panel ? (
        <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <p className="mb-2 text-sm font-medium">
            {panel === "done" ? "Bun. Când revii la firmă?" : "Pe ce zi o muți?"}
          </p>
          <DatePicks visitId={visitId} today={today} />
          {panel === "done" ? (
            <form action={markStepDone} className="mt-2">
              <input type="hidden" name="visit_id" value={visitId} />
              <SubmitButton className="btn btn-secondary btn-lg w-full" pendingLabel="Se închide…">
                Nu mai revin deocamdată
              </SubmitButton>
              <p className="mt-1 text-xs text-neutral-500">
                Firma reapare singură la „De reluat”, după pragul din Setări.
              </p>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Datele rapide plus o dată aleasă de mână; toate mută pasul pe ziua aleasă. */
function DatePicks({ visitId, today }: { visitId: string; today: string }) {
  return (
    <>
      <form action={rescheduleStep} className="grid grid-cols-2 gap-2">
        <input type="hidden" name="visit_id" value={visitId} />
        {quickDates(today).map((q) => (
          <button key={q.label} type="submit" name="date" value={q.date} className="btn btn-secondary btn-lg flex-col gap-0 py-1.5">
            <span>{q.label}</span>
            <span className="text-xs font-normal text-neutral-500">{shortDay(q.date)}</span>
          </button>
        ))}
      </form>
      <form action={rescheduleStep} className="mt-2 flex gap-2">
        <input type="hidden" name="visit_id" value={visitId} />
        <input type="date" name="date" min={today} required className="input min-h-12 flex-1" aria-label="Altă dată" />
        <SubmitButton className="btn btn-primary btn-lg" pendingLabel="…">
          Alege
        </SubmitButton>
      </form>
    </>
  );
}
