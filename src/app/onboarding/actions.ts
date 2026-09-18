"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { organizationSchema, parseForm, type ActionState } from "@/lib/validation";

/** Creează organizația, îl adaugă pe utilizator ca owner și populează catalogul implicit. */
export async function createOrganization(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requireUser();
  if (context.membership) redirect("/oferte");

  const parsed = parseForm(organizationSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .insert(parsed.data)
    .select("id")
    .single();

  if (orgError || !organization) {
    return { error: orgError?.message ?? "Organizația nu a putut fi creată" };
  }

  const { error: membershipError } = await supabase.from("memberships").insert({
    user_id: context.user.id,
    org_id: organization.id,
    role: "owner",
    full_name: String(formData.get("full_name") ?? "").trim() || null,
  });

  if (membershipError) return { error: membershipError.message };

  // Catalogul implicit e doar un punct de plecare; poate fi modificat oricând.
  await supabase.rpc("seed_default_catalog", { p_org: organization.id });

  revalidatePath("/", "layout");
  redirect("/oferte");
}
