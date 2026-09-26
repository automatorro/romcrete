"use client";

import { useActionState, useRef, useState } from "react";

import { readShopTexts } from "@/app/(app)/catalog/actions";

import { FormMessage } from "@/components/form-message";
import { SheetFields } from "@/components/oferta/sheet-fields";
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
  const form = useRef<HTMLFormElement>(null);
  const [shopState, setShopState] = useState<{ busy: boolean; message: string }>({ busy: false, message: "" });

  // Completează din magazin doar câmpurile goale; ce e scris rămâne. Se salvează cu „Salvează”.
  const fillFromShop = async () => {
    const el = form.current;
    if (!el) return;
    const url = (el.elements.namedItem("shop_url") as HTMLInputElement | null)?.value.trim() ?? "";
    setShopState({ busy: true, message: "" });
    const res = await readShopTexts(url);
    if ("error" in res) {
      setShopState({ busy: false, message: res.error });
      return;
    }
    let filled = 0;
    for (const [name, value] of Object.entries(res)) {
      const field = el.elements.namedItem(name) as HTMLTextAreaElement | null;
      if (field && value && !field.value.trim()) {
        field.value = value;
        filled++;
      }
    }
    setShopState({
      busy: false,
      message: filled
        ? `Am completat ${filled} ${filled === 1 ? "câmp" : "câmpuri"} din magazin. Verifică textele, apoi apasă „${submitLabel}”.`
        : "Magazinul nu are texte noi pentru câmpurile goale.",
    });
  };
  const formKey = resetOnSuccess && state?.success ? state.success : "form";

  return (
    <form ref={form} key={formKey} action={formAction} className="space-y-4">
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

        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label" htmlFor="shop_url">
            Pagina din magazin
          </label>
          <input
            id="shop_url"
            name="shop_url"
            type="url"
            defaultValue={item?.shop_url ?? ""}
            placeholder="https://shop.romcrete.ro/catalog/…"
            className="input"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label" htmlFor="image_url">
            Poză pe ofertă
          </label>
          <input
            id="image_url"
            name="image_url"
            type="url"
            defaultValue={item?.image_url ?? ""}
            placeholder="Goală: se ia poza principală de pe pagina din magazin"
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

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            name="is_service"
            defaultChecked={item?.is_service ?? false}
            className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
          />
          Serviciu (transport, instruire…): apare pe ofertă fără poză
        </label>
      </div>

      {/* Textele scrise aici intră în fiecare ofertă nouă; pe ofertă se pot schimba doar pentru clientul ei. */}
      <details className="rounded-lg border border-neutral-200 p-4" open={Boolean(item?.intro || item?.benefits)}>
        <summary className="cursor-pointer text-sm font-semibold">Fișa produsului pe ofertă</summary>
        <p className="mt-1 text-xs text-neutral-500">
          Intră singură în fiecare ofertă nouă cu acest produs. Ce lipsește se ia din descrierea din magazin la
          prima ofertă. Pe ofertă se poate schimba doar pentru clientul acela.
        </p>
        <div className="mt-3 space-y-2">
          <button type="button" onClick={fillFromShop} disabled={shopState.busy} className="btn btn-secondary min-h-11">
            {shopState.busy ? "Se citește magazinul…" : "Preia textele din magazin"}
          </button>
          {shopState.message ? (
            <p role="status" className="text-sm text-neutral-700">
              {shopState.message}
            </p>
          ) : null}
        </div>
        <div className="mt-3">
          <SheetFields values={item} />
        </div>
      </details>

      <FormMessage state={state} />

      <SubmitButton className="btn btn-ok">{submitLabel}</SubmitButton>
    </form>
  );
}
