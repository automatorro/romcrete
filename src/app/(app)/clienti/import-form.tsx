"use client";

import { useActionState, useState } from "react";

import type { ImportState } from "@/app/(app)/clienti/actions";
import { SubmitButton } from "@/components/submit-button";

// Limita pentru Server Actions din next.config.ts; mesajul clar vine înainte de trimitere.
const MAX_BYTES = 2 * 1024 * 1024;

type Props = {
  action: (prev: ImportState, formData: FormData) => Promise<ImportState>;
};

function Details({ title, lines }: { title: string; lines?: string[] }) {
  if (!lines?.length) return null;
  return (
    <details className="text-sm text-neutral-600">
      <summary className="cursor-pointer">
        {title} ({lines.length})
      </summary>
      <ul className="mt-1 max-h-48 list-disc overflow-y-auto pl-5">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

export function ImportForm({ action }: Props) {
  const [state, formAction] = useActionState(action, null);
  const [tooBig, setTooBig] = useState(false);
  const formKey = state?.success ?? "form";

  return (
    <form key={formKey} action={formAction} className="space-y-4">
      <p className="text-sm text-neutral-600">
        Primul rând al tabelului trebuie să aibă capetele de coloană: <strong>Denumire</strong>{" "}
        (obligatoriu), CUI, Nr. Reg. Com., Persoană de contact, Telefon, Email, Adresă, Localitate,
        Județ, Observații. Ordinea nu contează, iar coloanele în plus se ignoră. Clienții care există
        deja (același CUI sau, fără CUI, aceeași denumire) nu se dublează.{" "}
        <a href="/clienti/model-import" download className="text-brand-700 hover:underline">
          Descarcă fișierul model
        </a>
        .
      </p>

      <div>
        <label className="label" htmlFor="import-file">
          Fișier Excel (.xlsx) sau CSV
        </label>
        <input
          id="import-file"
          name="file"
          type="file"
          required
          accept=".xlsx,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="input"
          onChange={(e) => setTooBig((e.target.files?.[0]?.size ?? 0) > MAX_BYTES)}
        />
      </div>

      {tooBig ? (
        <p role="alert" className="notice-error">
          Fișierul are peste 2 MB. Șterge coloanele și foile de care nu e nevoie sau împarte-l în mai
          multe fișiere.
        </p>
      ) : null}

      {state?.error || state?.success ? (
        <p role={state.error ? "alert" : "status"} className={state.error ? "notice-error" : "notice-ok"}>
          {state.error ?? state.success}
        </p>
      ) : null}
      <Details title="Rânduri cu probleme" lines={state?.problems} />
      <Details title="Clienți care existau deja" lines={state?.skipped} />

      {tooBig ? null : (
        <SubmitButton className="btn btn-ok" pendingLabel="Se importă…">
          Importă clienții
        </SubmitButton>
      )}
    </form>
  );
}
