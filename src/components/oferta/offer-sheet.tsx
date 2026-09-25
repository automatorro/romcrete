import { Anton, Open_Sans } from "next/font/google";
import Link from "next/link";

import { FinancialOffer } from "@/components/oferta/financial-offer";
import { ProductBlock } from "@/components/oferta/product-block";
import { PrintButton } from "@/components/print-button";
import { companyFooter, joinAddress, type OfferDocument } from "@/lib/oferta-document";
import { formatDate } from "@/lib/totals";

// Fonturile ofertei Romcrete: Open Sans pentru text, titlurile părților în
// stilul Impact (Anton e echivalentul lui, disponibil și pe server).
const openSans = Open_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-oferta" });
const anton = Anton({ weight: "400", subsets: ["latin", "latin-ext"], variable: "--font-oferta-titlu" });

/** Oferta desenată din datele ei; pagina de tipărire și PDF-ul o folosesc la fel. */
export function OfferSheet({ doc, pdf }: { doc: OfferDocument; pdf: boolean }) {
  const { organization } = doc;
  const { quote, client, agent, products, missing, base, other, eur, rateText } = doc;
  const discount = Number(quote.discount_pct);
  const footer = companyFooter(organization);

  return (
    <div className="min-h-screen bg-neutral-200 py-6 print:min-h-0 print:bg-white print:py-0">
      {/* În PDF marginea de jos lasă loc subsolului cu datele firmei, pus de Chrome pe fiecare pagină. */}
      {pdf ? <style>{"@page { size: A4; margin: 12mm 12mm 32mm 12mm; }"}</style> : null}
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
        <Link href={`/oferte/${quote.id}`} className="text-sm text-brand-700 hover:underline">
          ← Înapoi la ofertă
        </Link>
        <div className="flex flex-wrap gap-2">
          <a href={`/print/oferta/${quote.id}/word`} className="btn btn-secondary">
            Descarcă Word
          </a>
          <PrintButton label="Tipărește / Salvează ca PDF" />
        </div>
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
        <article className={`${openSans.variable} ${anton.variable} oferta a4-sheet mx-auto bg-white text-[13px] leading-normal text-neutral-900 shadow-lg`}>
          {/* ------------------------------------------------ antetul firmei */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/oferta/antet.jpg" alt={organization.name} className="mx-auto block w-full max-w-[170mm]" />

          {/* ------------------------------------------------ cine face oferta și pentru cine */}
          <section className="mt-6 grid grid-cols-2 gap-5 break-inside-avoid">
            <div className="oferta-caseta space-y-0.5 p-4">
              <Row label="Ofertă întocmită de">{organization.name}</Row>
              <Row label="Reprezentant companie">{agent.name}</Row>
              <Row label="Telefon">{agent.phone}</Row>
              <Row label="Email">{agent.email}</Row>
              <Row label="Numărul ofertei">{quote.number}</Row>
              <Row label="Data la care a fost întocmită oferta">{formatDate(quote.issue_date)}</Row>
              {doc.validityDays ? (
                <Row label="Valabilitatea ofertei">{`${doc.validityDays} de zile`}</Row>
              ) : quote.valid_until ? (
                <Row label="Valabilă până la">{formatDate(quote.valid_until)}</Row>
              ) : null}
            </div>
            <div className="oferta-caseta space-y-0.5 p-4">
              <Row label="În atenția">{client?.contact_person}</Row>
              <Row label="Compania">{client?.name}</Row>
              <Row label="CUI">{client?.cui}</Row>
              <Row label="Tel">{client?.phone}</Row>
              <Row label="E-mail">{client?.email}</Row>
              <Row label="Adresa">{client ? joinAddress(client.address, client.city, client.county) : null}</Row>
              {quote.site_address ? <Row label="Șantier">{quote.site_address}</Row> : null}
            </div>
          </section>

          <Banner>FORMULAR DE OFERTĂ TEHNICO – FINANCIARĂ</Banner>
          {quote.title ? <p className="mt-2 text-center font-semibold">{quote.title}</p> : null}
          {rateText ? <p className="mt-1 text-right text-[11px] text-neutral-600">{rateText}</p> : null}

          {/* ------------------------------------------------ produsele, fiecare cu fișa și prețul lui */}
          {products.length === 0 ? <p className="mt-4 text-neutral-500">Oferta nu conține produse.</p> : null}
          {products.map((product, index) => (
            <ProductBlock
              key={product.item.id}
              product={product}
              index={index}
              quoteDiscountPct={discount}
              base={base}
              other={other}
            />
          ))}

          {other && products.length ? (
            <p className="mt-4 text-right text-[11px] text-neutral-500">
              Valorile în {other.currency === "EUR" ? "euro" : "lei"} sunt calculate la cursul de mai sus;
              facturarea se face în {base === "RON" ? "lei" : "euro"}.
            </p>
          ) : null}

          {/* ------------------------------------------------ totalul, doar la cerere */}
          {doc.totals ? (
            <section className="break-inside-avoid">
              <Banner>OFERTĂ FINANCIARĂ</Banner>
              <div className="mt-4">
                <FinancialOffer doc={doc} />
              </div>
            </section>
          ) : null}

          {quote.notes ? (
            <section className="mt-6 break-inside-avoid">
              <p className="font-bold">Observații</p>
              <p className="mt-1 whitespace-pre-line">{quote.notes}</p>
            </section>
          ) : null}

          {/* ------------------------------------------------ condițiile și semnătura */}
          {doc.terms.length ? (
            <section className="break-inside-avoid">
              <Banner>CONDIȚII ȘI TERMENE DE PLATĂ</Banner>
              <ul className="mt-4 list-disc space-y-1 pl-5">
                {doc.terms.map((term, i) => (
                  <li key={i}>
                    {term.label ? <b>{term.label}: </b> : null}
                    {term.text}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-10 flex justify-end break-inside-avoid">
            <div className="w-[80mm] text-center">
              <p className="font-semibold">Reprezentant {organization.name}</p>
              {agent.name ? <p>{agent.name}</p> : null}
              <div className="relative mt-2 flex h-[32mm] items-center justify-center">
                {doc.stamp ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={doc.stamp} alt="Ștampila firmei" className="absolute left-2 max-h-[30mm] max-w-[32mm] object-contain opacity-90" />
                ) : null}
                {agent.signature ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={agent.signature} alt="Semnătura" className="relative max-h-[22mm] max-w-[45mm] object-contain" />
                ) : null}
                {!doc.stamp && !agent.signature ? (
                  <span className="self-end border-t border-neutral-300 px-8 pt-1 text-[11px] text-neutral-500">
                    semnătură și ștampilă
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          {pdf ? null : (
            <footer className="mt-10 border-t border-neutral-300 pt-3 text-center text-[11px] text-neutral-600">
              <p className="font-bold text-neutral-800">{footer.title}</p>
              {footer.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </footer>
          )}
        </article>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p>
      <b>{label}:</b> {children}
    </p>
  );
}

/** Titlul unei părți a ofertei, ca în oferta model: caseta albă cu umbră și scris albastru. */
function Banner({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="oferta-caseta oferta-titlu mt-8 px-4 py-2 text-center text-[20px] break-after-avoid">{children}</h2>
  );
}
