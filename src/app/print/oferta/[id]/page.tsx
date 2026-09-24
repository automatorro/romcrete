import Link from "next/link";
import { notFound } from "next/navigation";

import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/print-button";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEurRate, productImage, productSpecs, type CatalogSheet } from "@/lib/oferta-print";
import {
  computeTotals, formatDate, formatMoney, formatQuantity, lineNet, lineVat,
} from "@/lib/totals";
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

  // Fișele de produs: poza și caracteristicile vin din catalog, prin legătura liniei.
  const catalogIds = [...new Set(items.map((i) => i.catalog_item_id).filter((x): x is string => !!x))];
  const [{ data: catalogData }, eur] = await Promise.all([
    catalogIds.length
      ? supabase
          .from("catalog_items")
          .select("id, sku, tech_type, materials, details, shop_url, image_url")
          .in("id", catalogIds)
      : Promise.resolve({ data: [] }),
    getEurRate(),
  ]);
  const catalog = new Map(((catalogData ?? []) as CatalogSheet[]).map((c) => [c.id, c]));
  const sheets = await Promise.all(
    items.map(async (item) => {
      const source = item.catalog_item_id ? (catalog.get(item.catalog_item_id) ?? null) : null;
      return { item, image: await productImage(source), specs: productSpecs(source) };
    }),
  );

  // A doua monedă: euro pentru ofertele în lei, lei pentru cele în euro.
  // Valorile convertite sunt informative; baza ofertei rămâne moneda ei.
  const other =
    eur && quote.currency === "RON"
      ? { currency: "EUR", convert: (v: number) => v / eur.rate }
      : eur && quote.currency === "EUR"
        ? { currency: "RON", convert: (v: number) => v * eur.rate }
        : null;

  /** Suma în moneda ofertei, cu echivalentul dedesubt. */
  const money = (value: number) => (
    <>
      <span className="block whitespace-nowrap">{formatMoney(value, quote.currency)}</span>
      {other ? (
        <span className="block whitespace-nowrap text-xs text-neutral-500">
          {formatMoney(other.convert(value), other.currency)}
        </span>
      ) : null}
    </>
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 text-neutral-900">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/oferte/${quote.id}`} className="text-sm text-brand-700 hover:underline">
          ← Înapoi la ofertă
        </Link>
        <PrintButton label="Tipărește / Salvează ca PDF" />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-neutral-900 pb-6">
        <div>
          <Logo className="mb-2 h-9 w-auto" />
          <p className="text-xl font-bold tracking-tight">{organization.name}</p>
          <div className="mt-1 space-y-0.5 text-xs text-neutral-700">
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
          <p className="mt-1 text-xs text-neutral-700">Emisă: {formatDate(quote.issue_date)}</p>
          {quote.valid_until ? (
            <p className="text-xs text-neutral-700">Valabilă până: {formatDate(quote.valid_until)}</p>
          ) : null}
        </div>
      </header>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Client</p>
          <p className="mt-1 font-medium">{client?.name ?? "—"}</p>
          <div className="mt-1 space-y-0.5 text-xs text-neutral-700">
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
            <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Lucrare</p>
            {quote.title ? <p className="mt-1 font-medium">{quote.title}</p> : null}
            {quote.site_address ? (
              <p className="mt-1 text-xs text-neutral-700">Șantier: {quote.site_address}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      {items.length ? (
        <section className="mt-8">
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Produse ofertate
          </p>
          <div className="mt-2 divide-y divide-neutral-200 border-y border-neutral-200">
            {sheets.map(({ item, image, specs }, index) => (
              <article key={item.id} className="flex gap-5 py-5 break-inside-avoid">
                <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white p-2">
                  {image ? (
                    // Poza vine din magazin, de pe alt domeniu; la tipărire trebuie să fie deja în pagină.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={item.name} className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-center text-xs text-neutral-400">fără poză</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold">
                    <span className="text-neutral-400">{index + 1}. </span>
                    {item.name}
                  </p>
                  {item.description ? (
                    <p className="mt-0.5 text-sm text-neutral-600">{item.description}</p>
                  ) : null}
                  {specs.length ? (
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                      {specs.map((spec) => (
                        <div key={spec.label} className="contents">
                          <dt className="text-neutral-500">{spec.label}</dt>
                          <dd className="text-neutral-900">{spec.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <p className="mt-3 text-xs text-neutral-500">
                    Cantitate: {formatQuantity(item.quantity)} {item.unit}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={items.length ? "mt-8 break-before-page" : "mt-8"}>
        <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Prețuri</p>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-neutral-300 bg-neutral-100 align-bottom">
              <th className="px-2 py-2 text-left font-semibold">#</th>
              <th className="px-2 py-2 text-left font-semibold">Denumire</th>
              <th className="px-2 py-2 text-left font-semibold">UM</th>
              <th className="px-2 py-2 text-right font-semibold">Cant.</th>
              <th className="px-2 py-2 text-right font-semibold">Preț unitar fără TVA</th>
              <th className="px-2 py-2 text-right font-semibold">Valoare fără TVA</th>
              <th className="px-2 py-2 text-right font-semibold">Valoare cu TVA</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-b border-neutral-200 align-top break-inside-avoid">
                <td className="px-2 py-2 text-neutral-500">{index + 1}</td>
                <td className="px-2 py-2">
                  <p className="font-medium">{item.name}</p>
                  {Number(item.discount_pct) > 0 ? (
                    <p className="text-xs text-neutral-500">Discount {item.discount_pct}%</p>
                  ) : null}
                </td>
                <td className="px-2 py-2">{item.unit}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatQuantity(item.quantity)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {money(Number(item.unit_price))}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {money(lineNet(item))}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {money(lineNet(item) + lineVat(item))}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-neutral-500">
                  Oferta nu conține produse.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end break-inside-avoid">
          <table className="w-full max-w-sm text-sm">
            {other ? (
              <thead>
                <tr className="text-xs text-neutral-500">
                  <th />
                  <th className="pb-1 text-right font-medium">{quote.currency === "RON" ? "lei" : quote.currency}</th>
                  <th className="pb-1 pl-4 text-right font-medium">{other.currency === "RON" ? "lei" : other.currency}</th>
                </tr>
              </thead>
            ) : null}
            <tbody className="tabular-nums">
              {[
                { label: "Total fără TVA", value: totals.linesNet },
                ...(totals.quoteDiscount > 0
                  ? [{ label: `Discount ${quote.discount_pct}%`, value: -totals.quoteDiscount }]
                  : []),
                { label: "Bază de impozitare", value: totals.net },
                { label: "TVA", value: totals.vat },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="py-0.5 text-neutral-700">{row.label}</td>
                  <td className="py-0.5 text-right whitespace-nowrap">
                    {formatMoney(row.value, quote.currency)}
                  </td>
                  {other ? (
                    <td className="py-0.5 pl-4 text-right whitespace-nowrap text-neutral-700">
                      {formatMoney(other.convert(row.value), other.currency)}
                    </td>
                  ) : null}
                </tr>
              ))}
              <tr className="border-t-2 border-neutral-900 text-base font-bold">
                <td className="pt-1">Total de plată</td>
                <td className="pt-1 text-right whitespace-nowrap">
                  {formatMoney(totals.gross, quote.currency)}
                </td>
                {other ? (
                  <td className="pt-1 pl-4 text-right whitespace-nowrap">
                    {formatMoney(other.convert(totals.gross), other.currency)}
                  </td>
                ) : null}
              </tr>
            </tbody>
          </table>
        </div>

        {eur ? (
          <p className="mt-3 text-right text-xs text-neutral-500">
            Curs BNR din {formatDate(eur.date)}: 1 EUR = {eur.rate.toFixed(4).replace(".", ",")} lei.
            {other ? ` Valorile în ${other.currency === "RON" ? "lei" : "euro"} sunt informative.` : ""}
          </p>
        ) : quote.currency === "RON" ? (
          <p className="no-print mt-3 text-right text-xs text-neutral-500">
            Cursul BNR nu a putut fi citit acum; oferta apare doar în lei. Reîncarcă pagina mai târziu.
          </p>
        ) : null}
      </section>

      {quote.notes ? (
        <section className="mt-8">
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Observații
          </p>
          <p className="mt-1 text-sm whitespace-pre-line">{quote.notes}</p>
        </section>
      ) : null}

      {quote.terms ? (
        <section className="mt-6">
          <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Condiții comerciale
          </p>
          <p className="mt-1 text-sm whitespace-pre-line">{quote.terms}</p>
        </section>
      ) : null}

      <footer className="mt-12 grid gap-8 text-sm sm:grid-cols-2">
        <div>
          <p className="text-neutral-700">Ofertant</p>
          <div className="mt-10 border-t border-neutral-300 pt-1 text-xs text-neutral-500">
            semnătură și ștampilă
          </div>
        </div>
        <div>
          <p className="text-neutral-700">Am luat la cunoștință</p>
          <div className="mt-10 border-t border-neutral-300 pt-1 text-xs text-neutral-500">
            semnătură client
          </div>
        </div>
      </footer>
    </div>
  );
}
