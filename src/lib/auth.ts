import { cache } from "react";
import { redirect } from "next/navigation";

import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Membership, Organization } from "@/lib/types";

export type SessionContext = {
  user: { id: string; email: string | null };
  membership: (Membership & { organizations: Organization | null }) | null;
};

/**
 * Stratul prin care trec toate paginile private: cine este utilizatorul și
 * din ce organizație face parte. `cache` îl execută o singură dată per cerere.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  // Fără configurare nu există sesiune; pagina publică explică ce lipsește.
  if (!supabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("*, organizations(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    user: { id: user.id, email: user.email ?? null },
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
