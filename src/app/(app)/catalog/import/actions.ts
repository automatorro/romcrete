"use server";

import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import type { ItemUpdate, NewItem } from "@/lib/catalog-import";
import {
  SHOP_ORIGIN,
  catalogUrl,
  extractLinks,
  fetchShop,
  readProductPage,
  sitemapLocs,
  type PageReading,
  type ShopProduct,
} from "@/lib/magazin-import";
import { importPhoto, type PhotoResult } from "@/lib/magazin-poze";
import { createClient } from "@/lib/supabase/server";

/** Importul îl face doar conducerea: el schimbă catalogul tuturor. */
async function requireManagement() {
  const context = await requireOrg();
  if (context.role === "agent") throw new Error("Importul catalogului îl face doar conducerea.");
  return context;
}

/**
 * Câte pagini se citesc deodată. Magazinul are un limitator care răspunde la
 * cereri dese cu o pagină de așteptare de 5 secunde; mai multe în paralel doar
 * înseamnă mai multe așteptări.
 */
const PARALLEL = 3;

async function inParallel<T, R>(list: T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await work(list[i]);
      }
    }),
  );
  return out;
}

/** De unde pornește inventarul: catalogul, prima pagină, sitemap-ul și paginile știute deja. */
export async function importSeeds(): Promise<{ urls: string[]; notes: string[] }> {
  const { orgId } = await requireManagement();
  const urls = new Set<string>([`${SHOP_ORIGIN}/catalog`]);
  const notes: string[] = [];

  const home = await fetchShop(`${SHOP_ORIGIN}/`).catch(() => null);
  if (home) extractLinks(home.body, home.url).forEach((u) => urls.add(u));
  else notes.push("Prima pagină a magazinului nu a răspuns.");

  // Sitemap-ul, dacă magazinul îl are: din robots.txt sau de la adresele obișnuite.
  const robots = await fetchShop(`${SHOP_ORIGIN}/robots.txt`, "text/plain").catch(() => null);
  const maps = new Set<string>([`${SHOP_ORIGIN}/sitemap.xml`]);
  for (const m of robots?.body.matchAll(/^\s*sitemap:\s*(\S+)/gim) ?? []) maps.add(m[1]);
  const queue = [...maps];
  for (let i = 0; i < queue.length && i < 30; i++) {
    const map = await fetchShop(queue[i], "application/xml,text/xml").catch(() => null);
    if (!map) continue;
    for (const loc of sitemapLocs(map.body)) {
      if (/\.xml(\.gz)?$/i.test(loc) && loc.startsWith(SHOP_ORIGIN)) queue.push(loc);
      else {
        const url = catalogUrl(loc);
        if (url) urls.add(url);
      }
    }
  }
  if (urls.size > 1) notes.push(`${urls.size} adrese de pornire (prima pagină și sitemap).`);

  // Produsele din catalog se verifică oricum, chiar dacă nu mai au legătură din meniu.
  const supabase = await createClient();
  const { data } = await supabase.from("catalog_items").select("shop_url").eq("org_id", orgId).not("shop_url", "is", null);
  for (const row of data ?? []) {
    const url = catalogUrl(row.shop_url as string);
    if (url) urls.add(url);
  }

  return { urls: [...urls], notes };
}

export type CrawledPage = { url: string; product: ShopProduct | null; links: string[]; error?: string; gone?: boolean };

/** Citește câteva pagini: ce produs e pe fiecare și ce legături are mai departe. */
export async function importCrawl(urls: string[]): Promise<CrawledPage[]> {
  await requireManagement();
  const safe = urls.slice(0, 8).map((u) => catalogUrl(u)).filter((u): u is string => Boolean(u));
  return inParallel(safe, async (url): Promise<CrawledPage> => {
    try {
      const page = await fetchShop(url);
      if (!page) return { url, product: null, links: [], gone: true };
      return { url, product: readProductPage(page.body, page.url).product, links: extractLinks(page.body, page.url) };
    } catch (e) {
      return { url, product: null, links: [], error: e instanceof Error ? e.message : "eroare" };
    }
  });
}

/** O singură pagină, cu tot ce a înțeles robotul din ea: pentru verificare înainte de import. */
export async function importTestPage(url: string): Promise<{ reading?: PageReading; links?: number; error?: string }> {
  await requireManagement();
  const safe = catalogUrl(url);
  if (!safe) return { error: `Adresa trebuie să fie din catalogul magazinului (${SHOP_ORIGIN}/catalog/…).` };
  try {
    const page = await fetchShop(safe);
    if (!page) return { error: "Pagina nu există (404)." };
    return { reading: readProductPage(page.body, page.url), links: extractLinks(page.body, page.url).length };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Pagina nu s-a putut citi." };
  }
}

