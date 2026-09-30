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

/**
 * Găzduirea magazinului are un limitator: la cereri dese răspunde, la
 * întâmplare, cu o pagină „One moment, please...” (tot cu cod 200) care se
 * reîncarcă singură după 5 secunde. Nu e pagina cerută: se așteaptă și se reia.
 */
export const isWaitPage = (html: string) => /<title>\s*One moment, please/i.test(html.slice(0, 2000));

const WAIT_MS = 5_500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pagina din magazin, proaspătă (fără cache), trecută de pagina de așteptare. */
export async function fetchShop(url: string, accept = "text/html"): Promise<{ body: string; url: string } | null> {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; RomcreteOferte/1.0)", accept },
      });
      if (res.status === 404 || res.status === 410) return null;
      if (res.ok) {
        const body = await res.text();
        if (!isWaitPage(body)) return { body, url: res.url || url };
        await sleep(WAIT_MS);
        continue;
      }
    } catch {
      // încercăm din nou
    }
    await sleep(1000 * attempt);
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


// ------------------------------------------------------------ pagina de produs

const meta = (root: HTMLElement, key: string) =>
  root.querySelector(`meta[property="${key}"]`)?.getAttribute("content") ??
  root.querySelector(`meta[name="${key}"]`)?.getAttribute("content") ??
  null;

const absolute = (src: string | null | undefined, base: string): string | null => {
  if (!src) return null;
  try {
    const url = new URL(src.replace(/&amp;/g, "&").trim(), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/** Calea din magazin: firimiturile de sus, fără „Home”, „Categorii” și produsul însuși. */
function breadcrumbOf(root: HTMLElement): string[] {
  return root
    .querySelectorAll(".breadcrumbTop li a")
    .map((a) => cleanText(a.textContent))
    .filter((name) => name && !/^(home|acasa|categorii|catalog)$/.test(plain(name)));
}

/**
 * Codul din „Cod produs: …”. Magazinul pune „00000” la produsele fără cod și
 * „HDA...” la paginile care strâng mai multe coduri (prefixul lor comun).
 */
function readCode(raw: string): { sku: string | null; prefix: string | null } {
  const code = cleanText(raw).replace(/^cod\s*produs\s*:?\s*/i, "").trim();
  const family = code.match(/^([A-Z0-9-]{1,10})\s*(?:\.{2,}|…)$/i);
  if (family) return { sku: null, prefix: family[1].toUpperCase() };
  if (!code || /^0+$/.test(code)) return { sku: null, prefix: null };
  return { sku: looksLikeSku(code) ? code.toUpperCase() : null, prefix: null };
}

/**
 * Variantele: selectul din formularul de coș. La o pagină „HDA...” fiecare
 * opțiune e un orificiu, deci un cod (HDA835, HDA833…), cu prețul paginii. Alte
 * selecturi (o culoare, o mărime fără cod) nu fac coduri noi și se ignoră.
 */
function readVariants(intro: HTMLElement, name: string, prefix: string | null, price: number | null): ShopVariant[] {
  for (const select of intro.querySelectorAll("form select")) {
    const options = select
      .querySelectorAll("option")
      .map((o) => cleanText(o.textContent))
      .filter(Boolean);
    if (options.length < 2) continue;
    const codes = options.map((o) => {
      const compact = o.replace(/\s+/g, "").toUpperCase();
      if (prefix) return compact.startsWith(prefix) ? compact : `${prefix}${compact}`;
      return /[A-Z]/i.test(compact) && looksLikeSku(compact) ? compact : null;
    });
    if (codes.some((c) => !c || !looksLikeSku(c))) continue;
    return [...new Set(codes as string[])].map((sku) => ({ sku, name: `${name} — ${sku}`, price }));
  }
  return [];
}

/** Prețul din zona produsului: cel redus dacă e promoție; null la „Preț disponibil la cerere”. */
function readPrice(intro: HTMLElement): number | null {
  const current = intro.querySelector(".priceNew") ?? intro.querySelector(".price:not(.productNotAvailable):not(.priceOld)");
  if (!current || current.classList.contains("productNotAvailable")) return null;
  return parsePrice(cleanText(current.textContent).replace(/lei|ron/gi, ""));
}

export type PageReading = {
  /** Produsul de pe pagină; null = pagina e o listă, o categorie sau altceva. */
  product: ShopProduct | null;
  /** Ce a găsit robotul pe pagină, pentru verificarea de mână. */
  signals: string[];
};

/** Citește o pagină din magazin: e pagină de produs? dacă da, ce produs. */
export function readProductPage(html: string, pageUrl: string): PageReading {
  if (isWaitPage(html)) return { product: null, signals: ["pagina de așteptare a magazinului („One moment”)"] };
  let root: HTMLElement;
  try {
    root = parse(html, { comment: false, blockTextElements: { script: false, style: false, pre: true } });
  } catch {
    return { product: null, signals: ["pagina nu s-a putut citi"] };
  }

  // Pagina de produs are zona „productDetails” cu titlul, codul și prețul; listele au doar carduri.
  const intro = root.querySelector("article.produsIntro") ?? root.querySelector(".productDetails .introContainer");
  const title = intro?.querySelector("h1.title") ?? intro?.querySelector("h1");
  const ogType = (meta(root, "og:type") ?? "").toLowerCase();
  const signals: string[] = [];
  if (ogType) signals.push(`og:type ${ogType}`);
  signals.push(intro ? "zonă de produs" : "fără zonă de produs");
  if (!intro || !title) return { product: null, signals };

  const name = cleanText(title.textContent);
  if (!name) return { product: null, signals: [...signals, "fără nume"] };

  const codeEl = intro.querySelector(".codProdus");
  const { sku, prefix } = readCode(codeEl?.querySelector("span")?.textContent ?? codeEl?.textContent ?? "");
  const price = readPrice(intro);
  const variants = readVariants(intro, name, prefix, price);
  signals.push(`cod: ${sku ?? (prefix ? `${prefix}… (familie)` : "fără")}`, `preț: ${price ?? "la cerere"}`);
  if (variants.length) signals.push(`${variants.length} coduri în select`);

  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const url = (canonical && catalogUrl(canonical, pageUrl)) || catalogUrl(pageUrl) || pageUrl;

  // Poza mare din galerie (800 px); og:image e doar miniatura de 300 px.
  const slide = root.querySelector(".sliderProdus li[data-src]")?.getAttribute("data-src");
  const image = absolute(slide, pageUrl) ?? absolute(meta(root, "og:image"), pageUrl);

  const description = cleanText(meta(root, "description") ?? meta(root, "og:description") ?? "");

  return {
    product: {
      url,
      aliases: [...new Set([url, catalogUrl(pageUrl) ?? pageUrl])],
      name,
      sku,
      price,
      breadcrumb: breadcrumbOf(root),
      image,
      description: description ? description.slice(0, 600) : null,
      variants,
    },
    signals,
  };
}
