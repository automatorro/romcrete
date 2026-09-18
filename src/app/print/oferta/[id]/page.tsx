import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/print-button";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeTotals, formatDate, formatMoney, formatQuantity, lineNet } from "@/lib/totals";
import type { Client, Quote, QuoteItem } from "@/lib/types";

export const metadata = { title: "Ofertă — tipărire" };

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
  const totals = computeTotals(items, quote.discount_pct);
  const client = quote.clients;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 text-concrete-900">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/oferte/${quote.id}`} className="text-sm text-brand-700 hover:underline">
          ← Înapoi la ofertă
        </Link>
        <PrintButton label="Tipărește / Salvează ca PDF" />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-concrete-900 pb-6">
        <div>
          <p className="text-xl font-bold tracking-tight">{organization.name}</p>
          <div className="mt-1 space-y-0.5 text-xs text-concrete-700">
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

        <div className="text-right">
          <p className="text-lg font-bold tracking-tight">OFERTĂ</p>
          <p className="text-sm font-medium">{quote.number}</p>
          <p className="mt-1 text-xs text-concrete-700">Emisă: {formatDate(quote.issue_date)}</p>
          {quote.valid_until ? (
            <p className="text-xs text-concrete-700">Valabilă până: {formatDate(quote.valid_until)}</p>
          ) : null}
        </div>
      </header>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-concrete-500 uppercase">Client</p>
          <p className="mt-1 font-medium">{client?.name ?? "—"}</p>
          <div className="mt-1 space-y-0.5 text-xs text-concrete-700">
            {client?.cui ? <p>CUI: {client.cui}</p> : null}
            {client?.address ? (
              <p>{[client.address, client.city, client.county].filter(Boolean).join(", ")}</p>
            ) : null}
            {client?.contact_person ? <p>Contact: {client.contact_person}</p> : null}
            {client?.phone ? <p>Telefon: {client.phone}</p> : null}
            {client?.email ? <p>Email: {client.email}</p> : null}
          </div>
        </div>

        {quote.title || quote.site_address ? (
          <div>
            <p className="text-xs font-semibold tracking-wide text-concrete-500 uppercase">Lucrare</p>
            {quote.title ? <p className="mt-1 font-medium">{quote.title}</p> : null}
            {quote.site_address ? (
              <p className="mt-1 text-xs text-concrete-700">Șantier: {quote.site_address}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-concrete-300 bg-concrete-100">
            <th className="px-2 py-2 text-left font-semibold">#</th>
            <th className="px-2 py-2 text-left font-semibold">Denumire</th>
            <th className="px-2 py-2 text-left font-semibold">UM</th>
            <th className="px-2 py-2 text-right font-semibold">Cant.</th>
            <th className="px-2 py-2 text-right font-semibold">Preț unitar</th>
            <th className="px-2 py-2 text-right font-semibold">Valoare</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.id} className="border-b border-concrete-200 align-top">
              <td className="px-2 py-2 text-concrete-500">{index + 1}</td>
              <td className="px-2 py-2">
                <p className="font-medium">{item.name}</p>
                {item.description ? (
                  <p className="text-xs text-concrete-500">{item.description}</p>
                ) : null}
                {Number(item.discount_pct) > 0 ? (
                  <p className="text-xs text-concrete-500">Discount {item.discount_pct}%</p>
                ) : null}
              </td>
              <td className="px-2 py-2">{item.unit}</td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatQuantity(item.quantity)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatMoney(item.unit_price, quote.currency)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {formatMoney(lineNet(item), quote.currency)}
              </td>
            </tr>
          ))}
          {items.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-2 py-6 text-center text-concrete-500">
                Oferta nu conține produse.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <dl className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-concrete-700">Total fără TVA</dt>
            <dd className="tabular-nums">{formatMoney(totals.linesNet, quote.currency)}</dd>
          </div>
          {totals.quoteDiscount > 0 ? (
            <div className="flex justify-between">
              <dt className="text-concrete-700">Discount {quote.discount_pct}%</dt>
              <dd className="tabular-nums">− {formatMoney(totals.quoteDiscount, quote.currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-concrete-700">Bază de impozitare</dt>
            <dd className="tabular-nums">{formatMoney(totals.net, quote.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-concrete-700">TVA</dt>
            <dd className="tabular-nums">{formatMoney(totals.vat, quote.currency)}</dd>
          </div>
          <div className="flex justify-between border-t-2 border-concrete-900 pt-1 text-base font-bold">
            <dt>Total de plată</dt>
            <dd className="tabular-nums">{formatMoney(totals.gross, quote.currency)}</dd>
          </div>
        </dl>
      </div>

      {quote.notes ? (
        <section className="mt-8">
          <p className="text-xs font-semibold tracking-wide text-concrete-500 uppercase">
            Observații
          </p>
          <p className="mt-1 text-sm whitespace-pre-line">{quote.notes}</p>
        </section>
      ) : null}

      {quote.terms ? (
        <section className="mt-6">
          <p className="text-xs font-semibold tracking-wide text-concrete-500 uppercase">
            Condiții comerciale
          </p>
          <p className="mt-1 text-sm whitespace-pre-line">{quote.terms}</p>
        </section>
      ) : null}

      <footer className="mt-12 grid gap-8 text-sm sm:grid-cols-2">
        <div>
          <p className="text-concrete-700">Ofertant</p>
          <div className="mt-10 border-t border-concrete-300 pt-1 text-xs text-concrete-500">
            semnătură și ștampilă
          </div>
        </div>
        <div>
          <p className="text-concrete-700">Am luat la cunoștință</p>
          <div className="mt-10 border-t border-concrete-300 pt-1 text-xs text-concrete-500">
            semnătură client
          </div>
        </div>
      </footer>
    </div>
  );
}
