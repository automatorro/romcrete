"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { DataList } from "@/components/ui/data-list";
import { formatSku, matchesWords, queryWords, searchIndex } from "@/lib/cautare-catalog";
import { formatCatalogPrice } from "@/lib/totals";
import type { CatalogItem } from "@/lib/types";

export type BrowserItem = Pick<
  CatalogItem,
  | "id" | "sku" | "name" | "description" | "category" | "unit" | "unit_price" | "vat_rate"
  | "is_active" | "price_on_request" | "tech_type" | "materials"
> & { has_photo: boolean };

type Stare = "active" | "inactive" | "toate" | "fara-poza";

/** Câte rânduri se desenează deodată: sute de coduri încetinesc pagina fără folos. */
const STEP = 200;

/**
 * Catalogul, cu căutare. Caută pe loc, în timp ce scrii, după nume, cod,
 * categorie, tehnologie, descriere și materiale, fără diacritice. Căutarea
 * rămâne în adresa paginii, ca „înapoi” de pe un produs să nu o piardă.
 */
export function CatalogBrowser({ items, initialQuery }: { items: BrowserItem[]; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("");
  const [tech, setTech] = useState("");
  const [stare, setStare] = useState<Stare>("toate");
  const [shown, setShown] = useState(STEP);

  const indexed = useMemo(() => items.map((item) => ({ item, index: searchIndex(item) })), [items]);
  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter((c): c is string => Boolean(c)))].sort((a, b) => a.localeCompare(b, "ro")),
    [items],
  );
  const techs = useMemo(
    () => [...new Set(items.map((i) => i.tech_type).filter((t): t is string => Boolean(t)))].sort(),
    [items],
  );

  const words = queryWords(query);
  const matches = indexed
    .filter(({ item, index }) => {
      if (stare === "active" && !item.is_active) return false;
      if (stare === "inactive" && item.is_active) return false;
      if (stare === "fara-poza" && item.has_photo) return false;
      if (category && item.category !== category) return false;
      if (tech && item.tech_type !== tech) return false;
      return !words.length || matchesWords(index, words);
    })
    .map(({ item }) => item);

  const onQuery = (value: string) => {
    setQuery(value);
    setShown(STEP);
    try {
      const url = new URL(window.location.href);
      if (value.trim()) url.searchParams.set("q", value);
      else url.searchParams.delete("q");
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // adresa rămâne cum era
    }
  };

  const filtered = Boolean(words.length || category || tech || stare !== "toate");

  return (
    <div className="space-y-3">
      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <label className="label" htmlFor="catalog_q">
            Caută în catalog
          </label>
          <input
            id="catalog_q"
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Nume, cod, categorie, material… ex: apx 6200, duza 517, glet"
            autoComplete="off"
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="catalog_cat">
            Categorie
          </label>
          <select id="catalog_cat" value={category} onChange={(e) => (setCategory(e.target.value), setShown(STEP))} className="input">
            <option value="">Toate categoriile</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="catalog_tech">
            Tehnologie
          </label>
          <select id="catalog_tech" value={tech} onChange={(e) => (setTech(e.target.value), setShown(STEP))} className="input">
            <option value="">Toate</option>
            {techs.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="catalog_stare">
            Arată
          </label>
          <select id="catalog_stare" value={stare} onChange={(e) => (setStare(e.target.value as Stare), setShown(STEP))} className="input">
            <option value="toate">Toate</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="fara-poza">Fără poză</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-neutral-500">
        {filtered ? `${matches.length} din ${items.length} poziții` : `${items.length} poziții`}
        {filtered ? (
          <button
            type="button"
            className="ml-3 font-medium text-brand-700 hover:underline"
            onClick={() => {
              onQuery("");
              setCategory("");
              setTech("");
              setStare("toate");
            }}
          >
            Șterge filtrele
          </button>
        ) : null}
      </p>

      {matches.length === 0 ? (
        <p className="card p-6 text-center text-sm text-neutral-500">
          Nimic pentru {query.trim() ? `„${query.trim()}”` : "filtrele alese"}.
        </p>
      ) : (
        <DataList
          rows={matches.slice(0, shown)}
          rowKey={(i) => i.id}
          muted={(i) => !i.is_active}
          title={(i) => (
            <Link href={`/catalog/${i.id}`} className="hover:underline">
              {i.name}
              {i.is_active ? null : <span className="ml-2 text-xs font-normal text-neutral-500">(inactiv)</span>}
            </Link>
          )}
          columns={[
            {
              header: "Denumire",
              hideOnMobile: true,
              cell: (i) => (
                <>
                  <span className="font-medium">{i.name}</span>
                  {i.is_active ? null : <span className="ml-2 text-xs text-neutral-500">(inactiv)</span>}
                  {i.has_photo ? null : <span className="ml-2 text-xs text-amber-700">fără poză</span>}
                </>
              ),
            },
            {
              header: "Cod",
              className: "whitespace-nowrap",
              cell: (i) => <span className={i.sku ? "tabular-nums" : "text-neutral-500 italic"}>{formatSku(i.sku)}</span>,
            },
            { header: "Categorie", className: "text-neutral-500", cell: (i) => i.category ?? "—" },
            { header: "UM", className: "text-neutral-500", cell: (i) => i.unit },
            {
              header: "Preț fără TVA",
              className: "text-right tabular-nums",
              cell: (i) => formatCatalogPrice(i.unit_price, i.price_on_request),
            },
            { header: "TVA", className: "text-right tabular-nums text-neutral-500", cell: (i) => `${i.vat_rate}%` },
          ]}
          actions={(i) => (
            <Link href={`/catalog/${i.id}`} className="btn btn-secondary btn-sm">
              Editează
            </Link>
          )}
        />
      )}

      {matches.length > shown ? (
        <div className="text-center">
          <button type="button" className="btn btn-secondary" onClick={() => setShown((n) => n + STEP)}>
            Arată încă {Math.min(STEP, matches.length - shown)} (din {matches.length - shown} rămase)
          </button>
        </div>
      ) : null}
    </div>
  );
}
