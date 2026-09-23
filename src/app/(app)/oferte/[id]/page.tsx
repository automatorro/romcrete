import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addCatalogItemToQuote,
  addCustomItem,
  deleteQuote,
  duplicateQuote,
  setQuoteStatus,
  updateQuote,
} from "@/app/(app)/oferte/actions";
import { QuoteForm } from "@/app/(app)/oferte/quote-form";
import { AddCustomItemForm } from "@/app/(app)/oferte/[id]/add-custom-item-form";
import { QuoteItemsTable } from "@/app/(app)/oferte/[id]/quote-items-table";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeTotals, formatCatalogPrice, formatDate, formatMoney } from "@/lib/totals";
import { QUOTE_STATUS_LABELS, type CatalogItem, type Quote, type QuoteItem, type QuoteStatus } from "@/lib/types";

export const metadata = { title: "Ofertă" };

export default async function QuotePage(props: PageProps<"/oferte/[id]">) {
  const { id } = await props.params;
  const { orgId, organization } = await requireOrg();

  const supabase = await createClient();

  const [{ data: quoteData }, { data: itemsData }, { data: clientsData }, { data: catalogData }] =
    await Promise.all([
      supabase.from("quotes").select("*, visits(id, visit_date)").eq("id", id).maybeSingle(),
      supabase.from("quote_items").select("*").eq("quote_id", id).order("position"),
      supabase.from("clients").select("id, name").eq("org_id", orgId).order("name"),
      supabase
        .from("catalog_items")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("category", { ascending: true, nullsFirst: false })
        .order("name"),
    ]);

  if (!quoteData) notFound();

  const quote = quoteData as Quote & { visits: { id: string; visit_date: string } | null };
  const items = (itemsData ?? []) as QuoteItem[];
  const catalog = (catalogData ?? []) as CatalogItem[];
  const totals = computeTotals(items, quote.discount_pct);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/oferte" className="text-sm text-brand-700 hover:underline">
            ← Toate ofertele
          </Link>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight text-neutral-900">
            {quote.number}
            <StatusBadge status={quote.status} />
          </h1>
          {quote.title ? <p className="mt-1 text-sm text-neutral-500">{quote.title}</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/print/oferta/${quote.id}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
          >
            Vezi PDF
          </Link>
          <form action={duplicateQuote}>
            <input type="hidden" name="quote_id" value={quote.id} />
            <SubmitButton className="btn btn-secondary" pendingLabel="Se copiază…">
              Duplică
            </SubmitButton>
          </form>
        </div>
      </div>

      {quote.visits ? (
        <p className="text-sm text-neutral-500">
          Pornită din vizita de teren de la {formatDate(quote.visits.visit_date)} ·{" "}
          <Link href={`/teren/vizita/${quote.visits.id}`} className="font-medium text-brand-700 hover:underline">
            deschide vizita
          </Link>
        </p>
      ) : null}

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <form action={setQuoteStatus} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="quote_id" value={quote.id} />
          <label className="text-sm font-medium text-neutral-700" htmlFor="status">
            Stare
          </label>
          <select id="status" name="status" defaultValue={quote.status} className="input w-40">
            {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((value) => (
              <option key={value} value={value}>
                {QUOTE_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <SubmitButton className="btn btn-secondary" pendingLabel="Se actualizează…">
            Actualizează
          </SubmitButton>
        </form>
      </div>

      <section className="card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
          <h2 className="text-base font-semibold text-neutral-900">Linii ofertă</h2>
          <p className="text-sm text-neutral-500">
            {items.length} {items.length === 1 ? "linie" : "linii"}
          </p>
        </header>

        <QuoteItemsTable quoteId={quote.id} items={items} currency={quote.currency} />

        <div className="space-y-4 border-t border-neutral-200 p-4">
          {catalog.length > 0 ? (
            <form
              action={addCatalogItemToQuote.bind(null, quote.id)}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="min-w-64 flex-1">
                <label className="label" htmlFor="catalog_item_id">
                  Adaugă din catalog
                </label>
                <select id="catalog_item_id" name="catalog_item_id" required className="input">
                  <option value="">Alege produsul…</option>
                  {catalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {formatCatalogPrice(item.unit_price, item.price_on_request)}
                      {item.price_on_request ? "" : `/${item.unit}`}
                    </option>
                  ))}
                </select>
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
              <SubmitButton pendingLabel="Se adaugă…">Adaugă</SubmitButton>
            </form>
          ) : (
            <p className="text-sm text-neutral-500">
              Catalogul este gol.{" "}
              <Link href="/catalog" className="font-medium text-brand-700 hover:underline">
                Adaugă produse
              </Link>{" "}
              ca să le poți pune pe ofertă cu un click.
            </p>
          )}

          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand-700">
              + Linie liberă (în afara catalogului)
            </summary>
            <div className="mt-4">
              <AddCustomItemForm
                action={addCustomItem.bind(null, quote.id)}
                defaultVatRate={organization.vat_rate}
              />
            </div>
          </details>
        </div>

        <dl className="space-y-2 border-t border-neutral-200 bg-neutral-50 px-4 py-4 text-sm">
          <Row label="Total linii (fără TVA)" value={formatMoney(totals.linesNet, quote.currency)} />
          {totals.quoteDiscount > 0 ? (
            <Row
              label={`Discount ofertă (${quote.discount_pct}%)`}
              value={`− ${formatMoney(totals.quoteDiscount, quote.currency)}`}
            />
          ) : null}
          <Row label="Bază de impozitare" value={formatMoney(totals.net, quote.currency)} />
          <Row label="TVA" value={formatMoney(totals.vat, quote.currency)} />
          <Row label="Total de plată" value={formatMoney(totals.gross, quote.currency)} strong />
        </dl>
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">Detaliile ofertei</h2>
        <QuoteForm
          action={updateQuote.bind(null, quote.id)}
          clients={clientsData ?? []}
          quote={quote}
        />
      </section>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-neutral-500">
          Ștergerea ofertei elimină și liniile ei. Numărul folosit nu se refolosește.
        </p>
        <form action={deleteQuote}>
          <input type="hidden" name="quote_id" value={quote.id} />
          <SubmitButton
            className="btn btn-danger"
            pendingLabel="Se șterge…"
            confirm={`Ștergi oferta ${quote.number}?`}
          >
            Șterge oferta
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? "font-semibold text-neutral-900" : "text-neutral-500"}>{label}</dt>
      <dd
        className={`tabular-nums ${
          strong ? "text-base font-semibold text-neutral-900" : "text-neutral-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
