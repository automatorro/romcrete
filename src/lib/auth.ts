import { cache } from "react";
import { redirect } from "next/navigation";

import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Membership, Organization } from "@/lib/types";

export type SessionContext = {
  user: { id: string; email: string | null };
  membership: (Membership & { organizations: Organization | null }) | null;
};

const ORG_COLUMNS = [
  "id", "name", "cui", "reg_com", "address", "city", "county", "email", "phone", "iban", "bank",
  "vat_rate", "quote_terms", "join_domains", "target_visits_per_day", "target_quotes_per_month",
  "recontact_days_warm", "recontact_days_cold", "productivity_factor", "working_days_per_month",
  "report_recipients", "websites", "created_at",
].join(", ");

/**
 * Stratul prin care trec toate paginile private: cine este utilizatorul și
 * din ce organizație face parte. `cache` îl execută o singură dată per cerere.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  // Fără configurare nu există sesiune; pagina publică explică ce lipsește.
  if (!supabaseConfigured) return null;

  const supabase = await createClient();
  // getClaims verifică token-ul local, cu cheia publică a proiectului, fără un
  // drum în plus la Supabase la fiecare pagină (proxy-ul l-a reîmprospătat deja).
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const user = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };

  const { data: membership } = await supabase
    .from("memberships")
    // Coloanele pe nume: semnătura agentului și ștampila firmei (poze) se citesc
    // doar când se generează oferta, nu la fiecare pagină.
    .select(`user_id, org_id, role, full_name, phone, contact_email, target_visits_per_day, target_quotes_per_month, created_at, organizations(${ORG_COLUMNS})`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    user,
    membership: (membership as SessionContext["membership"]) ?? null,
  };
});

/** Pentru paginile care au nevoie de o organizație configurată. */
export async function requireOrg(): Promise<{
  user: SessionContext["user"];
  orgId: string;
  organization: Organization;
  role: Membership["role"];
}> {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  if (!context.membership?.organizations) redirect("/onboarding");

  return {
    user: context.user,
    orgId: context.membership.org_id,
    organization: context.membership.organizations,
    role: context.membership.role,
  };
}

/** Pentru paginile care cer doar autentificare (ex. onboarding). */
export async function requireUser(): Promise<SessionContext> {
  const context = await getSessionContext();
  if (!context) redirect("/login");
  return context;
}
