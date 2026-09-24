"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Answers, Notes } from "@/lib/teren";

/** Datele de identificare ale firmei, așa cum vin din `CompanyFields`. */
function companyFromForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim() || null;
  return {
    name: String(formData.get("name") ?? "").trim(),
    contact_person: text("contact_person"),
    phone: text("phone"),
    email: text("email"),
    cui: text("cui"),
    reg_com: text("reg_com"),
    address: text("address"),
    city: text("city"),
    county: text("county"),
  };
}

/** Creează firma (dacă e nouă) și deschide o vizită pe ea. */
export async function startVisit(formData: FormData) {
  const { orgId, user } = await requireOrg();
  const supabase = await createClient();

  let clientId = String(formData.get("client_id") ?? "").trim();

  if (!clientId) {
    const company = companyFromForm(formData);
    if (!company.name) return;

    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        org_id: orgId,
        ...company,
        trade_type: String(formData.get("trade_type") ?? "").trim() || null,
        // Domeniul hotărăște întrebările din vizită și unitatea de calcul.
        domain: String(formData.get("domain") ?? "").trim() || "constructii",
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

/** Completează sau corectează datele firmei din fișa ei de pe teren. */
export async function updateCompany(formData: FormData) {
  await requireOrg();
  const clientId = String(formData.get("client_id") ?? "");
  const company = companyFromForm(formData);
  if (!clientId || !company.name) return;

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(company).eq("id", clientId);

  if (error) redirect(`/teren/firma/${clientId}?eroare=${encodeURIComponent(error.message)}`);

  revalidatePath("/teren");
  revalidatePath(`/teren/firma/${clientId}`);
  revalidatePath("/clienti");
  redirect(`/teren/firma/${clientId}`);
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

/**
 * Deschide o ofertă pornind de la vizită: preia clientul și modelele discutate,
 * cu prețul din catalog la momentul ofertei. Cantitatea pornește de la 1 —
 * vizita înregistrează ce s-a discutat, nu câte bucăți.
 */
export async function createQuoteFromVisit(formData: FormData) {
  const { orgId, organization, user } = await requireOrg();
  const visitId = String(formData.get("visit_id") ?? "");
  if (!visitId) return;

  const supabase = await createClient();

  // O vizită produce o singură ofertă: a doua apăsare o deschide pe prima.
  const { data: existing } = await supabase
    .from("quotes")
    .select("id")
    .eq("visit_id", visitId)
    .maybeSingle();
  if (existing) redirect(`/oferte/${existing.id}`);

  const { data: visit } = await supabase
    .from("visits")
    .select("id, client_id, pump_skus")
    .eq("id", visitId)
    .maybeSingle();
  if (!visit) return;

  const { data: number } = await supabase.rpc("next_quote_number", { p_org: orgId });
  if (!number) return;

  const { data: quote } = await supabase
    .from("quotes")
    .insert({
      org_id: orgId,
      client_id: visit.client_id,
      visit_id: visit.id,
      number,
      status: "draft",
      terms: organization.quote_terms,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (!quote) return;

  const skus = (visit.pump_skus ?? []) as string[];
  if (skus.length) {
    const { data: items } = await supabase
      .from("catalog_items")
      .select("sku, name, description, unit, unit_price, vat_rate")
      .eq("org_id", orgId)
      .in("sku", skus);

    // Ordinea de pe ofertă o dă ordinea în care agentul a ales modelele.
    const bySku = new Map((items ?? []).map((i) => [i.sku as string, i]));
    const lines = skus
      .map((sku, index) => {
        const item = bySku.get(sku);
        if (!item) return null;
        return {
          quote_id: quote.id,
          position: index + 1,
          name: item.name,
          description: item.description,
          unit: item.unit,
          quantity: 1,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
        };
      })
      .filter((l) => l !== null);

    if (lines.length) await supabase.from("quote_items").insert(lines);
  }

  revalidatePath("/oferte");
  revalidatePath(`/teren/vizita/${visitId}`);
  redirect(`/oferte/${quote.id}`);
}
