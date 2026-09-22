"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { UNITS, type CatalogItem } from "@/lib/types";
import type { ActionState } from "@/lib/validation";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  item?: CatalogItem;
  defaultVatRate?: number;
  submitLabel?: string;
  resetOnSuccess?: boolean;
};

export function CatalogForm({
  action,
  item,
  defaultVatRate = 21,
  submitLabel = "Salvează",
  resetOnSuccess,
}: Props) {
  const [state, formAction] = useActionState(action, null);
  const formKey = resetOnSuccess && state?.success ? state.success : "form";

  return (
    <form key={formKey} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="name">
            Denumire *
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={item?.name ?? ""}
            placeholder="Beton C20/25"
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="sku">
            Cod (SKU)
          </label>
          <input id="sku" name="sku" defaultValue={item?.sku ?? ""} className="input" />
        </div>

        <div>
          <label className="label" htmlFor="category">
            Categorie
          </label>
          <input
            id="category"
            name="category"
            defaultValue={item?.category ?? ""}
            placeholder="Beton"
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="unit">
            Unitate de măsură *
          </label>
          <select id="unit" name="unit" defaultValue={item?.unit ?? "mc"} className="input">
            {UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="unit_price">
            Preț unitar fără TVA *
          </label>
          <input
            id="unit_price"
            name="unit_price"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={item?.unit_price ?? 0}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="vat_rate">
            Cotă TVA (%)
          </label>
          <input
            id="vat_rate"
            name="vat_rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={item?.vat_rate ?? defaultVatRate}
            className="input"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label" htmlFor="description">
            Descriere
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            defaultValue={item?.description ?? ""}
            className="input"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={item?.is_active ?? true}
            className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          Activ (apare la adăugarea pe ofertă)
        </label>
      </div>

      <FormMessage state={state} />

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
