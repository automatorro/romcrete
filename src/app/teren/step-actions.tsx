"use client";

import { useState } from "react";

import { completeStep, postponeStep, startVisit } from "@/app/teren/actions";
import { SubmitButton } from "@/components/submit-button";
import { quickDates, shortDay } from "@/lib/agenda";
import type { ManualKind } from "@/lib/istoric";

type Props = {
  visitId: string;
  clientId: string;
  phone: string | null;
  /** Adresa completă, pentru navigație. Lipsă = butonul nu apare. */
  mapQuery: string | null;
  today: string;
  /** Pasul stabilit în vizită („Îl sun”, „Trimit ofertă”), pentru alegerea implicită. */
  step: string | null;
  /** Pe lista de firme vizita se pornește din fișă; butonul ar fi în plus. */
  withStartVisit?: boolean;
};

type Panel = "done" | "move" | null;

const DONE_KINDS: { id: ManualKind; label: string }[] = [
  { id: "telefon", label: "Am sunat" },
  { id: "email", label: "Am trimis email" },
  { id: "intalnire", label: "Ne-am văzut" },
  { id: "nota", label: "Altceva" },
];

/**
 * Enter într-un câmp de text ar trimite formularul cu primul buton, adică
 * „Mâine”: agentul ar muta pasul fără să fi ales ziua.
 */
function noEnterSubmit(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") e.preventDefault();
}

/** Ce a făcut probabil agentul, după pasul pe care și l-a propus. */
function kindForStep(step: string | null): ManualKind {
  if (step === "sun" || step === "owner") return "telefon";
  if (step === "oferta") return "email";
  if (step === "revin" || step === "demo") return "intalnire";
  return "nota";
}

/**
 * Acțiunile unei sarcini din agendă, cu ținte de atingere mari. „Făcut” nu
 * închide pur și simplu pasul: notează în istoric ce s-a întâmplat și întreabă
 * când revii, ca firma să nu rămână fără o dată în agendă.
 */
export function StepActions({
  visitId,
  clientId,
  phone,
  mapQuery,
  today,
  step,
  withStartVisit = true,
}: Props) {
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

      {panel === "done" ? (
        <form action={completeStep} className="mt-2 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <input type="hidden" name="visit_id" value={visitId} />
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Ce ai făcut?</legend>
            <div className="grid grid-cols-2 gap-2">
              {DONE_KINDS.map((k) => (
                <label
                  key={k.id}
                  className="chip justify-center rounded-xl has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:text-white"
                >
                  <input
                    type="radio"
                    name="kind"
                    value={k.id}
                    defaultChecked={k.id === kindForStep(step)}
                    className="sr-only"
                  />
                  {k.label}
                </label>
              ))}
            </div>
          </fieldset>
          <input
            type="text"
            name="body"
            placeholder="Ce a zis? (opțional, rămâne în istoric)"
            onKeyDown={noEnterSubmit}
            className="input min-h-12"
          />
          <DatePicks today={today} question="Când revii?" />
          <SubmitButton
            className="btn btn-secondary btn-lg w-full"
            pendingLabel="Se salvează…"
            name="date"
            value=""
          >
            Nu mai revin deocamdată
          </SubmitButton>
          <p className="text-xs text-neutral-500">
            Fără revenire, firma reapare singură la „De reluat”, după pragul din Setări.
          </p>
        </form>
      ) : null}

      {panel === "move" ? (
        <form action={postponeStep} className="mt-2 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
          <input type="hidden" name="visit_id" value={visitId} />
          <input
            type="text"
            name="body"
            placeholder="De ce? (opțional, rămâne în istoric)"
            onKeyDown={noEnterSubmit}
            className="input min-h-12"
          />
          <DatePicks today={today} question="Pe ce zi o muți?" />
        </form>
      ) : null}
    </div>
  );
}

/**
 * Datele rapide plus o dată aleasă de mână, în formularul părinte. Butonul
 * trimite ziua în `date`; „Alege” trimite „custom”, iar ziua vine din calendar.
 */
function DatePicks({ today, question }: { today: string; question: string }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{question}</p>
      <div className="grid grid-cols-2 gap-2">
        {quickDates(today).map((q) => (
          <SubmitButton
            key={q.label}
            name="date"
            value={q.date}
            pendingLabel="…"
            className="btn btn-secondary btn-lg flex-col gap-0 py-1.5"
          >
            <span>{q.label}</span>
            <span className="text-xs font-normal text-neutral-500">{shortDay(q.date)}</span>
          </SubmitButton>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input type="date" name="custom" min={today} className="input min-h-12 flex-1" aria-label="Altă dată" />
        <SubmitButton className="btn btn-primary btn-lg" pendingLabel="…" name="date" value="custom">
          Alege
        </SubmitButton>
      </div>
    </div>
  );
}
