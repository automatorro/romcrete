"use client";

import { useActionState, useEffect, useRef } from "react";

import { addDecision } from "@/app/(app)/rapoarte/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

/** O decizie nouă: ce, cine, până când. Formularul se golește după salvare. */
export function AddDecisionForm({ reportId }: { reportId: string }) {
  const [state, formAction] = useActionState(addDecision.bind(null, reportId), null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && "success" in state && state.success) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={formAction} className="space-y-2">
      <label htmlFor={`dec-text-${reportId}`} className="mb-1 block text-sm font-medium">
        Decizie nouă
      </label>
      <textarea
        id={`dec-text-${reportId}`}
        name="text"
        rows={2}
        required
        placeholder="Ce s-a hotărât: „Căutăm un partener de leasing”, „Demonstrație la Construct Est”."
        className="input text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`dec-owner-${reportId}`} className="mb-1 block text-xs text-neutral-600">
            Cine se ocupă
          </label>
          <input id={`dec-owner-${reportId}`} name="owner" placeholder="Lucian, conducerea…" className="input text-sm" />
        </div>
        <div>
          <label htmlFor={`dec-due-${reportId}`} className="mb-1 block text-xs text-neutral-600">
            Termen
          </label>
          <input id={`dec-due-${reportId}`} name="due_date" type="date" className="input text-sm" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-secondary" pendingLabel="Se notează…">
        Notează decizia
      </SubmitButton>
    </form>
  );
}
