import { urlKey, type ShopProduct } from "@/lib/magazin-import";

/**
 * Planul importului: ce produse din magazin intră noi în catalog, ce poziții
 * existente își schimbă prețul sau primesc cod, ce poziții nu mai apar.
 *
 * Nu scrie nimic; rulează și în browser, ca previzualizarea să fie instantanee.
 *
 * Regulile care protejează catalogul:
 * - un produs se recunoaște întâi după cod, apoi după pagina lui din magazin;
 * - la pozițiile existente se schimbă doar prețul, codul lipsă și adresa lipsă —
 *   numele, categoria, materialele și fișa rămân cum le-a lăsat conducerea;
 * - fără preț în magazin, un preț pus de mână rămâne; altfel devine „la cerere”;
 * - nimic nu se șterge.
 */

/** Ce citește planul din catalogul existent. */
export type ExistingItem = {
  id: string;
  sku: string | null;
  name: string;
  category: string | null;
  shop_url: string | null;
  unit_price: number;
  vat_rate: number;
  price_on_request: boolean;
  price_with_vat: number | null;
  is_active: boolean;
  details: Record<string, unknown> | null;
};

/** O poziție de catalog așa cum iese din magazin: câte una pentru fiecare cod. */
export type ShopRow = {
  sku: string | null;
  name: string;
  /** Cu TVA, ca în magazin. */
  price: number | null;
  shop_url: string;
  aliases: string[];
  category: string;
  description: string | null;
  /** Poziția e o variantă de pe o pagină cu mai multe coduri. */
  variant: boolean;
};

export type NewItem = {
  sku: string | null;
  name: string;
  category: string;
  description: string | null;
  unit: string;
  unit_price: number;
  vat_rate: number;
  price_on_request: boolean;
  price_with_vat: number | null;
  shop_url: string;
  is_active: boolean;
};

export type ItemUpdate = {
  id: string;
  /** Doar coloanele care se schimbă. */
  changes: Partial<{
    sku: string;
    name: string;
    shop_url: string;
    unit_price: number;
    price_with_vat: number | null;
    price_on_request: boolean;
    details: Record<string, unknown>;
  }>;
  /** Pentru previzualizare: ce se schimbă, pe înțeles. */
  what: string[];
  name: string;
};

export type Deactivation = { id: string; name: string; sku: string | null; reason: string; suggested: boolean };

export type ImportPlan = {
  rows: number;
  inserts: NewItem[];
  updates: ItemUpdate[];
  /** Poziții găsite, fără nicio schimbare (doar se notează că au fost văzute). */
  unchanged: string[];
  deactivations: Deactivation[];
  /** Coduri găsite de două ori (același produs în două categorii): intră o singură dată. */
  duplicates: number;
};

const plain = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const skuKey = (sku: string | null | undefined) => (sku ? sku.trim().toUpperCase() : "");

export const withoutVat = (price: number, vatRate: number) => Math.round((price / (1 + vatRate / 100)) * 100) / 100;

/**
 * Categoria unui produs nou, din calea lui din magazin. Accesoriile păstrează
 * felul catalogului de acum („Accesorii — Duze”); o categorie care există deja
 * în catalog se scrie exact ca acolo.
 */
export function categoryFor(product: ShopProduct, known: string[]): string {
  let crumbs = product.breadcrumb;
  if (!crumbs.length) {
    // Fără firimituri: din adresă, /catalog/pompe-de-glet/… → „Pompe de glet”.
    const parts = new URL(product.url).pathname.split("/").filter(Boolean).slice(1, -1);
    crumbs = parts.map((p) => p.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()));
  }
  let category = crumbs[0] ?? "Diverse";
  if (/^accesori/i.test(plain(category)) && crumbs[1]) category = `Accesorii — ${crumbs[1]}`;
  const same = known.find((k) => plain(k) === plain(category));
  return same ?? category;
}

