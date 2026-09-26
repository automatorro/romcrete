import { extractShopTexts, type ShopTexts } from "@/lib/magazin-texte";
import type { CatalogItem } from "@/lib/types";

/** Ce îi trebuie ofertei tipărite dintr-o poziție de catalog. */
export type CatalogSheet = Pick<
  CatalogItem,
  "id" | "sku" | "tech_type" | "materials" | "details" | "shop_url" | "image_url"
>;

export type Spec = { label: string; value: string };

// ---------------------------------------------------------------- cursul EUR

export type EurRate = { rate: number; date: string | null; source: string };

async function readText(url: string, revalidate: number, timeoutMs = 6000) {
  const res = await fetch(url, {
    next: { revalidate },
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": "Mozilla/5.0 (compatible; RomcreteOferte/1.0)" },
  });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

const validRate = (rate: number) => Number.isFinite(rate) && rate > 1 && rate < 100;

/** BNR: cursul oficial, publicat în zilele lucrătoare în jurul orei 13. */
async function fromBnr(timeoutMs: number): Promise<EurRate | null> {
  const xml = await readText("https://www.bnr.ro/nbrfxrates.xml", 3600, timeoutMs);
  const date = xml.match(/<Cube\s+date\s*=\s*["'](\d{4}-\d{2}-\d{2})["']/i)?.[1] ?? null;
  const rate = Number(xml.match(/<Rate\s+currency\s*=\s*["']EUR["'][^>]*>\s*([\d.]+)\s*</i)?.[1]);
  return validRate(rate) ? { rate, date, source: "BNR" } : null;
}

/** BCE: aceeași zi, rezervă când serverul BNR nu răspunde. */
async function fromEcb(timeoutMs: number): Promise<EurRate | null> {
  const xml = await readText("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", 3600, timeoutMs);
  const date = xml.match(/time\s*=\s*["'](\d{4}-\d{2}-\d{2})["']/i)?.[1] ?? null;
  const rate = Number(xml.match(/currency\s*=\s*["']RON["']\s+rate\s*=\s*["']([\d.]+)["']/i)?.[1]);
  return validRate(rate) ? { rate, date, source: "BCE" } : null;
}

/** Frankfurter publică tot cursul BCE, dintr-un serviciu separat. */
async function fromFrankfurter(timeoutMs: number): Promise<EurRate | null> {
  const json = JSON.parse(await readText("https://api.frankfurter.app/latest?from=EUR&to=RON", 3600, timeoutMs)) as {
    date?: string;
    rates?: { RON?: number };
  };
  const rate = Number(json.rates?.RON);
  return validRate(rate) ? { rate, date: json.date ?? null, source: "BCE" } : null;
}

// Ultimul răspuns, ținut în memoria serverului: un curs găsit rămâne o oră, iar
// o căutare eșuată nu se reia 5 minute, ca paginile să nu aștepte la fiecare
// deschidere după servere care nu răspund.
let lastRate: { value: EurRate | null; until: number } | null = null;

/**
 * Cursul EUR al zilei: BNR, iar dacă nu răspunde, cursul BCE. Întoarce null
 * doar dacă nu răspunde niciuna — atunci oferta cere curs manual, nu inventează.
 * Sursele se întreabă deodată, deci pagina așteaptă cel mult o dată (4 s), nu
 * câte 6 s pentru fiecare sursă pe rând.
 */
export async function getEurRate(): Promise<EurRate | null> {
  if (lastRate && lastRate.until > Date.now()) return lastRate.value;

  const results = await Promise.allSettled([fromBnr(4000), fromEcb(4000), fromFrankfurter(4000)]);
  const value = results.map((r) => (r.status === "fulfilled" ? r.value : null)).find((r) => r !== null) ?? null;

  lastRate = { value, until: Date.now() + (value ? 3600_000 : 300_000) };
  return value;
}

// ---------------------------------------------------- pagina din magazin

/** Pagina produsului din magazin, citită cel mult o dată pe zi. */
async function shopPage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    return await readText(url, 86400, 8000);
  } catch {
    return null;
  }
}

/** Valoarea unui atribut dintr-un tag HTML, indiferent de ordinea atributelor. */
function attr(tag: string, name: string): string | null {
  return tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] ?? null;
}

/** Poza principală a paginii: întâi og:image, apoi echivalentele ei. */
function mainImage(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop") ?? "").toLowerCase();
    if (key === "og:image" || key === "og:image:url" || key === "twitter:image" || key === "image") {
      const content = attr(tag, "content");
      if (content) return content;
    }
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if ((attr(tag, "rel") ?? "").toLowerCase() === "image_src") return attr(tag, "href");
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", deg: "°", sup2: "²", sup3: "³",
  acirc: "â", Acirc: "Â", icirc: "î", Icirc: "Î", abreve: "ă", Abreve: "Ă",
};

/** Text curat dintr-un fragment HTML. */
function clean(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, name) => ENTITIES[name] ?? m)
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*$/, "")
    .trim();
}

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Rânduri care țin de coș, preț sau navigație, nu de produs. */
const NOT_A_SPEC = /\b(pret|cos|cantitate|total|subtotal|livrare|stoc|disponibil|cod produs|sku|tva|rating|recenzi|garantie extinsa)\b/;

/**
 * Caracteristicile tehnice de pe pagina produsului. Nu depinde de o structură
 * anume: caută tabelele cu câte două celule (caracteristică — valoare), listele
 * de definiții și, în secțiunea de specificații, rândurile „Caracteristică: valoare”.
 */
function shopSpecs(html: string): Spec[] {
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<(header|footer|nav)\b[\s\S]*?<\/\1>/gi, " ");
  const found: Spec[] = [];

  for (const row of body.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => clean(m[1]));
    if (cells.length === 2) found.push({ label: cells[0], value: cells[1] });
  }

  for (const m of body.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)) {
    found.push({ label: clean(m[1]), value: clean(m[2]) });
  }

  // Descrierile scrise de mână: „Presiune maximă: 207 bar”, câte una pe rând.
  const idx = body.search(/specifica(ț|ţ|t|&#539;|&#355;)ii|caracteristici|date tehnice|detalii tehnice/i);
  if (idx >= 0) {
    const section = body.slice(idx, idx + 40000);
    const lines = section
      .replace(/<(br|\/p|\/li|\/div|\/h\d|\/tr)\b[^>]*>/gi, "\n")
      .split("\n")
      .map(clean);
    for (const line of lines) {
      const m = line.match(/^([^:]{2,45}):\s+(.{1,160})$/);
      if (m) found.push({ label: m[1].trim(), value: m[2].trim() });
    }
  }

  const seen = new Set<string>();
  return found.filter(({ label, value }) => {
    const key = normalize(label);
    if (!key || !value || label.length > 50 || value.length > 200) return false;
    if (NOT_A_SPEC.test(key) || /\blei\b|ron\b/i.test(value)) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------- fișa produsului

const text = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();

const positive = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const numberFormat = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 3 });

/** Ce știe catalogul despre produs, în ordinea în care compară un cumpărător. */
function catalogSpecs(item: CatalogSheet) {
  const d = item.details ?? {};
  const main: Spec[] = [];
  const delivered: Spec[] = [];
  const add = (list: Spec[], label: string, value: string) => {
    if (value) list.push({ label, value });
  };

  add(main, "Cod produs", text(item.sku));
  add(main, "Tehnologie", text(item.tech_type));
  const presiune = positive(d.presiune_bar);
  if (presiune) add(main, "Presiune maximă", `${numberFormat.format(presiune)} bar`);
  const debit = positive(d.debit_l_min);
  if (debit) add(main, "Debit maxim", `${numberFormat.format(debit)} l/min`);
  const motor = positive(d.motor_kw);
  if (motor) add(main, "Putere motor", `${numberFormat.format(motor)} kW`);
  const duza = text(d.diuza_max_in);
  if (positive(duza)) add(main, "Duză maximă", `${duza}"`);
  // Materialele deduse („equivalent”) sunt ipoteze de verificat tehnic, nu promisiuni.
  const materiale = item.materials?.certain ?? [];
  if (materiale.length) add(main, "Materiale", materiale.join(", "));
  add(main, "Variante", Array.isArray(d.variante) ? d.variante.map(text).filter(Boolean).join(", ") : text(d.variante));

  add(delivered, "Pistol livrat", text(d.pistol_livrat));
  add(delivered, "Duze livrate", text(d.duze_livrate));
  add(delivered, "Furtun livrat", text(d.furtun_livrat));
  return { main, delivered };
}

/** Două etichete spun același lucru („Presiune maximă” și „Presiune max. de lucru”). */
function sameSpec(a: string, b: string) {
  const x = normalize(a).split(" ")[0];
  const y = normalize(b).split(" ")[0];
  return x.length > 3 && x === y;
}

/**
 * Fișa unui produs pe ofertă: poza și tabelul de caracteristici. Catalogul dă
 * codul și ce s-a verificat la import; pagina din magazin completează restul
 * caracteristicilor tehnice. Ce se livrează în pachet vine la final.
 */
export async function productSheet(
  item: CatalogSheet | null,
): Promise<{ image: string | null; specs: Spec[]; texts: ShopTexts | null }> {
  if (!item) return { image: null, specs: [], texts: null };

  const html = await shopPage(item.shop_url);
  let image = item.image_url;
  if (!image && html && item.shop_url) {
    const found = mainImage(html);
    if (found) {
      try {
        const url = new URL(found.replace(/&amp;/g, "&"), item.shop_url);
        if (url.protocol === "https:" || url.protocol === "http:") image = url.toString();
      } catch {
        // adresă invalidă: produsul rămâne fără poză
      }
    }
  }

  const { main, delivered } = catalogSpecs(item);
  const fromShop = html ? shopSpecs(html) : [];
  const specs = [...main];
  for (const spec of fromShop) {
    if (![...specs, ...delivered].some((s) => sameSpec(s.label, spec.label))) specs.push(spec);
  }
  specs.push(...delivered);

  // Textele din descrierea magazinului: completează fișa când catalogul n-o are scrisă.
  return { image, specs: specs.slice(0, 18), texts: html ? extractShopTexts(html) : null };
}

/** Doar textele fișei din pagina magazinului (pentru catalog și pentru liniile noi de ofertă). */
export async function shopTexts(shopUrl: string | null): Promise<ShopTexts | null> {
  const html = await shopPage(shopUrl);
  return html ? extractShopTexts(html) : null;
}
