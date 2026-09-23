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

/**
 * Domeniile firmei: randamentul presupus și care dintre ele sunt folosite.
 * Randamentul gol înseamnă „cel de piață”, deci se scrie null și se citește
 * din catalogul de domenii.
 */
export async function updateDomainParams(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();

  const perDomeniu = new Map<string, { factor: number | null; activ: boolean }>();
  const citeste = (id: string) => perDomeniu.get(id) ?? { factor: null, activ: false };

  for (const [name, raw] of formData.entries()) {
    const m = name.match(/^(rand|activ)_(.+)$/);
    if (!m) continue;
    const [, camp, domainId] = m;
    const rec = citeste(domainId);

    if (camp === "activ") {
      rec.activ = true;
    } else {
      const text = String(raw).trim();
      const value = text === "" ? null : Number(text);
      // Sub 1 nu e randament, e pierdere: calculul de amortizare ar da negativ.
      if (value !== null && (!Number.isFinite(value) || value <= 1)) {
        return { error: `Randamentul trebuie să fie mai mare decât 1 (domeniul ${domainId}).` };
      }
      rec.factor = value;
    }
    perDomeniu.set(domainId, rec);
  }

  const randuri = [...perDomeniu.entries()].map(([domain_id, r]) => ({
    org_id: orgId,
    domain_id,
    productivity_factor: r.factor,
    active: r.activ,
  }));

  if (randuri.length) {
    const { error } = await supabase
      .from("org_domain_params")
      .upsert(randuri, { onConflict: "org_id,domain_id" });
    if (error) return { error: error.message };
  }

  revalidatePath("/setari");
  revalidatePath("/teren", "layout");
  revalidatePath("/raport");
  return { success: `Am salvat ${randuri.length} domenii.` };
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