/** Produsele citite din magazin → rânduri de catalog, câte unul pe cod, fără dubluri. */
export function shopRows(products: ShopProduct[], knownCategories: string[]): { rows: ShopRow[]; duplicates: number } {
  const rows: ShopRow[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (const product of products) {
    const category = categoryFor(product, knownCategories);
    const candidates: ShopRow[] = product.variants.length
      ? product.variants.map((v) => ({
          sku: v.sku,
          name: v.name,
          price: v.price ?? (product.variants.length === 1 ? product.price : null),
          shop_url: product.url,
          aliases: product.aliases,
          category,
          description: product.description,
          variant: true,
        }))
      : [{ sku: product.sku, name: product.name, price: product.price, shop_url: product.url, aliases: product.aliases, category, description: product.description, variant: false }];

    for (const row of candidates) {
      // Același produs apare în magazin în mai multe categorii, cu adrese diferite.
      const key = row.sku ? `sku:${skuKey(row.sku)}` : `name:${plain(row.name)}`;
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      rows.push(row);
    }
  }
  return { rows, duplicates };
}

/** O poziție care strângea mai multe coduri într-una („Duze Graco XHD”, cu variantele în descriere). */
const isFamily = (item: ExistingItem) => Boolean(item.details && "variante" in item.details);

export function planImport(
  products: ShopProduct[],
  existing: ExistingItem[],
  orgVatRate: number,
  /** Toate adresele de produs văzute la import, și cele dublate în alte categorii. */
  seenUrls: string[],
): ImportPlan {
  const knownCategories = [...new Set(existing.map((e) => e.category).filter((c): c is string => Boolean(c)))];
  const { rows, duplicates } = shopRows(products, knownCategories);

  const bySku = new Map(existing.filter((e) => e.sku).map((e) => [skuKey(e.sku), e]));
  const byUrl = new Map<string, ExistingItem[]>();
  for (const e of existing) {
    const key = urlKey(e.shop_url);
    if (key) byUrl.set(key, [...(byUrl.get(key) ?? []), e]);
  }
  const matched = new Set<string>();
  const skusInUse = new Set(existing.map((e) => skuKey(e.sku)).filter(Boolean));

  const inserts: NewItem[] = [];
  const updates: ItemUpdate[] = [];
  const unchanged: string[] = [];

  for (const row of rows) {
    let item = row.sku ? bySku.get(skuKey(row.sku)) : undefined;
    if (item && matched.has(item.id)) item = undefined;
    if (!item) {
      // După pagină: o poziție fără cod de pe aceeași pagină, cu același nume sau singura de acolo.
      // Codul din magazin poate diferi de cel din catalog (un număr intern al magazinului):
      // singura poziție de pe pagină e tot produsul acesta.
      const onPage = [...new Set(row.aliases.flatMap((u) => byUrl.get(urlKey(u)) ?? []))].filter(
        (e) => !matched.has(e.id) && !isFamily(e),
      );
      item =
        onPage.find((e) => plain(e.name) === plain(row.name)) ??
        (!row.variant && onPage.length === 1 ? onPage[0] : undefined);
    }

    if (!item) {
      const price = row.price;
      inserts.push({
        // Un cod folosit deja de altă poziție nu se poate repeta; poziția nouă intră fără cod.
        sku: row.sku && !skusInUse.has(skuKey(row.sku)) ? row.sku : null,
        name: row.name.slice(0, 200),
        category: row.category,
        description: row.description,
        unit: "buc",
        unit_price: price ? withoutVat(price, orgVatRate) : 0,
        vat_rate: orgVatRate,
        price_on_request: !price,
        price_with_vat: price,
        shop_url: row.shop_url,
        is_active: true,
      });
      if (row.sku) skusInUse.add(skuKey(row.sku));
      continue;
    }

    matched.add(item.id);
    const changes: ItemUpdate["changes"] = {};
    const what: string[] = [];

    if (row.price) {
      const net = withoutVat(row.price, item.vat_rate);
      if (item.price_on_request || Math.abs(net - Number(item.unit_price)) >= 0.01) {
        what.push(
          item.price_on_request || !Number(item.unit_price)
            ? `preț nou: ${row.price} lei cu TVA`
            : `preț ${item.price_with_vat ?? "?"} → ${row.price} lei cu TVA`,
        );
        changes.unit_price = net;
        changes.price_with_vat = row.price;
        changes.price_on_request = false;
      }
    } else if (!item.price_on_request && !Number(item.unit_price)) {
      changes.price_on_request = true;
      what.push("preț la cerere");
    }

    if (!item.sku && row.sku && !skusInUse.has(skuKey(row.sku))) {
      changes.sku = row.sku;
      skusInUse.add(skuKey(row.sku));
      what.push(`cod ${row.sku}`);
    } else if (item.sku && row.sku && skuKey(item.sku) !== skuKey(row.sku)) {
      // Codul din catalog nu se schimbă singur: vizitele și ofertele îl folosesc.
      what.push(`atenție: în magazin codul e ${row.sku}, în catalog ${item.sku}`);
    }
    if (!item.shop_url) {
      changes.shop_url = row.shop_url;
      what.push("adresa din magazin");
    }
    // O familie de coduri devine poziția codului ei; celelalte coduri intră separat.
    if (isFamily(item) && row.variant) {
      const details = { ...(item.details ?? {}) };
      delete details.variante;
      delete details.pret_magazin_min;
      changes.details = details;
      changes.name = row.name.slice(0, 200);
      what.push(`familia „${item.name}” devine „${row.name}”`);
    }

    if (what.length) updates.push({ id: item.id, changes, what, name: item.name });
    else unchanged.push(item.id);
  }

  // Ce n-a fost găsit: nici după cod, nici după pagină.
  const seen = new Set([...seenUrls, ...products.flatMap((p) => p.aliases)].map(urlKey));
  const deactivations: Deactivation[] = [];
  for (const item of existing) {
    if (matched.has(item.id) || !item.is_active) continue;
    if (isFamily(item) && seen.has(urlKey(item.shop_url))) {
      deactivations.push({
        id: item.id,
        name: item.name,
        sku: item.sku,
        reason: "familie de coduri înlocuită de câte o poziție pe cod",
        suggested: true,
      });
    } else if (item.shop_url && !seen.has(urlKey(item.shop_url))) {
      deactivations.push({ id: item.id, name: item.name, sku: item.sku, reason: "nu mai apare în magazin", suggested: false });
    }
  }

  return { rows: rows.length, inserts, updates, unchanged, deactivations, duplicates };
}
