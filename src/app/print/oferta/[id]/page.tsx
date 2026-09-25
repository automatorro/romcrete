import Link from "next/link";
import { notFound } from "next/navigation";

import { Logo } from "@/components/logo";
import { ProductBlock } from "@/components/oferta/product-block";
import { TotalSummary } from "@/components/oferta/total-summary";
import { PrintButton } from "@/components/print-button";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEurRate, type EurRate } from "@/lib/oferta-print";
import { loadQuoteSheets } from "@/lib/poze";
import { formatDate } from "@/lib/totals";
import type { Client, Quote, QuoteItem } from "@/lib/types";

export const metadata = { title: "Ofertă — tipărire" };

const SECTION_TITLE = "text-[11px] font-semibold tracking-wide text-neutral-500 uppercase";

export default async function QuotePrintPage(props: PageProps<"/print/oferta/[id]">) {
  const { id } = await props.params;
  const { organization } = await requireOrg();

  const supabase = await createClient();
  const [{ data: quoteData }, { data: itemsData }] = await Promise.all([
    supabase.from("quotes").select("*, clients(*)").eq("id", id).maybeSingle(),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("position"),
  ]);

  if (!quoteData) notFound();

  const quote = quoteData as Quote & { clients: Client | null };
  const items = (itemsData ?? []) as QuoteItem[];
  const client = quote.clients;

  // Fișele de produs, cu poza pusă direct în pagină: PDF-ul nu depinde de
  // magazin în momentul tipăririi. Fără poze, oferta nu se tipărește.
  const manualRate = Number(quote.eur_rate) > 0 ? Number(quote.eur_rate) : null;
  const [{ sheets, missing }, autoRate] = await Promise.all([
    loadQuoteSheets(supabase, items),
    manualRate ? Promise.resolve(null) : getEurRate(),
  ]);
  const eur: EurRate | null = manualRate ? { rate: manualRate, date: null, source: "ofertă" } : autoRate;

  // Oferta e în lei (RON); euro e echivalentul la curs. O ofertă în euro primește lei.
  const inEur = quote.currency === "EUR";
  const base = inEur ? "EUR" : "RON";
  const other = eur
    ? inEur
      ? { currency: "RON", convert: (v: number) => v * eur.rate }
      : { currency: "EUR", convert: (v: number) => v / eur.rate }
    : null;

  const rateText = eur
    ? `1 EUR = ${eur.rate.toFixed(4).replace(".", ",")} lei` +
      (eur.source === "ofertă"
        ? " (curs stabilit pe ofertă)"
        : ` (curs ${eur.source}${eur.date ? ` din ${formatDate(eur.date)}` : ""})`)
    : null;

  return (
    <div className="min-h-screen bg-neutral-200 py-6 print:min-h-0 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
        <Link href={`/oferte/${quote.id}`} className="text-sm text-brand-700 hover:underline">
          ← Înapoi la ofertă
        </Link>
        <PrintButton label="Tipărește / Salvează ca PDF" />
      </div>

      {!eur ? (
        <p className="no-print mx-auto mb-4 max-w-[210mm] notice">
          Cursul EUR nu a putut fi citit acum (BNR și BCE nu au răspuns), așa că prețurile apar doar
          în lei. Completează „Curs EUR pe ofertă” în detaliile ofertei ca să apară și în euro.
        </p>
      ) : null}

      {missing.length ? (
        <div role="alert" className="notice-error mx-auto mb-4 max-w-[210mm]">
          <p>Oferta nu se poate trimite: lipsește poza pentru {missing.join(", ")}.</p>
          <p className="mt-1 font-normal">
            Pune poza din pagina ofertei („Poze lipsă”), apoi revino aici. Până atunci oferta nu se tipărește.
          </p>
        </div>
      ) : null}

      <div className={`overflow-x-auto print:overflow-visible ${missing.length ? "print:hidden" : ""}`}>
        <article className="a4-sheet mx-auto bg-white text-[13px] leading-snug text-neutral-900 shadow-lg">
          {/* ------------------------------------------------ antet: cele două firme */}
          <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-5">
            <div>
              <Logo className="mb-2 h-9 w-auto" />
              <p className="text-lg font-bold tracking-tight">{organization.name}</p>
              <div className="mt-1 space-y-0.5 text-[11px] text-neutral-700">
                {organization.cui ? <p>CUI: {organization.cui}</p> : null}
                {organization.reg_com ? <p>Reg. Com.: {organization.reg_com}</p> : null}
                {organization.address ? (
                  <p>
                    {[organization.address, organization.city, organization.county]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                ) : null}
                {organization.phone ? <p>Telefon: {organization.phone}</p> : null}
                {organization.email ? <p>Email: {organization.email}</p> : null}
                {organization.iban ? (
                  <p>
                    IBAN: {organization.iban}
                    {organization.bank ? ` · ${organization.bank}` : ""}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-lg font-bold tracking-tight">OFERTĂ</p>
              <p className="text-sm font-medium">{quote.number}</p>
              <p className="mt-1 text-[11px] text-neutral-700">Emisă: {formatDate(quote.issue_date)}</p>
              {quote.valid_until ? (
                <p className="text-[11px] text-neutral-700">
                  Valabilă până: {formatDate(quote.valid_until)}
                </p>
              ) : null}
            </div>
          </header>

          <section className="mt-5 grid grid-cols-2 gap-6">
            <div>
              <p className={SECTION_TITLE}>Către</p>
              <p className="mt-1 font-semibold">{client?.name ?? "—"}</p>
              <div className="mt-1 space-y-0.5 text-[11px] text-neutral-700">
                {client?.cui ? <p>CUI: {client.cui}</p> : null}
                {client?.reg_com ? <p>Nr. Reg. Com.: {client.reg_com}</p> : null}
                {client && (client.address || client.city || client.county) ? (
                  <p>{[client.address, client.city, client.county].filter(Boolean).join(", ")}</p>
                ) : null}
                {client?.contact_person ? <p>Contact: {client.contact_person}</p> : null}
                {client?.phone ? <p>Telefon: {client.phone}</p> : null}
                {client?.email ? <p>Email: {client.email}</p> : null}
              </div>
            </div>

            {quote.title || quote.site_address ? (
              <div>
                <p className={SECTION_TITLE}>Lucrare</p>
                {quote.title ? <p className="mt-1 font-semibold">{quote.title}</p> : null}
                {quote.site_address ? (
                  <p className="mt-1 text-[11px] text-neutral-700">Șantier: {quote.site_address}</p>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* ------------------------------------------------ produsele, fiecare cu prețul lui */}
          <section className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className={SECTION_TITLE}>Produse ofertate</p>
              {rateText ? <p className="text-[11px] text-neutral-600">{rateText}</p> : null}
            </div>

            {sheets.length === 0 ? (
              <p className="mt-3 text-neutral-500">Oferta nu conține produse.</p>
            ) : null}

            {sheets.map(({ item, image, specs }, index) => (
              <ProductBlock
                key={item.id}
                item={item}
                image={image}
                specs={specs}
                index={index}
                quoteDiscountPct={Number(quote.discount_pct)}
                base={base}
                other={other}
              />
            ))}

            {/* La cerere: clientul ia toate produsele, deci oferta le adună la final. */}
            {quote.show_total && items.length ? (
              <div className="mt-8 border-t-2 border-neutral-900 pt-4 break-inside-avoid">
                <p className={SECTION_TITLE}>Recapitulare și total</p>
                <div className="mt-2">
                  <TotalSummary
                    items={items}
                    quoteDiscountPct={Number(quote.discount_pct)}
                    base={base}
                    other={other}
                  />
                </div>
              </div>
            ) : null}

            {other && sheets.length ? (
              <p className="mt-4 text-right text-[11px] text-neutral-500">
                Valorile în {other.currency === "EUR" ? "euro" : "lei"} sunt calculate la cursul de mai sus;
                facturarea se face în {base === "RON" ? "lei" : "euro"}.
              </p>
            ) : null}
          </section>

          {quote.notes ? (
            <section className="mt-6 break-inside-avoid">
              <p className={SECTION_TITLE}>Observații</p>
              <p className="mt-1 whitespace-pre-line">{quote.notes}</p>
            </section>
          ) : null}

          {quote.terms ? (
            <section className="mt-5 break-inside-avoid">
              <p className={SECTION_TITLE}>Condiții comerciale</p>
              <p className="mt-1 whitespace-pre-line">{quote.terms}</p>
            </section>
          ) : null}

          <footer className="mt-10 grid grid-cols-2 gap-8 break-inside-avoid">
            <div>
              <p className="text-neutral-700">Ofertant</p>
              <div className="mt-10 border-t border-neutral-300 pt-1 text-[11px] text-neutral-500">
                semnătură și ștampilă
              </div>
            </div>
            <div>
              <p className="text-neutral-700">Am luat la cunoștință</p>
              <div className="mt-10 border-t border-neutral-300 pt-1 text-[11px] text-neutral-500">
                semnătură client
              </div>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
