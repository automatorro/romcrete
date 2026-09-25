import { PhotoUpload } from "@/components/oferta/photo-upload";
import { photoStatus } from "@/lib/poze";
import { createClient } from "@/lib/supabase/server";
import type { QuoteItem } from "@/lib/types";

/**
 * Pozele ofertei, înainte de trimitere. Oferta nu pleacă fără poze: ce lipsește
 * se arată aici, cu butonul de pus poza lângă fiecare produs.
 */
export async function PhotosPanel({ quoteId, items }: { quoteId: string; items: QuoteItem[] }) {
  if (!items.length) return null;
  const db = await createClient();
  const status = await photoStatus(db, items);
  const missing = status.filter((s) => s.status === "lipsa");
  const fromShop = status.filter((s) => s.status === "din-magazin");

  if (!missing.length) {
    return (
      <p className="notice-ok">
        ✓ Toate produsele au poză
        {fromShop.length
          ? ` (${fromShop.map((s) => s.item.name).join(", ")}: se descarcă din magazin la generarea PDF-ului și rămân păstrate).`
          : "."}
      </p>
    );
  }

  return (
    <section className="rounded-xl border-2 border-bad bg-white p-4" aria-labelledby="poze-lipsa">
      <h2 id="poze-lipsa" className="text-base font-semibold text-bad">
        Poze lipsă: oferta nu se poate trimite până nu le pui
      </h2>
      <p className="mt-0.5 text-sm text-neutral-600">
        Fiecare produs de pe ofertă intră în PDF cu poza lui. Pune poza din telefon (cameră sau galerie) ori de pe
        calculator.
      </p>
      <ul className="mt-3 divide-y divide-neutral-200">
        {missing.map(({ item }) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1 font-medium">{item.name}</span>
            <PhotoUpload
              target={item.catalog_item_id ? "catalog" : "linie"}
              id={item.catalog_item_id ?? item.id}
              quoteId={quoteId}
            />
          </li>
        ))}
      </ul>
      {missing.some((m) => m.item.catalog_item_id) ? (
        <p className="mt-2 text-xs text-neutral-500">
          Poza unui produs din catalog rămâne salvată și apare pe toate ofertele următoare.
        </p>
      ) : null}
    </section>
  );
}
