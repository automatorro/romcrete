import { currencyLabel, priceRows, type OfferProduct, type OtherCurrency } from "@/lib/oferta-document";
import { formatMoney } from "@/lib/totals";

/**
 * Un produs pe oferta tipărită, ca în oferta model Romcrete: titlul, poza cu
 * prezentarea, ce conține, specificațiile tehnice, avantajele, recomandările și
 * aplicațiile, apoi prețul lui în lei și în euro. Produsele stau unul sub altul,
 * fiecare cu prețul propriu, pe oricâte pagini e nevoie.
 */
export function ProductBlock({
  product,
  index,
  quoteDiscountPct,
  base,
  other,
}: {
  product: OfferProduct;
  index: number;
  quoteDiscountPct: number;
  base: string;
  other: OtherCurrency | null;
}) {
  const { item, image, intro, contents, specs, benefits, recommendations, applications, price } = product;
  const withNotes = specs.some((s) => s.note);
  const rows = priceRows(item, price, quoteDiscountPct);

  return (
    <section className={index ? "mt-10 border-t border-neutral-300 pt-8" : "mt-6"}>
      {/* Poza plutește în stânga, iar textul curge lângă ea și, dacă e lung, pe pagina următoare. */}
      <div className="flow-root">
        <h2 className="text-[17px] leading-tight font-bold break-after-avoid">
          {index + 1}. {item.name}
        </h2>
        {image ? (
          <div className="float-left mt-3 mr-5 mb-2 flex h-[62mm] w-[62mm] items-center justify-center break-inside-avoid">
            {/* Poza e deja în pagină (data: URI), ca PDF-ul să nu depindă de magazin. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={item.name} className="max-h-full max-w-full object-contain" />
          </div>
        ) : null}
        <div className="mt-3 space-y-3">
          {intro ? <p className="text-justify whitespace-pre-line">{intro}</p> : null}
          {contents.length ? (
            <div className="break-inside-avoid">
              <p className="font-bold">CONȚINE:</p>
              <List items={contents} />
            </div>
          ) : null}
        </div>
      </div>

      {specs.length ? (
        // Titlul tabelului nu rămâne singur la capăt de pagină; un tabel scurt stă întreg.
        <div className={`mt-5 ${specs.length <= 14 ? "break-inside-avoid" : ""}`}>
          <h3 className="mb-2 text-[14px] font-bold break-after-avoid">Specificații tehnice cheie</h3>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-neutral-300 px-2 py-1 text-left font-bold">Parametru</th>
                <th className="border border-neutral-300 px-2 py-1 text-left font-bold">Valoare</th>
                {withNotes ? (
                  <th className="border border-neutral-300 px-2 py-1 text-left font-bold">Observații / detalii suplimentare</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {specs.map((spec, i) => (
                <tr key={`${spec.label}-${i}`} className="break-inside-avoid">
                  <td className="w-[36%] border border-neutral-300 px-2 py-1 align-top">{spec.label}</td>
                  <td className="border border-neutral-300 px-2 py-1 align-top">{spec.value}</td>
                  {withNotes ? (
                    <td className="border border-neutral-300 px-2 py-1 align-top">{spec.note ?? ""}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Section title="Avantaje și beneficii" items={benefits} />
      <Section title="Recomandări și condiții de utilizare" items={recommendations} />
      <Section title="Aplicații recomandate" items={applications} />

      {/* Prețul produsului, imediat sub el, în lei și în euro. */}
      <table className="mt-5 ml-auto w-[125mm] border-collapse text-[12px] tabular-nums break-inside-avoid">
        <thead>
          <tr className="bg-neutral-800 text-white">
            <th className="px-2 py-1 text-left font-semibold">
              Preț · {index + 1}. {item.name}
            </th>
            <th className="px-2 py-1 text-right font-semibold">{currencyLabel(base)}</th>
            {other ? <th className="px-2 py-1 text-right font-semibold">{currencyLabel(other.currency)}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={row.strong ? "border-t-2 border-neutral-900 text-[14px] font-bold" : "border-b border-neutral-200"}
            >
              <td className="px-2 py-1">{row.label}</td>
              <td className="px-2 py-1 text-right whitespace-nowrap">{formatMoney(row.value, base)}</td>
              {other ? (
                <td className="px-2 py-1 text-right whitespace-nowrap text-brand-700">
                  {formatMoney(other.convert(row.value), other.currency)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    // O secțiune scurtă stă întreagă pe o pagină; una lungă se rupe, dar titlul nu rămâne singur.
    <div className={`mt-5 ${items.length <= 8 ? "break-inside-avoid" : ""}`}>
      <h3 className="mb-1 text-[14px] font-bold break-after-avoid">{title}</h3>
      <List items={items} />
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((text, i) => (
        <li key={i} className="break-inside-avoid">
          <Emphasis text={text} />
        </li>
      ))}
    </ul>
  );
}

/** „ProConnect™ – permite…”: partea dinaintea liniuței e numele avantajului, îngroșat, ca în oferta model. */
function Emphasis({ text }: { text: string }) {
  const match = text.match(/^(.{2,60}?)\s+[–-]\s+(.+)$/);
  if (!match) return <>{text}</>;
  return (
    <>
      <b>{match[1]}</b> – {match[2]}
    </>
  );
}
