"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CatalogItem } from "@/lib/types";
import {
  parseForm,
  quoteItemSchema,
  quoteSchema,
  quoteStatusSchema,
  type ActionState,
} from "@/lib/validation";

/** Oferta se vede și la birou, și pe teren: după o modificare se reîmprospătează ambele. */
function refreshQuote(quoteId: string) {
  revalidatePath(`/oferte/${quoteId}`);
  revalidatePath(`/teren/oferta/${quoteId}`);
  revalidatePath("/oferte");
  revalidatePath("/teren/oferte");
}

/** Formularele de pe teren trimit `zona=teren`, ca redirecționarea să rămână în interfața de telefon. */
function zone(formData: FormData) {
  return formData.get("zona") === "teren"
    ? { list: "/teren/oferte", one: (id: string) => `/teren/oferta/${id}` }
    : { list: "/oferte", one: (id: string) => `/oferte/${id}` };
}

/** Poziția următoare din ofertă, ca liniile să rămână în ordinea adăugării. */
async function nextPosition(quoteId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quote_items")
    .select("position")
    .eq("quote_id", quoteId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ((data?.position as number | undefined) ?? 0) + 1;
}

export async function createQuote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId, organization, user } = await requireOrg();

  const parsed = parseForm(quoteSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();

  // Numerotarea e atomică în baza de date, ca două oferte simultane să nu ia același număr.
  const { data: number, error: numberError } = await supabase.rpc("next_quote_number", {
    p_org: orgId,
  });

  if (numberError || !number) {
    return { error: numberError?.message ?? "Numărul ofertei nu a putut fi generat" };
  }

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      ...parsed.data,
      org_id: orgId,
      number,
      created_by: user.id,
      terms: parsed.data.terms ?? organization.quote_terms,
    })
    .select("id")
    .single();

  if (error || !quote) return { error: error?.message ?? "Oferta nu a putut fi creată" };

  revalidatePath("/oferte");
  redirect(`/oferte/${quote.id}`);
}

export async function updateQuote(
  quoteId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrg();

  const parsed = parseForm(quoteSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update(parsed.data).eq("id", quoteId);

  if (error) return { error: error.message };

  refreshQuote(quoteId);
  revalidatePath("/oferte");
  return { success: "Oferta a fost salvată." };
}

export async function setQuoteStatus(formData: FormData) {
  await requireOrg();

  const quoteId = String(formData.get("quote_id") ?? "");
  const status = quoteStatusSchema.safeParse(formData.get("status"));
  if (!quoteId || !status.success) return;

  const supabase = await createClient();
  await supabase.from("quotes").update({ status: status.data }).eq("id", quoteId);

  refreshQuote(quoteId);
  revalidatePath("/oferte");
}

/** Pornește sau oprește totalul de la finalul ofertei (când clientul ia toate produsele). */
export async function setShowTotal(formData: FormData) {
  await requireOrg();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) return;

  const supabase = await createClient();
  await supabase.from("quotes").update({ show_total: formData.get("show") === "1" }).eq("id", quoteId);
  refreshQuote(quoteId);
}

/**
 * „Șterge” pentru agent: oferta intră în arhivă. Nu mai apare în liste și nu se
 * numără în rapoarte, dar se poate restaura oricând.
 */
export async function archiveQuote(formData: FormData) {
  const { user } = await requireOrg();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) return;

  const supabase = await createClient();
  await supabase
    .from("quotes")
    .update({ archived_at: new Date().toISOString(), archived_by: user.id })
    .eq("id", quoteId);

  refreshQuote(quoteId);
  redirect(zone(formData).list);
}

export async function restoreQuote(formData: FormData) {
  await requireOrg();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) return;

  const supabase = await createClient();
  await supabase.from("quotes").update({ archived_at: null, archived_by: null }).eq("id", quoteId);

  refreshQuote(quoteId);
  redirect(zone(formData).one(quoteId));
}

/**
 * Ștergerea definitivă: doar conducerea și doar din arhivă. Baza de date
 * verifică același lucru, deci un agent care ajunge aici nu șterge nimic.
 */
export async function deleteQuote(formData: FormData) {
  const { role } = await requireOrg();
  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId || role === "agent") return;

  const supabase = await createClient();
  await supabase.from("quotes").delete().eq("id", quoteId).not("archived_at", "is", null);

  refreshQuote(quoteId);
  redirect(`${zone(formData).list}?status=arhiva`);
}

