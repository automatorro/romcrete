"use client";

import Link from "next/link";
import { useState } from "react";

import { deleteActivity, logActivity } from "@/app/teren/actions";
import { SubmitButton } from "@/components/submit-button";
import { shortDay } from "@/lib/agenda";
import { HISTORY_LABELS, MANUAL_KINDS, type HistoryItem, type HistoryKind } from "@/lib/istoric";

type Filter = "toate" | "vizite" | "telefoane" | "emailuri" | "oferte" | "note";

const FILTERS: { id: Filter; label: string; kinds: HistoryKind[] }[] = [
  { id: "toate", label: "Toate", kinds: [] },
  { id: "vizite", label: "Vizite", kinds: ["vizita", "intalnire"] },
  { id: "telefoane", label: "Telefoane", kinds: ["telefon"] },
  { id: "emailuri", label: "Emailuri", kinds: ["email"] },
  { id: "oferte", label: "Oferte", kinds: ["oferta_creata", "oferta_stare"] },
  { id: "note", label: "Note și pași", kinds: ["nota", "pas_amanat", "pas_inchis"] },
];

/**
 * Istoricul unei firme: tot ce s-a întâmplat cu ea, cel mai nou sus, plus
 * formularul prin care se notează un telefon, un email sau o discuție.
 */
export function ClientHistory({
  clientId,
  items,
  today,
}: {
  clientId: string;
  items: HistoryItem[];
  today: string;
}) {
  const [filter, setFilter] = useState<Filter>("toate");
  const kinds = FILTERS.find((f) => f.id === filter)?.kinds ?? [];
  const shown = kinds.length ? items.filter((i) => kinds.includes(i.kind)) : items;
  const count = (f: (typeof FILTERS)[number]) =>
    f.kinds.length ? items.filter((i) => f.kinds.includes(i.kind)).length : items.length;

  return (
    <section>
      <details className="sec">
        <summary>
          <span className="text-brand-700">＋ Notează telefon, email sau discuție</span>
        </summary>
        <form action={logActivity} className="space-y-3 pt-3 pb-3.5">
          <input type="hidden" name="client_id" value={clientId} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MANUAL_KINDS.map((k, i) => (
              <label
                key={k.id}
                className="chip justify-center rounded-xl has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:text-white"
              >
                <input type="radio" name="kind" value={k.id} defaultChecked={i === 0} className="sr-only" />
                {k.label}
              </label>
            ))}
          </div>
          <textarea
            name="body"
            rows={3}
            required
            placeholder="Ce s-a discutat, ce a cerut, ce i-ai trimis"
            className="input"
          />
          <div className="flex items-center gap-2">
            <label htmlFor={`zi-${clientId}`} className="text-sm text-neutral-500">
              Ziua
            </label>
            <input
              id={`zi-${clientId}`}
              type="date"
              name="date"
              defaultValue={today}
              max={today}
              className="input min-h-12 flex-1"
            />
          </div>
          <SubmitButton className="btn btn-ok btn-lg w-full" pendingLabel="Se salvează…">
            Salvează în istoric
          </SubmitButton>
        </form>
      </details>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrează istoricul">
        {FILTERS.map((f) => {
          const n = count(f);
          if (f.id !== "toate" && n === 0) return null;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`chip chip-s ${filter === f.id ? "chip-on" : ""}`}
            >
              {f.label} · {n}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="card mt-3 p-3 text-sm text-neutral-500">
          {items.length ? "Nimic de acest fel încă." : "Încă nimic în istoric."}
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {shown.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="card p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    item.kind === "vizita"
                      ? "border-brand-600 bg-brand-600 text-white"
                      : item.kind.startsWith("oferta")
                        ? "border-brand-200 bg-brand-50 text-brand-700"
                        : "border-neutral-200 bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {HISTORY_LABELS[item.kind]}
                </span>
                <b>{shortDay(item.date)}</b>
                {item.agent ? <span className="text-neutral-500">· {item.agent}</span> : null}
                <span className="flex-1" />
                {item.href ? (
                  <Link href={item.href} className="text-xs font-medium text-brand-700 hover:underline">
                    deschide →
                  </Link>
                ) : null}
              </div>
              {item.kind !== "vizita" && !MANUAL_KINDS.some((k) => k.id === item.kind) ? (
                <p className="mt-1 text-sm font-medium">{item.title}</p>
              ) : null}
              {item.lines.map((line, i) => (
                <p key={i} className={`mt-1 text-sm ${i === 0 && item.kind !== "vizita" ? "" : "text-neutral-700"}`}>
                  {line}
                </p>
              ))}
              {item.deletable ? (
                <form action={deleteActivity} className="mt-2 text-right">
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <SubmitButton
                    className="btn btn-danger-ghost btn-sm min-h-10"
                    pendingLabel="Se șterge…"
                    confirmLabel="Da, șterge"
                    confirm="Ștergi nota din istoric?"
                  >
                    Șterge
                  </SubmitButton>
                </form>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
