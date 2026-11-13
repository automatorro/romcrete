import { type OfferProduct } from "@/lib/oferta-document";

/**
 * Un produs pe oferta tipărită: imaginea, descrierea și avantajele deschid
 * prezentarea, urmate de compatibilitate, conținut, specificații și preț.
 */
export function ProductBlock({
  product,
  index,
}: {
  product: OfferProduct;
  index: number;
}) {
  const { item, image, intro, contents, specs, benefits, recommendations, applications } = product;
  const withNotes = specs.some((s) => s.note);
  const introLines = (intro ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  return (
    <section className={index ? "mt-10 border-t border-neutral-300 pt-8" : "mt-6"}>
      <div className="grid grid-cols-[minmax(0,62mm)_minmax(0,1fr)] items-start gap-5">
        {image ? (
          <div className="flex h-[62mm] w-[62mm] items-center justify-center break-inside-avoid">
            {/* Poza e deja în pagină (data: URI), ca PDF-ul să nu depindă de magazin. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={item.name} className="max-h-full max-w-full object-contain" />
          </div>
        ) : null}
        <div className={`min-w-0 space-y-3 ${image ? "" : "col-span-2"}`}>
          <h2 className="text-[20px] leading-tight font-bold break-after-avoid">
            {index + 1}. {item.name}
          </h2>
          {introLines.length ? (
            <div className="space-y-2">
              {introLines.map((line, i) => (
                <p key={i} className={introLines.length > 1 && i === 0 ? "font-semibold" : ""}>
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          {benefits.length || recommendations.length ? (
            <div className="break-inside-avoid">
              <h3 className="mb-1 text-[14px] font-bold break-after-avoid">Avantaje și beneficii</h3>
              <List items={[...benefits, ...recommendations]} />
            </div>
          ) : null}
        </div>
      </div>

      <Section title="Compatibilitate materiale" items={applications} />
      {contents.length ? (
        <Section title="Unitățile complete includ" items={contents} />
      ) : null}

      {specs.length ? (
        // Titlul tabelului nu rămâne singur la capăt de pagină; un tabel scurt stă întreg.
        <div className={`mt-5 ${specs.length <= 14 ? "break-inside-avoid" : ""}`}>
          <h3 className="mb-2 text-[14px] font-bold break-after-avoid">Caracteristici tehnice {item.name}</h3>
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
