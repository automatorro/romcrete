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
  productivity_factor: number;
  working_days_per_month: number;
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
  discount_pct: number;
  site_address: string | null;
  notes: string | null;
  terms: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
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
