import { productSheet, type CatalogSheet, type Spec } from "@/lib/oferta-print";
import type { createClient } from "@/lib/supabase/server";
import type { QuoteItem } from "@/lib/types";

type Db = Awaited<ReturnType<typeof createClient>>;

/** O poză mai mare de atât nu e o poză de produs, ci o greșeală: nu intră în PDF. */
const MAX_BYTES = 8 * 1024 * 1024;

const dataUri = (mime: string, b64: string) => `data:${mime};base64,${b64}`;

/**
 * Descarcă o poză, cu reîncercări: magazinul poate răspunde greu o dată, dar
 * oferta nu pleacă fără poze, deci nu renunțăm la prima eroare.
 */
async function download(url: string): Promise<{ mime: string; b64: string } | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; RomcreteOferte/1.0)", accept: "image/*" },
        cache: "no-store",
      });
      const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (res.ok && mime.startsWith("image/")) {
        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.length > 0 && bytes.length <= MAX_BYTES) return { mime, b64: bytes.toString("base64") };
        return null;
      }
    } catch {
      // încercăm din nou
    }
    await new Promise((r) => setTimeout(r, attempt * 800));
  }
  return null;
}

/**
 * Poza unui produs din catalog, ca data: URI. Întâi cea păstrată în baza de
 * date; dacă nu există, se descarcă din magazin o dată și se păstrează.
 */
export async function catalogPhoto(db: Db, item: CatalogSheet, shopImageUrl: string | null): Promise<string | null> {
  const { data: saved } = await db
    .from("catalog_images")
    .select("mime, data_b64")
    .eq("catalog_item_id", item.id)
    .maybeSingle();
  if (saved) return dataUri(saved.mime as string, saved.data_b64 as string);

  for (const url of [item.image_url, shopImageUrl].filter((u): u is string => Boolean(u))) {
    const photo = await download(url);
    if (!photo) continue;
    // Se păstrează pentru toate ofertele următoare; dacă salvarea eșuează, poza tot intră în PDF-ul de acum.
    await db.rpc("save_catalog_image", {
      p_item: item.id,
      p_mime: photo.mime,
      p_data: photo.b64,
      p_source: "magazin",
      p_source_url: url,
    });
    return dataUri(photo.mime, photo.b64);
  }
  return null;
}

/** Poza unei linii libere, încărcată de mână pe ofertă. */
async function linePhoto(db: Db, quoteItemId: string): Promise<string | null> {
  const { data } = await db.from("quote_item_images").select("mime, data_b64").eq("quote_item_id", quoteItemId).maybeSingle();
  return data ? dataUri(data.mime as string, data.data_b64 as string) : null;
}

/** `sku` e codul produsului din catalog (Part N pe ofertă); null la liniile libere. */
export type QuoteSheet = { item: QuoteItem; image: string | null; specs: Spec[]; sku: string | null };

/**
 * Fișele tuturor produselor de pe ofertă, cu poza pusă direct în pagină
 * (data: URI), ca PDF-ul să nu depindă de magazin în momentul tipăririi.
 * `missing` spune ce produse n-au poză: cu ele oferta nu se generează.
 */
export async function loadQuoteSheets(db: Db, items: QuoteItem[]): Promise<{ sheets: QuoteSheet[]; missing: string[] }> {
  const catalogIds = [...new Set(items.map((i) => i.catalog_item_id).filter((x): x is string => Boolean(x)))];
  const { data } = catalogIds.length
    ? await db
        .from("catalog_items")
        .select("id, sku, tech_type, materials, details, shop_url, image_url")
        .in("id", catalogIds)
    : { data: [] };
  const catalog = new Map(((data ?? []) as CatalogSheet[]).map((c) => [c.id, c]));

  const sheets = await Promise.all(
    items.map(async (item): Promise<QuoteSheet> => {
      const cat = item.catalog_item_id ? (catalog.get(item.catalog_item_id) ?? null) : null;
      const { image: shopImageUrl, specs } = await productSheet(cat);
      // Serviciile (transport, instruire) nu au poză și nu o cer; o poză pusă de mână tot apare.
      const image = item.is_service
        ? await linePhoto(db, item.id)
        : cat
          ? await catalogPhoto(db, cat, shopImageUrl)
          : await linePhoto(db, item.id);
      return { item, image, specs, sku: cat?.sku ?? null };
    }),
  );

  return { sheets, missing: sheets.filter((s) => !s.image && !s.item.is_service).map((s) => s.item.name) };
}

/**
 * Verificarea rapidă, pentru pagina ofertei: ce produse sigur n-au poză (nici
 * păstrată, nici o adresă de unde să se descarce). Descărcarea propriu-zisă se
 * face la generarea PDF-ului.
 */
export async function photoStatus(db: Db, items: QuoteItem[]) {
  const catalogIds = [...new Set(items.map((i) => i.catalog_item_id).filter((x): x is string => Boolean(x)))];
  const [{ data: cat }, { data: saved }, { data: lines }] = await Promise.all([
    catalogIds.length
      ? db.from("catalog_items").select("id, shop_url, image_url").in("id", catalogIds)
      : Promise.resolve({ data: [] as { id: string; shop_url: string | null; image_url: string | null }[] }),
    catalogIds.length
      ? db.from("catalog_images").select("catalog_item_id").in("catalog_item_id", catalogIds)
      : Promise.resolve({ data: [] as { catalog_item_id: string }[] }),
    items.length
      ? db.from("quote_item_images").select("quote_item_id").in("quote_item_id", items.map((i) => i.id))
      : Promise.resolve({ data: [] as { quote_item_id: string }[] }),
  ]);
  const hasSaved = new Set((saved ?? []).map((r) => r.catalog_item_id as string));
  const hasLine = new Set((lines ?? []).map((r) => r.quote_item_id as string));
  const source = new Map((cat ?? []).map((c) => [c.id as string, Boolean(c.shop_url || c.image_url)]));

  return items.map((item) => ({
    item,
    status: item.is_service
      ? ("serviciu" as const)
      : item.catalog_item_id
      ? hasSaved.has(item.catalog_item_id)
        ? ("ok" as const)
        : source.get(item.catalog_item_id)
          ? ("din-magazin" as const)
          : ("lipsa" as const)
      : hasLine.has(item.id)
        ? ("ok" as const)
        : ("lipsa" as const),
  }));
}
