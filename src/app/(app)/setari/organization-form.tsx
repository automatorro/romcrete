"use client";

import { useActionState } from "react";

import { updateOrganization } from "@/app/(app)/setari/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { Organization } from "@/lib/types";

const FIELDS: { name: keyof Organization; label: string; placeholder?: string; wide?: boolean }[] = [
  { name: "name", label: "Denumirea firmei *", wide: true },
  { name: "cui", label: "CUI", placeholder: "RO12345678" },
  { name: "reg_com", label: "Nr. Reg. Com.", placeholder: "J12/345/2020" },
  { name: "address", label: "Adresă", wide: true },
  { name: "city", label: "Localitate" },
  { name: "county", label: "Județ" },
  { name: "phone", label: "Telefon" },
  { name: "email", label: "Email" },
  { name: "iban", label: "IBAN" },
  { name: "bank", label: "Bancă" },
];

export function OrganizationForm({ organization }: { organization: Organization }) {
  const [state, formAction] = useActionState(updateOrganization, null);

  return (
    <form action={formAction} className="space-y-4">
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
              defaultValue={(organization[field.name] as string | null) ?? ""}
              className="input"
            />
          </div>
        ))}

        <div>
          <label className="label" htmlFor="vat_rate">
            Cotă TVA implicită (%)
          </label>
          <input
            id="vat_rate"
            name="vat_rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={organization.vat_rate}
            className="input"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="quote_terms">
            Condiții comerciale implicite
          </label>
          <textarea
            id="quote_terms"
            name="quote_terms"
            rows={3}
            defaultValue={organization.quote_terms ?? ""}
            placeholder="Plata în 15 zile de la livrare. Prețurile nu includ transportul."
            className="input"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Se completează automat pe fiecare ofertă nouă.
          </p>
        </div>
      </div>

      <FormMessage state={state} />

      <SubmitButton>Salvează datele firmei</SubmitButton>
    </form>
  );
}
