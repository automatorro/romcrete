import Link from "next/link";
import { notFound } from "next/navigation";

import { addCatalogItemToQuote, addCustomItem, duplicateQuote, setShowTotal, updateQuote } from "@/app/(app)/oferte/actions";
import { QuoteForm } from "@/app/(app)/oferte/quote-form";
import { AddCustomItemForm } from "@/app/(app)/oferte/[id]/add-custom-item-form";
import { CatalogPicker } from "@/app/(app)/oferte/[id]/catalog-picker";
import { QuoteItemsTable } from "@/app/(app)/oferte/[id]/quote-items-table";
import { ArchiveControls } from "@/components/oferta/archive-controls";
import { SendByEmail } from "@/components/oferta/send-by-email";
import { SendByWhatsApp } from "@/components/oferta/send-by-whatsapp";
import { StatusPicker } from "@/components/oferta/status-picker";
import { TotalSummary } from "@/components/oferta/total-summary";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { ActionMenu } from "@/components/ui/action-menu";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";
import { getEurRate } from "@/lib/oferta-print";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/totals";
import type { CatalogItem, Quote, QuoteItem } from "@/lib/types";

type Zona = "teren" | "birou";

/**
 * Oferta, cu tot ce se face pe ea: trimitere, stare, linii, detalii, arhivare.
 * Aceeași pagină la birou și pe teren; diferă doar unde duc linkurile.
 */
