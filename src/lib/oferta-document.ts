import { getEurRate, type EurRate, type Spec } from "@/lib/oferta-print";
import { loadQuoteSheets } from "@/lib/poze";
import type { createClient } from "@/lib/supabase/server";
import { formatDate, lineFinal, sumFinals } from "@/lib/totals";
import type { Client, Organization, Quote, QuoteItem } from "@/lib/types";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Un rând din tabelul de specificații; observațiile apar doar dacă măcar un rând le are. */
export type SpecRow = { label: string; value: string; note: string | null };

export type OfferProduct = {
  item: QuoteItem;
  /** Codul produsului (Part N); null la liniile libere. */
  sku: string | null;
  /** Poza, ca data: URI. */
  image: string | null;
  intro: string | null;
  contents: string[];
  specs: SpecRow[];
  benefits: string[];
  recommendations: string[];
  applications: string[];
  price: ReturnType<typeof lineFinal>;
};

export type OfferAgent = {
  name: string | null;
  phone: string | null;
  email: string | null;
  /** Semnătura agentului, ca data: URI. */
  signature: string | null;
};

/** Cealaltă monedă a ofertei (euro la o ofertă în lei), la curs. */
export type OtherCurrency = { currency: string; convert: (value: number) => number };

/** Tot ce intră în oferta tipărită, citit o dată: îl folosesc la fel PDF-ul și Word-ul. */
export type OfferDocument = {
  quote: Quote;
  client: Client | null;
  organization: Organization;
  /** Ștampila firmei, ca data: URI. */
  stamp: string | null;
  agent: OfferAgent;
  products: OfferProduct[];
  /** Produsele fără poză: cu ele oferta nu pleacă. */
  missing: string[];
  base: string;
  other: OtherCurrency | null;
  eur: EurRate | null;
  rateText: string | null;
  /** Valabilitatea în zile, din data ofertei și data până la care e valabilă. */
  validityDays: number | null;
  /** Condițiile, rând cu rând; „Garanție: 24 luni” se tipărește cu eticheta îngroșată. */
  terms: { label: string | null; text: string }[];
  /** Doar când clientul ia toate produsele și oferta cere totalul. */
  totals: ReturnType<typeof sumFinals> | null;
};

const dataUri = (mime: string | null, b64: string | null) => (mime && b64 ? `data:${mime};base64,${b64}` : null);

/** Rândurile unui text: câte o idee pe rând, fără liniuțele sau bulinele puse de mână. */
export function lines(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*·–]\s*)+/, "").trim())
    .filter(Boolean);
}

/** „Parametru | Valoare | Observații”, câte unul pe rând; merge și „Parametru: Valoare”. */
export function parseSpecs(text: string | null | undefined): SpecRow[] {
  return lines(text).map((line) => {
    const parts = line.includes("|") ? line.split("|") : line.split(/:\s([^]*)/);
    const [label, value, note] = parts.map((p) => (p ?? "").trim());
    return { label, value: value ?? "", note: note || null };
  });
}

const fromAutoSpecs = (specs: Spec[]): SpecRow[] => specs.map((s) => ({ label: s.label, value: s.value, note: null }));

/** „Garanție echipamente: 24 luni” → eticheta și textul; un rând fără „:” rămâne text simplu. */
function parseTerms(text: string | null): OfferDocument["terms"] {
  return lines(text).map((line) => {
    const match = line.match(/^([^:]{2,60}):\s*(.+)$/);
    return match ? { label: match[1].trim(), text: match[2].trim() } : { label: null, text: line };
  });
}

const DAY_MS = 86_400_000;

