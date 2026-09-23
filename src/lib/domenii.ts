import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Domeniile în care lucrează clienții Romcrete.
 *
 * Stau în baza de date, nu în cod: unitatea de măsură și randamentul presupus
 * sunt ipoteze despre piață, iar conducerea le corectează din Setări. Codul
 * știe doar cum se folosesc, nu ce valori au.
 */

export type Domain = {
  id: string;
  label: string;
  short_label: string;
  /** mp / ml / reper / masina — cheia internă a unității. */
  unit: string;
  /** „metri pătrați”, „metri liniari”, „mașini”. */
  unit_label: string;
  /** Cum se scrie unitatea lângă cifră: „30 mp/zi”, „1.250 ml/zi”. */
  unit_short: string;
  productivity_factor: number;
  pump_categories: string[];
  tech_types: string[] | null;
  position: number;
};

export type DomainParams = {
  domain_id: string;
  productivity_factor: number | null;
  active: boolean;
};

/** Domeniul folosit când firma n-a fost încă încadrată. */
export const DEFAULT_DOMAIN = "constructii";

const normalise = (row: Record<string, unknown>): Domain => ({
  id: String(row.id),
  label: String(row.label),
  short_label: String(row.short_label),
  unit: String(row.unit),
  unit_label: String(row.unit_label),
  unit_short: String(row.unit_short),
  productivity_factor: Number(row.productivity_factor),
  pump_categories: (row.pump_categories as string[]) ?? [],
  tech_types: (row.tech_types as string[] | null) ?? null,
  position: Number(row.position),
});

/**
 * Domeniile, cu randamentul corectat de conducere acolo unde a fost corectat.
 * `cache` le încarcă o dată per cerere.
 */
export const getAllDomains = cache(
  async (orgId: string): Promise<(Domain & { active: boolean; override: number | null })[]> => {
    const supabase = await createClient();

    const [{ data: rows }, { data: params }] = await Promise.all([
      supabase.from("domains").select("*").order("position"),
      supabase
        .from("org_domain_params")
        .select("domain_id, productivity_factor, active")
        .eq("org_id", orgId),
    ]);

    const byId = new Map((params ?? []).map((p) => [p.domain_id as string, p as DomainParams]));

    return (rows ?? []).map(normalise).map((d) => {
      const p = byId.get(d.id);
      const override = p?.productivity_factor != null ? Number(p.productivity_factor) : null;
      return {
        ...d,
        productivity_factor: override ?? d.productivity_factor,
        override,
        active: p?.active !== false,
      };
    });
  },
);

/** Domeniile pe care firma le folosește — cele din care aleg agenții. */
export const getDomains = cache(async (orgId: string): Promise<Domain[]> => {
  const all = await getAllDomains(orgId);
  return all.filter((d) => d.active);
});

export const findDomain = (domains: Domain[], id: string | null): Domain | null =>
  domains.find((d) => d.id === (id ?? DEFAULT_DOMAIN)) ??
  domains.find((d) => d.id === DEFAULT_DOMAIN) ??
  domains[0] ??
  null;

export const domainLabel = (domains: Domain[], id: string | null): string =>
  domains.find((d) => d.id === id)?.short_label ?? "";

/**
 * Pompele potrivite domeniului: categoria trebuie să fie a domeniului, iar dacă
 * domeniul e definit și pe tehnologie — cazul finisajelor fine, care stau în
 * aceeași categorie cu zugrăveala — trebuie să fie și tehnologia potrivită.
 */
export function matchesDomain(
  domain: Domain | null,
  item: { category: string | null; tech_type?: string | null },
): boolean {
  if (!domain || domain.pump_categories.length === 0) return true;
  if (!item.category || !domain.pump_categories.includes(item.category)) return false;
  if (!domain.tech_types || domain.tech_types.length === 0) return true;
  return Boolean(item.tech_type && domain.tech_types.includes(item.tech_type));
}
