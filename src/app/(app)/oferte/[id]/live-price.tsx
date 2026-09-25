"use client";

import { startTransition, useEffect, useState } from "react";

import { formatMoney, lineFinal, type LineLike } from "@/lib/totals";

/** Câmpurile din care se calculează prețul; la schimbarea lor linia se salvează. */
const PRICE_FIELDS = ["quantity", "unit_price", "discount_pct", "vat_rate"] as const;
type PriceField = (typeof PRICE_FIELDS)[number];

const isPriceField = (name: string): name is PriceField => (PRICE_FIELDS as readonly string[]).includes(name);

/**
 * Prețul final al produsului, recalculat pe loc cât agentul scrie în câmpurile
 * liniei (cantitate, preț fără TVA, discount, TVA). Când iese din câmp, linia
 * se salvează singură, ca totalul ofertei și PDF-ul să aibă același preț.
 * Cu TVA, mare; fără TVA și TVA-ul, dedesubt. Ca pe PDF.
 */
export function LivePrice({
  formId,
  line,
  currency,
  quoteDiscountPct,
  save,
}: {
  formId: string;
  /** Salvarea liniei; se cheamă direct, nu prin trimiterea formularului, ca să nu-l golească în timp ce agentul scrie mai departe. */
  save: (formData: FormData) => Promise<void>;
  line: LineLike;
  currency: string;
  quoteDiscountPct: number;
}) {
  const [draft, setDraft] = useState<Partial<Record<PriceField, string>>>({});

  useEffect(() => {
    const ofThisLine = (e: Event) => {
      const el = e.target;
      return el instanceof HTMLInputElement && el.form?.id === formId && isPriceField(el.name) ? el : null;
    };
    const onInput = (e: Event) => {
      const el = ofThisLine(e);
      if (el) setDraft((d) => ({ ...d, [el.name]: el.value }));
    };
    // „change” vine când agentul iese din câmp: atunci se salvează, dacă valoarea e validă.
    const onChange = (e: Event) => {
      const el = ofThisLine(e);
      if (!el?.form || !el.form.checkValidity()) return;
      const data = new FormData(el.form);
      startTransition(() => save(data));
    };
    document.addEventListener("input", onInput);
    document.addEventListener("change", onChange);
    return () => {
      document.removeEventListener("input", onInput);
      document.removeEventListener("change", onChange);
    };
  }, [formId, save]);

  const current: LineLike = { ...line };
  for (const [key, value] of Object.entries(draft) as [PriceField, string][]) {
    // Un câmp golit în timp ce scrii nu dă un preț: până e completat, rămâne valoarea salvată.
    if (value.trim() !== "" && Number.isFinite(Number(value))) current[key] = Number(value);
  }
  const unsaved = PRICE_FIELDS.some((k) => Number(current[k]) !== Number(line[k]));
  const p = lineFinal(current, quoteDiscountPct);

  return (
    <span className="inline-block tabular-nums" aria-live="polite">
      <b className="block whitespace-nowrap">{formatMoney(p.gross, currency)}</b>
      <span className="block text-xs whitespace-nowrap text-neutral-500">
        {formatMoney(p.net, currency)} + TVA {formatMoney(p.vat, currency)}
      </span>
      {p.quoteDiscount > 0 ? (
        <span className="block text-xs text-neutral-500">cu discountul ofertei de {quoteDiscountPct}%</span>
      ) : null}
      {unsaved ? <span className="block text-xs font-medium text-brand-700">nesalvat încă</span> : null}
    </span>
  );
}