export async function loadOfferDocument(db: Db, quoteId: string, organization: Organization, viewer: { id: string; email: string | null }) {
  const [{ data: quoteData }, { data: itemsData }, { data: orgExtra }] = await Promise.all([
    db.from("quotes").select("*, clients(*)").eq("id", quoteId).maybeSingle(),
    db.from("quote_items").select("*").eq("quote_id", quoteId).order("position"),
    db.from("organizations").select("stamp_mime, stamp_b64").eq("id", organization.id).maybeSingle(),
  ]);
  if (!quoteData) return null;

  const quote = quoteData as Quote & { clients: Client | null };
  const items = (itemsData ?? []) as QuoteItem[];

  // Agentul de pe ofertă e cel care a făcut-o, cu datele și semnătura lui.
  const agentId = quote.created_by ?? viewer.id;
  const manualRate = Number(quote.eur_rate) > 0 ? Number(quote.eur_rate) : null;
  const [{ sheets, missing }, autoRate, { data: agentRow }] = await Promise.all([
    loadQuoteSheets(db, items),
    manualRate ? Promise.resolve(null) : getEurRate(),
    db
      .from("memberships")
      .select("full_name, phone, contact_email, signature_mime, signature_b64")
      .eq("org_id", quote.org_id)
      .eq("user_id", agentId)
      .maybeSingle(),
  ]);

  const eur: EurRate | null = manualRate ? { rate: manualRate, date: null, source: "ofertă" } : autoRate;
  const discount = Number(quote.discount_pct);

  // Oferta e în lei (RON); euro e echivalentul la curs. O ofertă în euro primește lei.
  const inEur = quote.currency === "EUR";
  const base = inEur ? "EUR" : "RON";
  const other: OtherCurrency | null = eur
    ? inEur
      ? { currency: "RON", convert: (v) => v * eur.rate }
      : { currency: "EUR", convert: (v) => v / eur.rate }
    : null;

  const rateText = eur
    ? `1 EUR = ${eur.rate.toFixed(4).replace(".", ",")} lei` +
      (eur.source === "ofertă"
        ? " (curs stabilit pe ofertă)"
        : ` (curs ${eur.source}${eur.date ? ` din ${formatDate(eur.date)}` : ""})`)
    : null;

  const products: OfferProduct[] = sheets.map(({ item, image, specs, sku, shop }) => {
    // Ce e scris pe ofertă (din catalog sau de agent) are prioritate; ce lipsește
    // se ia din descrierea produsului din magazin. Serviciile n-au fișă de magazin.
    const from = (field: keyof NonNullable<typeof shop>) =>
      item[field]?.trim() || (item.is_service ? null : shop?.[field]?.trim()) || null;
    return {
      item,
      sku,
      image,
      intro: from("intro") || item.description?.trim() || null,
      contents: lines(from("package_contents")),
      // Specificațiile scrise în catalog sau pe ofertă au prioritate; altfel, cele din fișa magazinului.
      specs: item.specs_text?.trim() ? parseSpecs(item.specs_text) : fromAutoSpecs(specs),
      benefits: lines(from("benefits")),
      recommendations: lines(from("recommendations")),
      applications: lines(from("applications")),
      price: lineFinal(item, discount),
    };
  });

  const validityDays =
    quote.valid_until && quote.issue_date
      ? Math.round((Date.parse(quote.valid_until) - Date.parse(quote.issue_date)) / DAY_MS)
      : null;

  const agent: OfferAgent = {
    name: agentRow?.full_name ?? null,
    phone: agentRow?.phone ?? null,
    email: agentRow?.contact_email ?? (agentId === viewer.id ? viewer.email : null),
    signature: dataUri(agentRow?.signature_mime ?? null, agentRow?.signature_b64 ?? null),
  };

  const document: OfferDocument = {
    quote,
    client: quote.clients,
    organization,
    stamp: dataUri(orgExtra?.stamp_mime ?? null, orgExtra?.stamp_b64 ?? null),
    agent,
    products,
    missing,
    base,
    other,
    eur,
    rateText,
    validityDays: validityDays && validityDays > 0 ? validityDays : null,
    terms: parseTerms(quote.terms),
    totals: quote.show_total && items.length ? sumFinals(items, discount) : null,
  };
  return document;
}

/** Numele monedei așa cum se scrie pe ofertă. */
export const currencyLabel = (currency: string) => (currency === "RON" ? "lei" : "EUR");

/** Rândurile de preț de sub un produs, aceleași pe PDF și în Word. */
export function priceRows(item: QuoteItem, price: OfferProduct["price"], quoteDiscountPct: number) {
  const lineDiscount = Number(item.discount_pct) > 0;
  const qty = Number(item.quantity);
  return [
    { label: "Preț unitar fără TVA", value: Number(item.unit_price), strong: false },
    ...(lineDiscount || qty !== 1
      ? [
          {
            label: `Valoare pentru ${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 3 }).format(qty)} ${item.unit}${lineDiscount ? `, cu discount ${item.discount_pct}%` : ""}`,
            value: price.beforeQuoteDiscount,
            strong: false,
          },
        ]
      : []),
    ...(price.quoteDiscount > 0
      ? [{ label: `Discount ofertă ${quoteDiscountPct}%`, value: -price.quoteDiscount, strong: false }]
      : []),
    { label: "Valoare fără TVA", value: price.net, strong: false },
    { label: `TVA ${item.vat_rate}%`, value: price.vat, strong: false },
    { label: "Preț total cu TVA", value: price.gross, strong: true },
  ];
}

/** Adresa firmei, pe un rând. */
export const joinAddress = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ");

/**
 * Datele firmei din subsolul ofertei, pe rânduri, ca în oferta model:
 * numele, adresa, înregistrarea și banca, apoi contactul și site-urile.
 */
export function companyFooter(org: Organization): { title: string; lines: string[] } {
  const bank = [org.iban, org.bank].filter(Boolean).join(" ");
  return {
    title: org.name,
    lines: [
      joinAddress(org.address, org.city, org.county),
      joinAddress(org.reg_com, org.cui, bank),
      joinAddress(org.phone ? `tel: ${org.phone}` : null, org.email ? `e-mail: ${org.email}` : null),
      org.websites?.trim() ?? "",
    ].filter(Boolean),
  };
}
