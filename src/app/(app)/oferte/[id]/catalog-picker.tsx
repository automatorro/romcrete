"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { formatCatalogPrice } from "@/lib/totals";
import type { CatalogItem } from "@/lib/types";

export type PickerItem = Pick<
  CatalogItem,
  "id" | "name" | "sku" | "category" | "unit" | "unit_price" | "price_on_request"
>;

type Props = {
  items: PickerItem[];
  action: (formData: FormData) => void | Promise<void>;
};

/** Fără diacritice și majuscule, ca „pompa glet” să găsească „Pompă de glet”. */
const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Căutarea în catalog pentru ofertă. Lista are sute de poziții, prea multe
 * pentru un select: se tastează câteva litere din nume, cod sau categorie,
 * iar fiecare rezultat are butonul lui de adăugare.
 */
export function CatalogPicker({ items, action }: Props) {
  const [query, setQuery] = useState("");

  const indexed = useMemo(
    () => items.map((item) => ({ item, text: normalize(`${item.name} ${item.sku ?? ""} ${item.category ?? ""}`) })),
    [items],
  );

  const words = normalize(query).split(/\s+/).filter(Boolean);
  const matches = words.length
    ? indexed.filter(({ text }) => words.every((w) => text.includes(w))).map(({ item }) => item)
    : items;

  return (
    <form action={action} className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="catalog_search">
            Adaugă din catalog
          </label>
          <input
            id="catalog_search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter în căutare nu trimite formularul: n-ar ști ce produs să adauge.
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Caută după nume, cod sau categorie…"
            autoComplete="off"
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="quantity">
            Cantitate
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            step="0.001"
            min="0"
            defaultValue={1}
            className="input w-28 text-right tabular-nums"
          />
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        {words.length
          ? `${matches.length} ${matches.length === 1 ? "produs găsit" : "produse găsite"}`
          : `${items.length} produse în catalog`}
      </p>

      <ul className="max-h-80 divide-y divide-neutral-200 overflow-y-auto rounded-lg border border-neutral-200">
        {matches.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-50">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">{item.name}</p>
              <p className="truncate text-xs text-neutral-500">
                {[item.sku, item.category].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="shrink-0 text-sm whitespace-nowrap text-neutral-700 tabular-nums">
              {formatCatalogPrice(item.unit_price, item.price_on_request)}
              {item.price_on_request ? "" : `/${item.unit}`}
            </span>
            <AddButton id={item.id} />
          </li>
        ))}
        {matches.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-neutral-500">
            Niciun produs pentru „{query}”.
          </li>
        ) : null}
      </ul>
    </form>
  );
}

function AddButton({ id }: { id: string }) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("catalog_item_id") === id;
  return (
    <button
      type="submit"
      name="catalog_item_id"
      value={id}
      disabled={pending}
      className="btn btn-secondary min-h-10 shrink-0 px-3 text-sm"
    >
      {mine ? "Se adaugă…" : "Adaugă"}
    </button>
  );
}
