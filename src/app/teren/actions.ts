"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Answers, Notes } from "@/lib/teren";

/** Creează firma (dacă e nouă) și deschide o vizită pe ea. */
export async function startVisit(formData: FormData) {
  const { orgId, user } = await requireOrg();
  const supabase = await createClient();

  let clientId = String(formData.get("client_id") ?? "").trim();

  if (!clientId) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;

    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        org_id: orgId,
        name,
        city: String(formData.get("city") ?? "").trim() || null,
        phone: String(formData.get("phone") ?? "").trim() || null,
        trade_type: String(formData.get("trade_type") ?? "").trim() || null,
        owner_agent_id: user.id,
      })
      .select("id")
      .single();

    if (error || !created) return;
    clientId = created.id;
  }

  const { data: visit, error } = await supabase
    .from("visits")
    .insert({ org_id: orgId, client_id: clientId, agent_id: user.id })
    .select("id")
    .single();

  if (error || !visit) return;

  revalidatePath("/teren");
  redirect(`/teren/vizita/${visit.id}`);
}

/**
 * Salvarea vizitei. Se apelează des, din formular, la fiecare modificare —
 * de aceea scrie tot conținutul dintr-o dată și nu redirecționează.
 */
export async function saveVisit(
  visitId: string,
  payload: {
    answers: Answers;
    notes: Notes;
    pump_skus: string[];
    next_step_date: string | null;
    visit_date: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase
    .from("visits")
    .update({
      answers: payload.answers,
      notes: payload.notes,
      pump_skus: payload.pump_skus,
      next_step_date: payload.next_step_date || null,
      visit_date: payload.visit_date,
    })
    .eq("id", visitId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/teren");
  revalidatePath(`/teren/vizita/${visitId}`);
  return { ok: true };
}

/** Bifează pasul următor ca făcut, direct din lista de firme. */
export async function markStepDone(formData: FormData) {
  await requireOrg();
  const visitId = String(formData.get("visit_id") ?? "");
  if (!visitId) return;

  const supabase = await createClient();
  await supabase
    .from("visits")
    .update({ next_step_done_at: new Date().toISOString() })
    .eq("id", visitId);

  revalidatePath("/teren");
}

export async function deleteVisit(formData: FormData) {
  await requireOrg();
  const visitId = String(formData.get("visit_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  if (!visitId) return;

  const supabase = await createClient();
  await supabase.from("visits").delete().eq("id", visitId);

  revalidatePath("/teren");
  redirect(clientId ? `/teren/firma/${clientId}` : "/teren");
}
