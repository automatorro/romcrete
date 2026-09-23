"use server";

import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { organizationSchema, parseForm, type ActionState } from "@/lib/validation";

export async function updateOrganization(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { orgId } = await requireOrg();

  const parsed = parseForm(organizationSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update(parsed.data).eq("id", orgId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: "Datele firmei au fost salvate." };
}

/**
 * Corectarea pragurilor numerice folosite în calcule.
 * Se scrie doar coloana de valoare — etichetele și ordinea rămân neatinse.
 */
export async function updateOptionValues(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrg();
  const supabase = await createClient();

  const modificari: { group_id: string; id: string; value: number | null }[] = [];
  for (const [name, raw] of formData.entries()) {
    if (!name.startsWith("val_")) continue;
    const [, groupId, optionId] = name.split(/^val_([^_]+)_(.+)$/) ?? [];
    if (!groupId || !optionId) continue;
    const text = String(raw).trim();
    const value = text === "" ? null : Number(text);
    if (value !== null && !Number.isFinite(value)) continue;
    modificari.push({ group_id: groupId, id: optionId, value });
  }

  for (const m of modificari) {
    const { error } = await supabase
      .from("question_options")
      .update({ value: m.value })
      .eq("group_id", m.group_id)
      .eq("id", m.id);
    if (error) return { error: error.message };
  }

  revalidatePath("/setari");
  revalidatePath("/teren", "layout");
  return { success: `Am salvat ${modificari.length} praguri.` };
}

/** Ținte personale. Câmpul gol înseamnă „ca la toată lumea”, deci se scrie null. */
export async function updateAgentTargets(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const perAgent = new Map<string, { vizite: number | null; oferte: number | null }>();
  for (const [name, raw] of formData.entries()) {
    const m = name.match(/^(vizite|oferte)_(.+)$/);
    if (!m) continue;
    const [, camp, userId] = m;
    const text = String(raw).trim();
    const value = text === "" ? null : Number(text);
    if (value !== null && !Number.isFinite(value)) continue;

    const rec = perAgent.get(userId) ?? { vizite: null, oferte: null };
    if (camp === "vizite") rec.vizite = value;
    else rec.oferte = value;
    perAgent.set(userId, rec);
  }

  for (const [userId, t] of perAgent) {
    const { error } = await supabase
      .from("memberships")
      .update({ target_visits_per_day: t.vizite, target_quotes_per_month: t.oferte })
      .eq("org_id", orgId)
      .eq("user_id", userId);
    if (error) return { error: error.message };
  }

  revalidatePath("/setari");
  revalidatePath("/teren");
  return { success: `Am salvat țintele pentru ${perAgent.size} persoane.` };
}
