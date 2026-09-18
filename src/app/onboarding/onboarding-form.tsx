"use client";

import { useActionState } from "react";

import { createOrganization } from "@/app/onboarding/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function OnboardingForm() {
  const [state, formAction] = useActionState(createOrganization, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">
            Denumirea firmei *
          </label>
          <input id="name" name="name" required className="input" placeholder="Romcrete SRL" />
        </div>

        <div>
          <label className="label" htmlFor="cui">
            CUI
          </label>
          <input id="cui" name="cui" className="input" placeholder="RO12345678" />
        </div>

        <div>
          <label className="label" htmlFor="reg_com">
            Nr. Reg. Com.
          </label>
          <input id="reg_com" name="reg_com" className="input" placeholder="J12/345/2020" />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="address">
            Adresă
          </label>
          <input id="address" name="address" className="input" placeholder="Str. Betonului nr. 10" />
        </div>

        <div>
          <label className="label" htmlFor="city">
            Localitate
          </label>
          <input id="city" name="city" className="input" />
        </div>

        <div>
          <label className="label" htmlFor="county">
            Județ
          </label>
          <input id="county" name="county" className="input" />
        </div>

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
            defaultValue={21}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="full_name">
            Numele tău
          </label>
          <input id="full_name" name="full_name" className="input" placeholder="Ion Popescu" />
        </div>
      </div>

      <FormMessage state={state} />

      <SubmitButton pendingLabel="Se configurează…">Continuă</SubmitButton>
    </form>
  );
}
