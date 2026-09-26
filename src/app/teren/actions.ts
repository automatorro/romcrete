"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { todayRo } from "@/lib/agenda";
import { requireOrg } from "@/lib/auth";
import { termsForClient } from "@/lib/conditii";
import { sheetForNewLine } from "@/lib/fisa-magazin";
import { pickSheet } from "@/lib/fisa-produs";
import { isManualKind } from "@/lib/istoric";
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

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Revalidează ecranele care arată agenda și istoricul unei firme. */
function refreshClient(clientId: string) {
  revalidatePath("/teren");
  revalidatePath("/teren/firme");
  revalidatePath(`/teren/firma/${clientId}`);
  revalidatePath(`/clienti/${clientId}`);
}

/**
 * Ziua aleasă în panoul de dată: butoanele rapide o trimit direct, „Alege” trimite
 * „custom” și ziua vine din calendar. `undefined` = alegere invalidă, nu se face nimic.
 */
function pickedDay(formData: FormData): string | null | undefined {
  const date = String(formData.get("date") ?? "");
  if (date === "custom") {
    const custom = String(formData.get("custom") ?? "");
    return ISO_DAY.test(custom) ? custom : undefined;
  }
  return ISO_DAY.test(date) ? date : null;
}

/** Vizita care poartă pasul următor, cu tot ce trebuie ca să-l mutăm și să-l notăm. */
async function stepVisit(visitId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visits")
    .select("id, org_id, client_id, next_step_date")
    .eq("id", visitId)
    .maybeSingle();
  return data as { id: string; org_id: string; client_id: string; next_step_date: string | null } | null;
}

/**
 * „✓ Făcut”: se notează în istoric ce s-a întâmplat (telefon, email, întâlnire),
 * apoi pasul se mută pe ziua în care revii sau, fără dată, se închide.
 */
export async function completeStep(formData: FormData) {
  const { user } = await requireOrg();
  const visit = await stepVisit(String(formData.get("visit_id") ?? ""));
  if (!visit) return;

  const kind = String(formData.get("kind") ?? "");
  // Fără dată înseamnă „nu mai revin”; o dată din calendar lipsă nu închide pasul.
  const next = pickedDay(formData);
  if (next === undefined) return;

  const supabase = await createClient();
  await supabase.from("client_activities").insert({
    org_id: visit.org_id,
    client_id: visit.client_id,
    agent_id: user.id,
    kind: isManualKind(kind) ? kind : "nota",
    body: String(formData.get("body") ?? "").trim() || null,
    visit_id: visit.id,
    step_from: visit.next_step_date,
    step_to: next,
  });

  await supabase
    .from("visits")
    .update(next ? { next_step_date: next, next_step_done_at: null } : { next_step_done_at: new Date().toISOString() })
    .eq("id", visit.id);

  refreshClient(visit.client_id);
}

/** „Amână”: pasul rămâne deschis, pe altă zi, iar mutarea rămâne în istoric. */
export async function postponeStep(formData: FormData) {
  const { user } = await requireOrg();
  const visit = await stepVisit(String(formData.get("visit_id") ?? ""));
  const date = pickedDay(formData);
  if (!visit || !date) return;

  const supabase = await createClient();
  await supabase.from("client_activities").insert({
    org_id: visit.org_id,
    client_id: visit.client_id,
    agent_id: user.id,
    kind: "pas_amanat",
    body: String(formData.get("body") ?? "").trim() || null,
    visit_id: visit.id,
    step_from: visit.next_step_date,
    step_to: date,
  });

  await supabase
    .from("visits")
    .update({ next_step_date: date, next_step_done_at: null })
    .eq("id", visit.id);

  refreshClient(visit.client_id);
}

/** Notează în istoricul firmei un telefon, un email, o întâlnire sau o notă. */
export async function logActivity(formData: FormData) {
  const { orgId, user } = await requireOrg();
  const clientId = String(formData.get("client_id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!clientId || !isManualKind(kind)) return;

  // O zi din trecut se notează la prânz, ca ordinea din istoric să rămână firească.
  const occurred = ISO_DAY.test(date) && date !== todayRo() ? `${date}T12:00:00Z` : new Date().toISOString();

  const supabase = await createClient();
  await supabase.from("client_activities").insert({
    org_id: orgId,
    client_id: clientId,
    agent_id: user.id,
    kind,
    body: body || null,
    occurred_at: occurred,
  });

  refreshClient(clientId);
}

/** Șterge o notă din istoric. RLS lasă doar autorul sau conducerea. */
export async function deleteActivity(formData: FormData) {
  await requireOrg();
  const id = String(formData.get("id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("client_activities").delete().eq("id", id);

  refreshClient(clientId);
}

/**
 * Încheie vizita. Formularul a verificat deja că există pasul următor și data
 * lui; aici se închid pașii rămași deschiși din vizitele anterioare la aceeași
 * firmă, ca agenda și raportul să nu-i mai numere ca restanți.
 */
export async function finishVisit(visitId: string) {
  await requireOrg();
  const supabase = await createClient();

  const { data: visit } = await supabase
    .from("visits")
    .select("id, client_id")
    .eq("id", visitId)
    .maybeSingle();
  if (!visit) return;

  await supabase
    .from("visits")
    .update({ next_step_done_at: new Date().toISOString() })
    .eq("client_id", visit.client_id)
    .neq("id", visit.id)
    .is("next_step_done_at", null);

  revalidatePath("/teren");
  revalidatePath("/teren/firme");
  revalidatePath(`/teren/firma/${visit.client_id}`);
  redirect(`/teren?incheiat=${visit.id}`);
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

  // O vizită produce o singură ofertă activă: a doua apăsare o deschide pe prima.
  // Dacă oferta a fost arhivată, se face una nouă.
  const { data: existing } = await supabase
    .from("quotes")
    .select("id")
    .eq("visit_id", visitId)
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/teren/oferta/${existing.id}`);

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
      terms: await termsForClient(supabase, visit.client_id, organization.quote_terms),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (!quote) return;

  const skus = (visit.pump_skus ?? []) as string[];
  if (skus.length) {
    const { data: items } = await supabase
      .from("catalog_items")
      .select("id, sku, name, description, unit, unit_price, vat_rate, is_service, shop_url, intro, package_contents, specs_text, benefits, recommendations, applications")
      .eq("org_id", orgId)
      .in("sku", skus);

    // Ordinea de pe ofertă o dă ordinea în care agentul a ales modelele.
    const bySku = new Map((items ?? []).map((i) => [i.sku as string, i]));
    // Fișa fiecărui produs, completată din magazin unde catalogul n-o are (în paralel).
    const sheets = new Map(
      await Promise.all(
        (items ?? []).map(async (item) => [item.id as string, await sheetForNewLine(supabase, item)] as const),
      ),
    );
    const lines = skus
      .map((sku, index) => {
        const item = bySku.get(sku);
        if (!item) return null;
        return {
          quote_id: quote.id,
          catalog_item_id: item.id,
          position: index + 1,
          name: item.name,
          description: item.description,
          unit: item.unit,
          quantity: 1,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
          is_service: Boolean(item.is_service),
          ...(sheets.get(item.id) ?? pickSheet(item)),
        };
      })
      .filter((l) => l !== null);

    if (lines.length) await supabase.from("quote_items").insert(lines);
  }

  revalidatePath("/oferte");
  revalidatePath(`/teren/vizita/${visitId}`);
  redirect(`/teren/oferta/${quote.id}`);
}
