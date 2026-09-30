import sharp from "sharp";

import { fetchShop, readProductPage } from "@/lib/magazin-import";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Poza principală a produselor din catalog, descărcată din magazin la import.
 *
 * Pozele stau în baza de date (vezi `catalog_images`), deci se micșorează:
 * pentru o fișă de ofertă ajung 800 px, iar o poză de 3 MB din magazin ar
 * umple baza după câteva sute de produse. Fundalul transparent devine alb,
 * ca pe hârtie.
 */

const MAX_SIDE = 800;
const MAX_DOWNLOAD = 15 * 1024 * 1024;

export type PhotoResult = { id: string; name: string; ok: boolean; reason?: string };

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: { "user-agent": "Mozilla/5.0 (compatible; RomcreteOferte/1.0)", accept: "image/*" },
  });
  if (!res.ok) throw new Error(`poza nu se descarcă (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_DOWNLOAD) throw new Error("poza are o mărime neobișnuită");
  return bytes;
}

async function shrink(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

/** Poza unui produs: prima poză de pe pagina lui din magazin. Nu înlocuiește o poză existentă. */
export async function importPhoto(db: Db, item: { id: string; name: string; shop_url: string }): Promise<PhotoResult> {
  try {
    const page = await fetchShop(item.shop_url);
    if (!page) return { id: item.id, name: item.name, ok: false, reason: "pagina nu mai există în magazin" };
    const image = readProductPage(page.body, page.url).product?.image;
    if (!image) return { id: item.id, name: item.name, ok: false, reason: "pagina nu are poză" };
    const jpeg = await shrink(await download(image));
    const { error } = await db.rpc("save_catalog_image", {
      p_item: item.id,
      p_mime: "image/jpeg",
      p_data: jpeg.toString("base64"),
      p_source: "magazin",
      p_source_url: image,
    });
    if (error) return { id: item.id, name: item.name, ok: false, reason: error.message };
    return { id: item.id, name: item.name, ok: true };
  } catch (e) {
    return { id: item.id, name: item.name, ok: false, reason: e instanceof Error ? e.message : "eroare necunoscută" };
  }
}
