/**
 * Tipurile rândurilor din baza de date.
 * Pot fi înlocuite oricând cu cele generate: `supabase gen types typescript`.
 */

export type MemberRole = "owner" | "admin" | "agent";

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Ciornă",
  sent: "Trimisă",
  accepted: "Acceptată",
  rejected: "Respinsă",
  expired: "Expirată",
};

export type Organization = {
  id: string;
  name: string;
  cui: string | null;
  reg_com: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  bank: string | null;
  vat_rate: number;
  quote_terms: string | null;
  join_domains: string[];
  target_visits_per_day: number;
  target_quotes_per_month: number;
  recontact_days_warm: number;
  recontact_days_cold: number;
  productivity_factor: number;
  working_days_per_month: number;
  /** Adresele la care se trimit de obicei rapoartele. */
  report_recipients: string[];
  created_at: string;
};

export type Membership = {
  user_id: string;
  org_id: string;
  role: MemberRole;
  full_name: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  org_id: string;
  name: string;
  cui: string | null;
  reg_com: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  county: string | null;
  notes: string | null;
  /** Meseria, în vocabularul construcțiilor. Rămâne o nuanță în interiorul domeniului. */
  trade_type: string | null;
  /** Domeniul în care lucrează: hotărăște întrebările și unitatea de calcul. */
  domain: string | null;
  owner_agent_id: string | null;
  created_at: string;
};

export type CatalogItem = {
  id: string;
  org_id: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  unit_price: number;
  vat_rate: number;
  is_active: boolean;
  /** Se configurează la comandă: unit_price e 0 și nu se afișează ca preț. */
  price_on_request: boolean;
  /** Materialele compatibile, din fișa produsului sau deduse după consistență. */
  materials: { certain?: string[]; equivalent?: string[] } | null;
  /** Airless, HVLP, Rotor-Stator, Bicomponent — folosit la filtrarea pe domeniu. */
  tech_type: string | null;
  shop_url: string | null;
  /** Poza de pe ofertă; goală, se ia de pe pagina din magazin. */
  image_url: string | null;
  details: Record<string, unknown> | null;
  price_with_vat: number | null;
  created_at: string;
};

export type Quote = {
  id: string;
  org_id: string;
  client_id: string | null;
  number: string;
  title: string | null;
  status: QuoteStatus;
  issue_date: string;
  valid_until: string | null;
  currency: string;
  /** Lei pentru 1 EUR pe oferta tipărită; null = cursul BNR al zilei. */
  eur_rate: number | null;
  discount_pct: number;
  site_address: string | null;
  notes: string | null;
  terms: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Oferta arhivată nu apare în liste și nu se numără în rapoarte; se poate restaura. */
  archived_at: string | null;
  archived_by: string | null;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  /** Poziția de catalog din care vine linia; null la liniile libere. */
  catalog_item_id: string | null;
  position: number;
  name: string;
  description: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  discount_pct: number;
  created_at: string;
};

/** Unitățile de măsură uzuale în ofertele de betoane. */
export const UNITS = ["mc", "mp", "ml", "to", "buc", "km", "ora", "zi"] as const;
