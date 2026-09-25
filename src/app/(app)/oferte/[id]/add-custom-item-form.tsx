"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { UNITS } from "@/lib/types";
import type { ActionState } from "@/lib/validation";

export function AddCustomItemForm({
  action,
  defaultVatRate,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaultVatRate: number;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form key={state?.success ?? "form"} action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="custom-name">
            Denumire *
          </label>
          <input id="custom-name" name="name" required className="input" />
        </div>

        <div>
          <label className="label" htmlFor="custom-unit">
            UM
          </label>
          <select id="custom-unit" name="unit" defaultValue="mc" className="input">
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="custom-quantity">
            Cantitate
          </label>
          <input
            id="custom-quantity"
            name="quantity"
            type="number"
            step="0.001"
            min="0"
            defaultValue={1}
            className="input text-right tabular-nums"
          />
        </div>

        <div>
          <label className="label" htmlFor="custom-price">
            Preț unitar
          </label>
          <input
            id="custom-price"
            name="unit_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={0}
            className="input text-right tabular-nums"
          />
        </div>

        <div>
          <label className="label" htmlFor="custom-vat">
            TVA %
          </label>
          <input
            id="custom-vat"
            name="vat_rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={defaultVatRate}
            className="input text-right tabular-nums"
          />
        </div>

        <div>
          <label className="label" htmlFor="custom-discount">
            Discount %
          </label>
          <input
            id="custom-discount"
            name="discount_pct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={0}
            className="input text-right tabular-nums"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-5">
          <label className="label" htmlFor="custom-description">
            Descriere
          </label>
          <input id="custom-description" name="description" className="input" />
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700 sm:col-span-2 lg:col-span-5">
          <input type="checkbox" name="is_service" className="h-5 w-5 accent-[var(--color-brand-600)]" />
          Serviciu (transport, instruire, punere în funcțiune): apare pe ofertă fără poză
        </label>
      </div>

      <FormMessage state={state} />

      <SubmitButton className="btn btn-secondary">Adaugă linia</SubmitButton>
    </form>
  );
}
