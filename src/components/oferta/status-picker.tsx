"use client";

import { useState } from "react";

import { setQuoteStatus } from "@/app/(app)/oferte/actions";
import { SubmitButton } from "@/components/submit-button";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/types";

/**
 * Starea ofertei dintr-o singură apăsare: fiecare stare e un buton, cea curentă
 * e plină. Înlocuiește lista derulantă cu „Actualizează”.
 */
export function StatusPicker({ quoteId, status }: { quoteId: string; status: QuoteStatus }) {
  const [notice, setNotice] = useState("");

  return (
    <form
      action={async (formData) => {
        const result = await setQuoteStatus(formData);
        setNotice(result.ok ? "" : result.error);
      }}
    >
      <input type="hidden" name="quote_id" value={quoteId} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-neutral-700">Starea ofertei</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((s) => (
            <SubmitButton
              key={s}
              name="status"
              value={s}
              pendingLabel="…"
              className={`chip ${s === status ? "chip-on" : ""}`}
            >
              {QUOTE_STATUS_LABELS[s]}
            </SubmitButton>
          ))}
        </div>
      </fieldset>
      {notice ? <p role="alert" className="mt-2 text-sm text-red-700">{notice}</p> : null}
    </form>
  );
}
