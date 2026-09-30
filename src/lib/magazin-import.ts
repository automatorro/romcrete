import { parse, type HTMLElement } from "node-html-parser";

/**
 * Robotul care citește magazinul pentru importul catalogului: găsește paginile
 * de produs și scoate din fiecare numele, codul, prețul, poza și variantele.
 *
 * Nu depinde de o platformă anume de magazin. Citește, în ordinea încrederii:
 * datele structurate ale paginii (JSON-LD, cele pentru Google), variantele
 * WooCommerce, etichetele meta, apoi textul vizibil („Cod produs: …”, „… lei”).
 * Ce nu găsește rămâne gol: un preț lipsă devine „preț la cerere”, un cod
 * lipsă se afișează „la cerere”. Nu inventează.
 */

export const SHOP_ORIGIN = "https://shop.romcrete.ro";

/** O variantă de pe pagina produsului: de regulă un cod cu prețul lui (o duză, o mărime de furtun). */
export type ShopVariant = { sku: string | null; name: string; price: number | null };

export type ShopProduct = {
  /** Adresa produsului (cea canonică, dacă pagina o spune). */
  url: string;
  /** Toate adresele la care a fost găsit (același produs stă în mai multe categorii). */
  aliases: string[];
  name: string;
  sku: string | null;
  /** Prețul din magazin, cu TVA; null = fără preț în magazin. */
  price: number | null;
  /** Calea din magazin, fără „Acasă” și fără produs: ["Accesorii", "Duze"]. */
  breadcrumb: string[];
  image: string | null;
  description: string | null;
  /** Două sau mai multe coduri pe aceeași pagină; altfel gol. */
  variants: ShopVariant[];
};

// ------------------------------------------------------------ adrese

const SKIP_PATH = /\/(cos|cart|checkout|cont|account|login|logare|register|inregistrare|wishlist|favorite|compar|cautare|search)\b/i;
const SKIP_FILE = /\.(jpe?g|png|gif|webp|svg|pdf|docx?|xlsx?|zip|mp4|css|js|xml|ico)$/i;
const PAGE_PARAM = /^(page|p|pagina|pg)$/i;

