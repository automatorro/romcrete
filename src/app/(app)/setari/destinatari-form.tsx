"use client";

import { useActionState } from "react";

import { updateReportRecipients } from "@/app/(app)/setari/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

/** Destinatarii impliciți ai rapoartelor; fiecare raport îi poate schimba separat. */
export function DestinatariForm({ recipients }: { recipients: string[] }) {
  const [state, formAction] = useActionState(updateReportRecipients, null);
  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="report-recipients" className="label">
        Adrese de email
      </label>
      <textarea
        id="report-recipients"
        name="recipients"
        rows={2}
        defaultValue={recipients.join(", ")}
        placeholder="director@firma.ro, vanzari@firma.ro"
        className="input"
      />
      <FormMessage state={state} />
      <SubmitButton className="btn btn-ok">Salvează destinatarii</SubmitButton>
    </form>
  );
}