// ------------------------------------------------------------ scrierea în catalog

const UPDATE_KEYS = ["sku", "name", "shop_url", "unit_price", "price_with_vat", "price_on_request", "details"] as const;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null);
const txt = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

function cleanInsert(item: NewItem, orgId: string, now: string) {
  const name = txt(item.name, 200);
  const shopUrl = catalogUrl(String(item.shop_url ?? ""));
  if (!name || !shopUrl) return null;
  return {
    org_id: orgId,
    sku: txt(item.sku, 40),
    name,
    category: txt(item.category, 120),
    description: txt(item.description, 600),
    unit: "buc",
    unit_price: num(item.unit_price) ?? 0,
    vat_rate: num(item.vat_rate) ?? 21,
    price_on_request: Boolean(item.price_on_request),
    price_with_vat: num(item.price_with_vat),
    shop_url: shopUrl,
    is_active: true,
    shop_seen_at: now,
  };
}

export type ApplyResult = { inserted: number; updated: number; deactivated: number; errors: string[] };

/** Scrie o parte din plan. Se cheamă de mai multe ori, cu câte un calup. */
export async function importApply(input: {
  inserts: NewItem[];
  updates: ItemUpdate[];
  seen: string[];
  deactivate: string[];
}): Promise<ApplyResult> {
  const { orgId } = await requireManagement();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const result: ApplyResult = { inserted: 0, updated: 0, deactivated: 0, errors: [] };

  const rows = input.inserts.slice(0, 50).map((i) => cleanInsert(i, orgId, now)).filter((r) => r !== null);
  if (rows.length) {
    const { error } = await supabase.from("catalog_items").insert(rows);
    if (!error) result.inserted += rows.length;
    else {
      // Un cod dublat oprește tot calupul: pozițiile intră una câte una, cea cu problema fără cod.
      for (const row of rows) {
        let { error: one } = await supabase.from("catalog_items").insert(row);
        if (one?.code === "23505" && row.sku) ({ error: one } = await supabase.from("catalog_items").insert({ ...row, sku: null }));
        if (one) result.errors.push(`${row.name}: ${one.message}`);
        else result.inserted++;
      }
    }
  }

  for (const update of input.updates.slice(0, 50)) {
    const changes: Record<string, unknown> = { shop_seen_at: now };
    for (const key of UPDATE_KEYS) if (key in update.changes) changes[key] = update.changes[key];
    const { error } = await supabase.from("catalog_items").update(changes).eq("id", update.id).eq("org_id", orgId);
    if (error) result.errors.push(`${update.name}: ${error.message}`);
    else result.updated++;
  }

  const seen = input.seen.slice(0, 500);
  if (seen.length) {
    await supabase.from("catalog_items").update({ shop_seen_at: now }).in("id", seen).eq("org_id", orgId);
  }

  const off = input.deactivate.slice(0, 200);
  if (off.length) {
    const { error, count } = await supabase
      .from("catalog_items")
      .update({ is_active: false }, { count: "exact" })
      .in("id", off)
      .eq("org_id", orgId);
    if (error) result.errors.push(`Dezactivare: ${error.message}`);
    else result.deactivated += count ?? off.length;
  }

  revalidatePath("/catalog");
  return result;
}

// ------------------------------------------------------------ pozele

/** Descarcă pozele lipsă, câte câteva. `skip` = produsele la care n-a mers, ca să nu se reîncerce la nesfârșit. */
export async function importPhotos(skip: string[]): Promise<{ results: PhotoResult[]; remaining: number }> {
  const { orgId } = await requireManagement();
  const supabase = await createClient();
  const [{ data: items }, { data: photos }] = await Promise.all([
    supabase
      .from("catalog_items")
      .select("id, name, shop_url")
      .eq("org_id", orgId)
      .eq("is_service", false)
      .not("shop_url", "is", null)
      .order("category")
      .order("name"),
    supabase.from("catalog_images").select("catalog_item_id").eq("org_id", orgId),
  ]);
  const has = new Set((photos ?? []).map((p) => p.catalog_item_id as string));
  const skipped = new Set(skip);
  const missing = (items ?? []).filter((i) => !has.has(i.id as string) && !skipped.has(i.id as string)) as {
    id: string;
    name: string;
    shop_url: string;
  }[];

  const batch = missing.slice(0, PARALLEL);
  const results = await inParallel(batch, (item) => importPhoto(supabase, item));
  return { results, remaining: missing.length - results.length };
}
