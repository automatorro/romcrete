import type { CatalogItem } from "@/lib/types";

/** Ce îi trebuie ofertei tipărite dintr-o poziție de catalog. */
export type CatalogSheet = Pick<
  CatalogItem,
  "id" | "sku" | "tech_type" | "materials" | "details" | "shop_url" | "image_url"
>;

// --------------------------------------------------------------- cursul BNR

export type EurRate = { rate: number; date: string };

/**
 * Cursul EUR publicat de BNR în ziua curentă. BNR îl publică o dată pe zi, în
 * jurul orei 13; până atunci și în weekend fișierul are cursul ultimei zile
 * lucrătoare, iar data lui e cea tipărită pe ofertă.
 *
 * Întoarce null dacă BNR nu răspunde: oferta iese atunci doar în lei, nu cu
 * un curs inventat.
 */
export async function getEurRate(): Promise<EurRate | null> {
  try {
    const res = await fetch("https://www.bnr.ro/nbrfxrates.xml", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const date = xml.match(/<Cube\s+date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const rate = Number(xml.match(/<Rate\s+currency="EUR"[^>]*>([\d.]+)<\/Rate>/)?.[1]);
    if (!date || !Number.isFinite(rate) || rate <= 0) return null;
    return { rate, date };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ poza produsului

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

/**
 * Poza cu care apare produsul pe ofertă. Cea pusă manual în catalog are
 * întâietate; altfel se ia poza principală de pe pagina produsului din magazin.
 * Pagina se citește cel mult o dată pe săptămână pentru fiecare produs.
 */
export async function productImage(item: Pick<CatalogSheet, "image_url" | "shop_url"> | null) {
  if (!item) return null;
  if (item.image_url) return item.image_url;
  if (!item.shop_url) return null;

  try {
    const res = await fetch(item.shop_url, {
      next: { revalidate: 7 * 86400 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const found = mainImage(await res.text());
    if (!found) return null;
    const url = new URL(found.replace(/&amp;/g, "&"), item.shop_url);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------- caracteristicile tehnice

const text = (value: unknown) =>
  value === null || value === undefined ? "" : String(value).trim();

const positive = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const numberFormat = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 3 });

/**
 * Caracteristicile care contează pentru cumpărător, în ordinea în care le
 * compară: ce face, cât de tare, cu ce vine. Materialele deduse („equivalent”)
 * nu ajung la client — sunt ipoteze de verificat tehnic, nu promisiuni.
 */
export function productSpecs(item: CatalogSheet | null): { label: string; value: string }[] {
  if (!item) return [];
  const d = item.details ?? {};
  const specs: { label: string; value: string }[] = [];
  const add = (label: string, value: string) => {
    if (value) specs.push({ label, value });
  };

  add("Cod produs", text(item.sku));
  add("Tehnologie", text(item.tech_type));

  const presiune = positive(d.presiune_bar);
  if (presiune) add("Presiune maximă", `${numberFormat.format(presiune)} bar`);
  const debit = positive(d.debit_l_min);
  if (debit) add("Debit", `${numberFormat.format(debit)} l/min`);
  const motor = positive(d.motor_kw);
  if (motor) add("Motor", `${numberFormat.format(motor)} kW`);
  const duza = text(d.diuza_max_in);
  if (positive(duza)) add("Duză maximă", `${duza}"`);

  const materiale = item.materials?.certain ?? [];
  if (materiale.length) add("Materiale", materiale.join(", "));

  add("Pistol livrat", text(d.pistol_livrat));
  add("Duze livrate", text(d.duze_livrate));
  add("Furtun livrat", text(d.furtun_livrat));
  // Compatibilitatea din catalog amestecă fapte cu note interne („verificare
  // preț/beneficiu la Romcrete”), așa că rămâne în catalog.
  add("Variante", Array.isArray(d.variante) ? d.variante.map(text).filter(Boolean).join(", ") : text(d.variante));

  return specs;
}
