import Link from "next/link";
import { notFound } from "next/navigation";

import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/print-button";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEurRate, productSheet, type CatalogSheet, type EurRate } from "@/lib/oferta-print";
import {
  computeTotals, formatDate, formatMoney, formatQuantity, lineNet, lineVat,
} from "@/lib/totals";
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
  const totals = computeTotals(items, quote.discount_pct);
  const client = quote.clients;

  // Fișele de produs: catalogul dă codul și datele verificate, pagina din
  // magazin poza și restul caracteristicilor tehnice.
  const catalogIds = [...new Set(items.map((i) => i.catalog_item_id).filter((x): x is string => !!x))];
  const manualRate = Number(quote.eur_rate) > 0 ? Number(quote.eur_rate) : null;
  const [{ data: catalogData }, autoRate] = await Promise.all([
    catalogIds.length
      ? supabase
          .from("catalog_items")
          .select("id, sku, tech_type, materials, details, shop_url, image_url")
          .in("id", catalogIds)
      : Promise.resolve({ data: [] }),
    manualRate ? Promise.resolve(null) : getEurRate(),
  ]);
  const eur: EurRate | null = manualRate ? { rate: manualRate, date: null, source: "ofertă" } : autoRate;

  const catalog = new Map(((catalogData ?? []) as CatalogSheet[]).map((c) => [c.id, c]));
  const sheets = await Promise.all(
    items.map(async (item) => ({
      item,
      ...(await productSheet(item.catalog_item_id ? (catalog.get(item.catalog_item_id) ?? null) : null)),
    })),
  );

  // Oferta e în lei (RON); euro e echivalentul la curs. O ofertă în euro primește lei.
  const inEur = quote.currency === "EUR";
  const base = inEur ? "EUR" : "RON";
  const other = eur
    ? inEur
      ? { currency: "RON", convert: (v: number) => v * eur.rate }
      : { currency: "EUR", convert: (v: number) => v / eur.rate }
    : null;
  const label = (currency: string) => (currency === "RON" ? "lei" : "EUR");

  /** Suma în moneda ofertei, cu echivalentul în cealaltă monedă dedesubt. */
  const money = (value: number) => (
    <>
      <span className="block whitespace-nowrap">{formatMoney(value, base)}</span>
      {other ? (
        <span className="block whitespace-nowrap text-[11px] text-brand-700">
          {formatMoney(other.convert(value), other.currency)}
        </span>
      ) : null}
    </>
  );

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
        <p className="no-print mx-auto mb-4 max-w-[210mm] rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Cursul EUR nu a putut fi citit acum (BNR și BCE nu au răspuns), așa că prețurile apar doar
          în lei. Completează „Curs EUR pe ofertă” în detaliile ofertei ca să apară și în euro.
        </p>
      ) : null}

      <div className="overflow-x-auto print:overflow-visible">
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

          {/* ------------------------------------------------ fișele de produs */}
          {sheets.length ? (
            <section className="mt-6">
              <p className={SECTION_TITLE}>Produse ofertate</p>
              {sheets.map(({ item, image, specs }, index) => (
                <div
                  key={item.id}
                  className="mt-3 flex gap-5 border-t border-neutral-200 pt-4 break-inside-avoid"
                >
                  <div className="flex h-[48mm] w-[48mm] shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white p-2">
                    {image ? (
                      // Poza vine din magazin, de pe alt domeniu; la tipărire trebuie să fie deja în pagină.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image} alt={item.name} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-center text-[11px] text-neutral-400">fără poză</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-tight">
                      <span className="text-neutral-400">{index + 1}. </span>
                      {item.name}
                    </p>
                    {item.description ? (
                      <p className="mt-1 text-[12px] text-neutral-600">{item.description}</p>
                    ) : null}

                    {specs.length ? (
                      <table className="mt-2 w-full border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-neutral-800 text-white">
                            <th colSpan={2} className="px-2 py-1 text-left font-semibold">
                              Caracteristici principale
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {specs.map((spec) => (
                            <tr key={spec.label} className="border-b border-neutral-200 even:bg-neutral-50">
                              <th className="w-[38%] px-2 py-1 text-left align-top font-medium text-neutral-600">
                                {spec.label}
                              </th>
                              <td className="px-2 py-1 align-top">{spec.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : null}

                    <p className="mt-2 text-[11px] text-neutral-600">
                      Cantitate ofertată: <b>{formatQuantity(item.quantity)} {item.unit}</b>
                    </p>
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          {/* ------------------------------------------------ prețurile, la final */}
          <section className={sheets.length ? "mt-8 break-before-page" : "mt-8"}>
            <div className="flex items-end justify-between gap-4">
              <p className={SECTION_TITLE}>Prețuri</p>
              {rateText ? <p className="text-[11px] text-neutral-600">{rateText}</p> : null}
            </div>

            <table className="mt-2 w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-y border-neutral-300 bg-neutral-100 align-bottom">
                  <th className="px-1.5 py-2 text-left font-semibold">#</th>
                  <th className="px-1.5 py-2 text-left font-semibold">Denumire</th>
                  <th className="px-1.5 py-2 text-right font-semibold">Cant.</th>
                  <th className="px-1.5 py-2 text-right font-semibold">Preț unitar fără TVA</th>
                  <th className="px-1.5 py-2 text-right font-semibold">Valoare fără TVA</th>
                  <th className="px-1.5 py-2 text-right font-semibold">Valoare cu TVA</th>
                </tr>
                {other ? (
                  <tr className="border-b border-neutral-300 text-[11px] text-neutral-500">
                    <th colSpan={3} />
                    {[0, 1, 2].map((i) => (
                      <th key={i} className="px-1.5 py-1 text-right font-normal">
                        {label(base)} / <span className="text-brand-700">{label(other.currency)}</span>
                      </th>
                    ))}
                  </tr>
                ) : null}
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-b border-neutral-200 align-top break-inside-avoid">
                    <td className="px-1.5 py-2 text-neutral-500">{index + 1}</td>
                    <td className="px-1.5 py-2">
                      <p className="font-medium">{item.name}</p>
                      {Number(item.discount_pct) > 0 ? (
                        <p className="text-[11px] text-neutral-500">Discount {item.discount_pct}%</p>
                      ) : null}
                    </td>
                    <td className="px-1.5 py-2 text-right whitespace-nowrap tabular-nums">
                      {formatQuantity(item.quantity)} {item.unit}
                    </td>
                    <td className="px-1.5 py-2 text-right tabular-nums">{money(Number(item.unit_price))}</td>
                    <td className="px-1.5 py-2 text-right tabular-nums">{money(lineNet(item))}</td>
                    <td className="px-1.5 py-2 text-right tabular-nums">
                      {money(lineNet(item) + lineVat(item))}
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-neutral-500">
                      Oferta nu conține produse.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>

            <div className="mt-5 flex justify-end break-inside-avoid">
              <table className="w-[110mm] text-[12px] tabular-nums">
                <thead>
                  <tr className="text-[11px] text-neutral-500">
                    <th />
                    <th className="pb-1 text-right font-medium">{label(base)}</th>
                    {other ? (
                      <th className="pb-1 pl-4 text-right font-medium text-brand-700">
                        {label(other.currency)}
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
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
                      <td className="py-0.5 text-right whitespace-nowrap">{formatMoney(row.value, base)}</td>
                      {other ? (
                        <td className="py-0.5 pl-4 text-right whitespace-nowrap text-brand-700">
                          {formatMoney(other.convert(row.value), other.currency)}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-neutral-900 text-[14px] font-bold">
                    <td className="pt-1">Total de plată</td>
                    <td className="pt-1 text-right whitespace-nowrap">{formatMoney(totals.gross, base)}</td>
                    {other ? (
                      <td className="pt-1 pl-4 text-right whitespace-nowrap text-brand-700">
                        {formatMoney(other.convert(totals.gross), other.currency)}
                      </td>
                    ) : null}
                  </tr>
                </tbody>
              </table>
            </div>

            {other ? (
              <p className="mt-2 text-right text-[11px] text-neutral-500">
                Valorile în {other.currency === "EUR" ? "euro" : "lei"} sunt calculate la cursul de mai
                sus; facturarea se face în {base === "RON" ? "lei" : "euro"}.
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