/** Adresa unei pagini din catalogul magazinului, curățată; null dacă nu ține de catalog. */
export function catalogUrl(href: string, base: string = SHOP_ORIGIN): string | null {
  let url: URL;
  try {
    url = new URL(href.replace(/&amp;/g, "&").trim(), base);
  } catch {
    return null;
  }
  if (url.origin !== SHOP_ORIGIN) return null;
  if (!url.pathname.startsWith("/catalog")) return null;
  if (SKIP_PATH.test(url.pathname) || SKIP_FILE.test(url.pathname)) return null;
  url.hash = "";
  // Din parametri rămâne doar numărul paginii din listă; filtrele și sortările dublează paginile.
  const kept = [...url.searchParams.entries()].filter(([k, v]) => PAGE_PARAM.test(k) && /^\d{1,3}$/.test(v));
  url.search = "";
  for (const [k, v] of kept) if (v !== "1") url.searchParams.set(k, v);
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

/** Aceeași pagină, indiferent de „/” final sau de litere mari: cheia după care se compară adresele. */
export function urlKey(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return `${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Legăturile din pagină către alte pagini din catalog. */
export function extractLinks(html: string, base: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*?\shref\s*=\s*["']([^"'#][^"']*)["']/gi)) {
    const url = catalogUrl(m[1], base);
    if (url) found.add(url);
  }
  return [...found];
}

/** Adresele dintr-un sitemap (sau dintr-un index de sitemap-uri). */
export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) =>
    m[1].replace(/&amp;/g, "&"),
  );
}

// ------------------------------------------------------------ citirea paginii

/** Pagina din magazin, proaspătă (fără cache), cu o reîncercare. */
export async function fetchShop(url: string, accept = "text/html"): Promise<{ body: string; url: string } | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; RomcreteOferte/1.0)", accept },
      });
      if (res.status === 404 || res.status === 410) return null;
      if (res.ok) return { body: await res.text(), url: res.url || url };
    } catch {
      // încercăm încă o dată
    }
    await new Promise((r) => setTimeout(r, 700 * attempt));
  }
  throw new Error(`Pagina nu răspunde: ${url}`);
}

// ------------------------------------------------------------ text și prețuri

const ENTITY: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", deg: "°",
  acirc: "â", Acirc: "Â", icirc: "î", Icirc: "Î", abreve: "ă", Abreve: "Ă", ndash: "–", mdash: "—",
};

export function cleanText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, name) => ENTITY[name] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

const plain = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Un preț scris românește sau englezește: „1.234,56 lei”, „43.900 lei”,
 * „270,00”, „43900.00”. Întoarce null pentru zero sau text fără cifre.
 */
export function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
  if (typeof value !== "string") return null;
  let s = value.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Ultimul separator e cel zecimal.
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    s = s.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    // „270,00” = zecimale; „43,900” = mii.
    s = /,\d{1,2}$/.test(s) ? s.replace(/,/g, (m, i) => (i === lastComma ? "." : "")) : s.replace(/,/g, "");
  } else if (lastDot >= 0) {
    // „43.900” și „1.234.567” = mii; „43900.00” și „12.5” = zecimale.
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    else s = s.replace(/\.(?=.*\.)/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** Un cod de produs arată ca „17N353”, „2012262”, „XHD107”, „24F-853”: are cifre și nu e un cuvânt. */
export function looksLikeSku(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return /^[A-Z0-9][A-Z0-9\-./]{2,23}$/i.test(v) && /\d/.test(v) && !/^\d{1,3}$/.test(v) && !/^\d+[.,]\d+$/.test(v);
}

const skuOf = (value: unknown): string | null => {
  const v = typeof value === "number" ? String(value) : value;
  return looksLikeSku(v) ? v.trim().toUpperCase() : null;
};

// ------------------------------------------------------------ date structurate

type Json = Record<string, unknown>;

/** Toate obiectele JSON-LD din pagină, cu @graph desfăcut. */
function jsonLd(root: HTMLElement): Json[] {
  const out: Json[] = [];
  const add = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(add);
    else if (node && typeof node === "object") {
      out.push(node as Json);
      const graph = (node as Json)["@graph"];
      if (graph) add(graph);
    }
  };
  for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      add(JSON.parse(script.textContent.trim()));
    } catch {
      // bloc invalid: mergem mai departe
    }
  }
  return out;
}

const typeIs = (node: Json, name: string) => {
  const t = node["@type"];
  return (Array.isArray(t) ? t : [t]).some((x) => String(x).toLowerCase() === name);
};

const str = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return cleanText(value);
  if (typeof value === "number") return String(value);
  return null;
};

const firstImage = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return firstImage(value[0]);
  if (value && typeof value === "object") return str((value as Json).url) ?? str((value as Json).contentUrl);
  return null;
};

/** Prețul dintr-o ofertă JSON-LD: price, lowPrice sau priceSpecification. */
function offerPrice(offer: unknown): number | null {
  if (!offer || typeof offer !== "object") return null;
  const o = offer as Json;
  const spec = Array.isArray(o.priceSpecification) ? o.priceSpecification[0] : o.priceSpecification;
  return parsePrice(o.price) ?? parsePrice(o.lowPrice) ?? parsePrice((spec as Json | undefined)?.price);
}

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : value ? [value] : []);

// ------------------------------------------------------------ pagina de produs

const meta = (root: HTMLElement, key: string) =>
  root.querySelector(`meta[property="${key}"]`)?.getAttribute("content") ??
  root.querySelector(`meta[name="${key}"]`)?.getAttribute("content") ??
  null;

/** Numele site-ului pus la coada titlului: „… - Pompe de zugravit - Romcrete”. */
const stripSiteName = (title: string) => title.replace(/\s+[-|–]\s+(romcrete|shop\.romcrete\.ro).*$/i, "").trim();

const ADD_TO_CART = /(adaug[aă]\s*(?:[iî]n)?\s*co[sș]|add[-_ ]to[-_ ]cart|cump[aă]r[aă] acum)/gi;

/** Calea din magazin, din JSON-LD sau din firimiturile paginii. */
function breadcrumbOf(root: HTMLElement, nodes: Json[], productName: string): string[] {
  let names: string[] = [];
  const list = nodes.find((n) => typeIs(n, "breadcrumblist"));
  if (list) {
    names = asList(list.itemListElement)
      .map((el) => el as Json)
      .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
      .map((el) => str(el.name) ?? str((el.item as Json | undefined)?.name) ?? "")
      .filter(Boolean);
  }
  if (!names.length) {
    const nav =
      root.querySelector('[itemtype*="BreadcrumbList"]') ??
      root.querySelector('nav[aria-label*="breadcrumb" i]') ??
      root.querySelector(".breadcrumb, .breadcrumbs, #breadcrumb, #breadcrumbs, .woocommerce-breadcrumb");
    if (nav) {
      const items = nav.querySelectorAll("li, a, span[itemprop=name]");
      names = items.map((el) => cleanText(el.textContent)).filter((t) => t && t.length < 80);
      names = names.filter((t, i) => names.indexOf(t) === i);
    }
  }
  const product = plain(productName);
  return names.filter((name) => {
    const p = plain(name);
    return p && p !== product && !/^(acasa|home|prima pagina|romcrete|shop|magazin|catalog|catalog produse|produse)$/.test(p);
  });
}

/** Variantele dintr-un formular WooCommerce: data-product_variations="[…]". */
function wooVariants(root: HTMLElement, baseName: string): ShopVariant[] {
  const form = root.querySelector("[data-product_variations]");
  const raw = form?.getAttribute("data-product_variations");
  if (!raw || raw === "false") return [];
  try {
    const list = JSON.parse(raw.replace(/&quot;/g, '"').replace(/&amp;/g, "&")) as Json[];
    return list.map((v) => {
      const attrs = Object.values((v.attributes as Json) ?? {}).map((x) => str(x)).filter(Boolean);
      const sku = skuOf(v.sku);
      return {
        sku,
        name: [baseName, ...attrs].join(" — ") || baseName,
        price: parsePrice(v.display_price) ?? parsePrice(v.price),
      };
    });
  } catch {
    return [];
  }
}

/** Variantele dintr-un select: opțiuni cu cod (în text sau data-sku) și, eventual, preț (data-price). */
function selectVariants(root: HTMLElement, baseName: string): ShopVariant[] {
  for (const select of root.querySelectorAll("select")) {
    const options = select.querySelectorAll("option").filter((o) => (o.getAttribute("value") ?? "").trim() !== "");
    if (options.length < 2) continue;
    const variants = options.map((o) => {
      const text = cleanText(o.textContent);
      const sku = skuOf(o.getAttribute("data-sku")) ?? skuOf(text.split(/[\s–—-]+/)[0]) ?? skuOf(text);
      return {
        sku,
        name: text.includes(baseName) ? text : `${baseName} — ${text}`,
        price: parsePrice(o.getAttribute("data-price") ?? "") ?? (/lei|ron/i.test(text) ? parsePrice(text.replace(/^.*?(\d[\d.,\s]*)\s*(lei|ron).*$/i, "$1")) : null),
      };
    });
    // Un select de cantitate sau de sortare nu are coduri.
    if (variants.filter((v) => v.sku).length >= 2) return variants;
  }
  return [];
}

/** Variantele dintr-un tabel: rânduri cu un cod și, eventual, un preț în lei. */
function tableVariants(root: HTMLElement, baseName: string): ShopVariant[] {
  for (const table of root.querySelectorAll("table")) {
    const rows = table.querySelectorAll("tr");
    const header = rows[0] ? plain(rows[0].querySelectorAll("th, td").map((c) => c.textContent).join(" ")) : "";
    if (!/\b(cod|sku|part|referinta)\b/.test(header)) continue;
    const variants: ShopVariant[] = [];
    for (const row of rows.slice(1)) {
      const cells = row.querySelectorAll("td, th").map((c) => cleanText(c.textContent));
      const sku = cells.map(skuOf).find(Boolean) ?? null;
      if (!sku) continue;
      const priceCell = cells.find((c) => /lei|ron/i.test(c));
      const rest = cells.filter((c) => c && skuOf(c) !== sku && c !== priceCell).join(" · ");
      variants.push({ sku, name: rest ? `${baseName} — ${sku} (${rest})` : `${baseName} — ${sku}`, price: priceCell ? parsePrice(priceCell) : null });
    }
    if (variants.length >= 2) return variants;
  }
  return [];
}

/** Textul paginii după titlul produsului, fără meniuri și scripturi: acolo stau codul și prețul. */
function mainText(html: string): string {
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<(header|footer|nav)\b[\s\S]*?<\/\1>/gi, " ");
  const h1 = body.search(/<h1\b/i);
  return cleanText(h1 >= 0 ? body.slice(h1, h1 + 60_000) : body);
}

const SKU_LABEL = /(?:cod\s*(?:produs|articol|graco|part)?|sku|part\s*(?:no|nr|number|n)?\.?|referin[țţt][aă]|nr\.?\s*articol)\s*[:#.]?\s*([A-Z0-9][A-Z0-9\-./]{2,23})/i;
const PRICE_TEXT = /(?<![\d.,])(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:lei|ron)\b/i;

export type PageReading = {
  /** Produsul de pe pagină; null = pagina e o listă, o categorie sau altceva. */
  product: ShopProduct | null;
  /** De ce e (sau nu e) pagină de produs, pentru verificarea de mână. */
  signals: string[];
};

/** Citește o pagină din magazin: e pagină de produs? dacă da, ce produs. */
export function readProductPage(html: string, pageUrl: string): PageReading {
  let root: HTMLElement;
  try {
    root = parse(html, { comment: false, blockTextElements: { script: true, style: false, pre: true } });
  } catch {
    return { product: null, signals: ["pagina nu s-a putut citi"] };
  }
  const nodes = jsonLd(root);
  const ld = nodes.find((n) => typeIs(n, "product") || typeIs(n, "productgroup"));
  const ogType = (meta(root, "og:type") ?? "").toLowerCase();
  const metaPrice = meta(root, "product:price:amount") ?? meta(root, "og:price:amount");
  const itemprop = root.querySelector('[itemtype*="schema.org/Product" i]');
  const h1s = root.querySelectorAll("h1");
  const carts = (html.match(ADD_TO_CART) ?? []).length;
  const text = mainText(html);
  const skuInText = text.match(SKU_LABEL)?.[1] ?? null;

  const signals: string[] = [];
  if (ld) signals.push("JSON-LD Product");
  if (ogType.includes("product")) signals.push("og:type product");
  if (metaPrice) signals.push("meta preț");
  if (itemprop) signals.push("microdata Product");
  if (skuInText) signals.push(`cod în text (${skuInText})`);
  signals.push(`${h1s.length}× h1, ${carts}× „adaugă în coș”`);

  // O listă de produse are multe butoane de coș; un produs are unul (sau două, sus și jos).
  const isProduct =
    Boolean(ld) || ogType.includes("product") || Boolean(metaPrice) ||
    (h1s.length === 1 && carts >= 1 && carts <= 3 && (Boolean(itemprop) || Boolean(skuInText)));
  if (!isProduct) return { product: null, signals };

  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const url = (canonical && catalogUrl(canonical, pageUrl)) || catalogUrl(pageUrl) || pageUrl;

  const name =
    str(ld?.name) ??
    (h1s[0] ? cleanText(h1s[0].textContent) : null) ??
    stripSiteName(cleanText(meta(root, "og:title") ?? root.querySelector("title")?.textContent ?? ""));
  if (!name) return { product: null, signals: [...signals, "fără nume"] };

  const offers = asList(ld?.offers).flatMap((o) => {
    const offer = o as Json;
    // AggregateOffer poate avea ofertele înăuntru.
    return offer?.offers ? asList(offer.offers) : [offer];
  }) as Json[];

  // Variantele, de la sursa cea mai sigură la cea mai fragilă.
  let variants: ShopVariant[] = [];
  const ldVariants = asList(ld?.hasVariant).filter((v) => v && typeof v === "object") as Json[];
  if (ldVariants.length >= 2) {
    variants = ldVariants.map((v) => ({
      sku: skuOf(v.sku) ?? skuOf(v.mpn) ?? skuOf(v.productID),
      name: str(v.name) ?? name,
      price: asList(v.offers).map(offerPrice).find((p) => p !== null) ?? null,
    }));
  } else if (offers.length >= 2 && offers.some((o) => skuOf(o.sku) || str(o.name))) {
    variants = offers.map((o) => ({
      sku: skuOf(o.sku) ?? skuOf(o.mpn),
      name: str(o.name) ? `${name} — ${str(o.name)}` : name,
      price: offerPrice(o),
    }));
  }
  if (variants.length < 2) variants = wooVariants(root, name);
  if (variants.length < 2) variants = selectVariants(root, name);
  if (variants.length < 2) variants = tableVariants(root, name);
  // Două variante cu același cod nu sunt variante, ci aceeași poziție scrisă de două ori.
  const distinct = new Set(variants.map((v) => v.sku ?? plain(v.name)));
  if (variants.length < 2 || distinct.size < 2) variants = [];
  if (variants.length) signals.push(`${variants.length} variante`);

  const itempropSku = root.querySelector('[itemprop="sku"]');
  const sku =
    skuOf(ld?.sku) ?? skuOf(ld?.mpn) ?? skuOf(ld?.productID) ??
    skuOf(itempropSku?.getAttribute("content") ?? itempropSku?.textContent) ??
    skuOf(skuInText);

  const itempropPrice = root.querySelector('[itemprop="price"]');
  const price =
    offers.map(offerPrice).find((p) => p !== null) ??
    parsePrice(metaPrice ?? "") ??
    parsePrice(itempropPrice?.getAttribute("content") ?? itempropPrice?.textContent ?? "") ??
    parsePrice(text.match(PRICE_TEXT)?.[1] ?? "") ??
    // Fără preț pe pagină, dar cu variante: cel mai mic preț, ca în magazin („de la …”).
    (variants.some((v) => v.price) ? Math.min(...variants.flatMap((v) => (v.price ? [v.price] : []))) : null);

  let image = firstImage(ld?.image) ?? meta(root, "og:image") ?? meta(root, "twitter:image");
  if (image) {
    try {
      image = new URL(image.replace(/&amp;/g, "&"), pageUrl).toString();
    } catch {
      image = null;
    }
  }

  const description = str(ld?.description) ?? str(meta(root, "og:description")) ?? str(meta(root, "description"));

  return {
    product: {
      url,
      aliases: [...new Set([url, catalogUrl(pageUrl) ?? pageUrl])],
      name,
      sku,
      price,
      breadcrumb: breadcrumbOf(root, nodes, name),
      image,
      description: description ? description.slice(0, 600) : null,
      variants,
    },
    signals,
  };
}