export async function QuoteWorkspace({ id, zona }: { id: string; zona: Zona }) {
  const { orgId, organization, role } = await requireOrg();
  const supabase = await createClient();

  const [{ data: quoteData }, { data: itemsData }, { data: clientsData }, { data: catalogData }, eur] =
    await Promise.all([
      supabase
        .from("quotes")
        .select("*, visits(id, visit_date), clients(id, name, email)")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("quote_items").select("*").eq("quote_id", id).order("position"),
      supabase.from("clients").select("id, name").eq("org_id", orgId).order("name"),
      supabase
        .from("catalog_items")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .order("category", { ascending: true, nullsFirst: false })
        .order("name"),
      getEurRate(),
    ]);

  if (!quoteData) notFound();

  const quote = quoteData as Quote & {
    visits: { id: string; visit_date: string } | null;
    clients: { id: string; name: string; email: string | null } | null;
  };
  const items = (itemsData ?? []) as QuoteItem[];
  const catalog = (catalogData ?? []) as CatalogItem[];
  const teren = zona === "teren";

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        back={teren ? { href: "/teren/oferte", label: "Oferte" } : { href: "/oferte", label: "Toate ofertele" }}
        title={quote.number}
        badge={<StatusBadge status={quote.status} />}
        description={
          <>
            {quote.clients ? (
              <Link
                href={teren ? `/teren/firma/${quote.clients.id}` : `/clienti/${quote.clients.id}`}
                className="font-medium text-neutral-900 hover:underline"
              >
                {quote.clients.name}
              </Link>
            ) : (
              "Fără client"
            )}
            {quote.title ? ` · ${quote.title}` : ""}
            <span className="block">
              {items.length} {items.length === 1 ? "produs" : "produse"}
              {quote.show_total ? ", cu total la final" : ", fiecare cu prețul lui"}
              {Number(quote.discount_pct) > 0 ? ` · discount ofertă ${quote.discount_pct}%` : ""}
            </span>
          </>
        }
        actions={
          <>
            <Link href={`/print/oferta/${quote.id}`} target="_blank" rel="noreferrer" className="btn btn-secondary">
              Vezi PDF
            </Link>
            <ActionMenu label={`Acțiuni pentru oferta ${quote.number}`}>
              <form action={duplicateQuote}>
                <input type="hidden" name="quote_id" value={quote.id} />
                <input type="hidden" name="zona" value={zona} />
                <SubmitButton className="menu-item" pendingLabel="Se copiază…">
                  Duplică oferta
                </SubmitButton>
              </form>
              {quote.visits ? (
                <Link href={`/teren/vizita/${quote.visits.id}`} className="menu-item" role="menuitem">
                  Vizita din {formatDate(quote.visits.visit_date)}
                </Link>
              ) : null}
              {role !== "agent" ? (
                <Link
                  href={teren ? `/oferte/${quote.id}` : `/teren/oferta/${quote.id}`}
                  className="menu-item"
                  role="menuitem"
                >
                  {teren ? "Deschide la birou" : "Deschide pe teren"}
                </Link>
              ) : null}
            </ActionMenu>
          </>
        }
      />

      {quote.archived_at ? (
        <ArchiveControls
          quoteId={quote.id}
          number={quote.number}
          archivedAt={quote.archived_at}
          canDelete={role !== "agent"}
          zona={zona}
        />
      ) : null}

      <section className="card space-y-4 p-4">
        <div>
          <h2 className="mb-2 text-base font-semibold">Trimite clientului</h2>
          <SendByEmail
            quoteId={quote.id}
            number={quote.number}
            clientName={quote.clients?.name ?? null}
            clientEmail={quote.clients?.email ?? null}
            orgName={organization.name}
          />
          <p className="my-3 text-center text-xs font-medium text-neutral-500">sau</p>
          <SendByWhatsApp
            quoteId={quote.id}
            number={quote.number}
            clientName={quote.clients?.name ?? null}
            orgName={organization.name}
          />
        </div>
        <div className="border-t border-neutral-200 pt-4">
          <StatusPicker quoteId={quote.id} status={quote.status} />
        </div>
      </section>

      <section className="card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 px-4 py-3">
          <h2 className="text-base font-semibold text-neutral-900">Linii ofertă</h2>
          <p className="text-sm text-neutral-500">
            {items.length} {items.length === 1 ? "linie" : "linii"}
          </p>
        </header>

        <QuoteItemsTable
          quoteId={quote.id}
          items={items}
          currency={quote.currency}
          quoteDiscountPct={Number(quote.discount_pct)}
        />

        <div className="space-y-4 border-t border-neutral-200 p-4">
          {catalog.length > 0 ? (
            <CatalogPicker
              action={addCatalogItemToQuote.bind(null, quote.id)}
              items={catalog.map((item) => ({
                id: item.id,
                name: item.name,
                sku: item.sku,
                category: item.category,
                unit: item.unit,
                unit_price: item.unit_price,
                price_on_request: item.price_on_request,
              }))}
            />
          ) : (
            <p className="text-sm text-neutral-500">Catalogul este gol.</p>
          )}

          <details>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand-700">
              ＋ Linie liberă (în afara catalogului)
            </summary>
            <div className="mt-3">
              <AddCustomItemForm action={addCustomItem.bind(null, quote.id)} defaultVatRate={organization.vat_rate} />
            </div>
          </details>
        </div>

        {/* Implicit fiecare produs are prețul lui; totalul apare doar când clientul ia tot. */}
        <div className="space-y-3 border-t border-neutral-200 bg-neutral-50 px-4 py-4">
          {quote.show_total && items.length ? (
            <>
              <p className="text-sm font-semibold">Recapitulare și total (apare și pe PDF)</p>
              <TotalSummary
                items={items}
                quoteDiscountPct={Number(quote.discount_pct)}
                base={quote.currency}
                other={null}
              />
            </>
          ) : (
            <p className="text-sm text-neutral-600">
              Fiecare produs are prețul lui, ca pe PDF. Dacă clientul ia toate produsele, adaugă totalul la final.
            </p>
          )}
          <form action={setShowTotal} className="flex justify-end">
            <input type="hidden" name="quote_id" value={quote.id} />
            <input type="hidden" name="show" value={quote.show_total ? "0" : "1"} />
            <SubmitButton className="btn btn-secondary min-h-11" pendingLabel="Se salvează…">
              {quote.show_total ? "Scoate totalul de la final" : "＋ Adaugă totalul la final"}
            </SubmitButton>
          </form>
        </div>
      </section>

      {/* Pe teren detaliile stau strânse: se schimbă rar, iar pe telefon ocupă mult. */}
      <details className="card group p-4 md:p-6" open={!teren}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-base font-semibold text-neutral-900">
          Detaliile ofertei
          <span className="ml-auto text-sm font-normal text-brand-700 group-open:hidden">client, valabilitate, discount ▾</span>
        </summary>
        <div className="mt-4">
          <QuoteForm
            action={updateQuote.bind(null, quote.id)}
            clients={clientsData ?? []}
            quote={quote}
            autoRateLabel={
              eur
                ? `Gol: ${eur.rate.toFixed(4).replace(".", ",")} (${eur.source}${eur.date ? `, ${formatDate(eur.date)}` : ""})`
                : "Gol: cursul BNR al zilei (acum indisponibil)"
            }
          />
        </div>
      </details>

      {quote.archived_at ? null : (
        <ArchiveControls
          quoteId={quote.id}
          number={quote.number}
          archivedAt={null}
          canDelete={false}
          zona={zona}
        />
      )}
    </div>
  );
}
