"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { Client } from "@/lib/types";
import type { ActionState } from "@/lib/validation";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  client?: Client;
  submitLabel?: string;
  /** Golește formularul după o adăugare reușită. */
  resetOnSuccess?: boolean;
};

const FIELDS: { name: keyof Client; label: string; placeholder?: string; wide?: boolean }[] = [
  { name: "name", label: "Denumire *", placeholder: "Constructii Alfa SRL", wide: true },
  { name: "cui", label: "CUI", placeholder: "RO12345678" },
  { name: "reg_com", label: "Nr. Reg. Com.", placeholder: "J12/345/2020" },
  { name: "contact_person", label: "Persoană de contact" },
  { name: "phone", label: "Telefon" },
  { name: "email", label: "Email" },
  { name: "address", label: "Adresă" },
  { name: "city", label: "Localitate" },
  { name: "county", label: "Județ" },
];

export function ClientForm({ action, client, submitLabel = "Salvează", resetOnSuccess }: Props) {
  const [state, formAction] = useActionState(action, null);
  const formKey = resetOnSuccess && state?.success ? state.success : "form";

  return (
    <form key={formKey} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
            <label className="label" htmlFor={field.name}>
              {field.label}
            </label>
            <input
              id={field.name}
              name={field.name}
              required={field.name === "name"}
              placeholder={field.placeholder}
              defaultValue={(client?.[field.name] as string | null) ?? ""}
              className="input"
            />
          </div>
        ))}

        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">
            Observații
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={client?.notes ?? ""}
            className="input"
          />
        </div>
      </div>

      <FormMessage state={state} />

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