/**
 * Înainte să se deschidă Outlook: trimiterea se notează în istoricul firmei,
 * iar o ciornă devine „Trimisă”. Emailul propriu-zis pleacă din Outlook.
 */
export async function markQuoteEmailed(quoteId: string) {
  const { user } = await requireOrg();
  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, org_id, client_id, number, status")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return;

  if (quote.status === "draft") {
    await supabase.from("quotes").update({ status: "sent" }).eq("id", quote.id);
  }
  if (quote.client_id) {
    await supabase.from("client_activities").insert({
      org_id: quote.org_id,
      client_id: quote.client_id,
      agent_id: user.id,
      kind: "email",
      body: `Oferta ${quote.number} trimisă pe email.`,
      quote_id: quote.id,
    });
    revalidatePath(`/teren/firma/${quote.client_id}`);
    revalidatePath(`/clienti/${quote.client_id}`);
  }
  refreshQuote(quote.id);
}

/** Copiază o ofertă existentă, cu tot cu linii, sub un număr nou. */
export async function duplicateQuote(formData: FormData) {
  const { orgId, user } = await requireOrg();

  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) return;

  const supabase = await createClient();
  const { data: source } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();
  if (!source) return;

  const { data: number } = await supabase.rpc("next_quote_number", { p_org: orgId });
  if (!number) return;

  const { data: copy } = await supabase
    .from("quotes")
    .insert({
      org_id: orgId,
      client_id: source.client_id,
      number,
      title: source.title,
      status: "draft",
      issue_date: new Date().toISOString().slice(0, 10),
      valid_until: source.valid_until,
      currency: source.currency,
      discount_pct: source.discount_pct,
      show_total: source.show_total ?? false,
      site_address: source.site_address,
      notes: source.notes,
      terms: source.terms,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (!copy) return;

  const { data: items } = await supabase
    .from("quote_items")
    .select("catalog_item_id, position, name, description, unit, quantity, unit_price, vat_rate, discount_pct")
    .eq("quote_id", quoteId)
    .order("position");

  if (items?.length) {
    await supabase.from("quote_items").insert(items.map((item) => ({ ...item, quote_id: copy.id })));
  }

  refreshQuote(copy.id);
  redirect(zone(formData).one(copy.id));
}

/** Adaugă pe ofertă un produs din catalog, copiindu-i prețul de la momentul adăugării. */
export async function addCatalogItemToQuote(quoteId: string, formData: FormData) {
  await requireOrg();

  const catalogItemId = String(formData.get("catalog_item_id") ?? "");
  if (!catalogItemId) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("catalog_items")
    .select("*")
    .eq("id", catalogItemId)
    .maybeSingle();

  if (!data) return;
  const item = data as CatalogItem;

  await supabase.from("quote_items").insert({
    quote_id: quoteId,
    catalog_item_id: item.id,
    position: await nextPosition(quoteId),
    name: item.name,
    description: item.description,
    unit: item.unit,
    quantity: Number(formData.get("quantity") ?? 1) || 1,
    unit_price: item.unit_price,
    vat_rate: item.vat_rate,
  });

  refreshQuote(quoteId);
}

/** Linie liberă, pentru ce nu există în catalog. */
export async function addCustomItem(
  quoteId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrg();

  const parsed = parseForm(quoteItemSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("quote_items").insert({
    ...parsed.data,
    quote_id: quoteId,
    position: await nextPosition(quoteId),
  });

  if (error) return { error: error.message };

  refreshQuote(quoteId);
  return { success: "Linia a fost adăugată." };
}

export async function updateQuoteItem(quoteId: string, formData: FormData) {
  await requireOrg();

  const itemId = String(formData.get("item_id") ?? "");
  if (!itemId) return;

  const parsed = parseForm(quoteItemSchema, formData);
  if (!parsed.ok) return;

  const supabase = await createClient();
  await supabase.from("quote_items").update(parsed.data).eq("id", itemId);

  refreshQuote(quoteId);
}

export async function deleteQuoteItem(quoteId: string, formData: FormData) {
  await requireOrg();

  const itemId = String(formData.get("item_id") ?? "");
  if (!itemId) return;

  const supabase = await createClient();
  await supabase.from("quote_items").delete().eq("id", itemId);

  refreshQuote(quoteId);
}
