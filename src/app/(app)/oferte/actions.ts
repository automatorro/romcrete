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

  revalidatePath(`/oferte/${quoteId}`);
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

  revalidatePath(`/oferte/${quoteId}`);
  revalidatePath("/oferte");
}

export async function deleteQuote(formData: FormData) {
  await requireOrg();

  const quoteId = String(formData.get("quote_id") ?? "");
  if (!quoteId) return;

  const supabase = await createClient();
  await supabase.from("quotes").delete().eq("id", quoteId);

  revalidatePath("/oferte");
  redirect("/oferte");
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
    .select("position, name, description, unit, quantity, unit_price, vat_rate, discount_pct")
    .eq("quote_id", quoteId)
    .order("position");

  if (items?.length) {
    await supabase.from("quote_items").insert(items.map((item) => ({ ...item, quote_id: copy.id })));
  }

  revalidatePath("/oferte");
  redirect(`/oferte/${copy.id}`);
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
    position: await nextPosition(quoteId),
    name: item.name,
    description: item.description,
    unit: item.unit,
    quantity: Number(formData.get("quantity") ?? 1) || 1,
    unit_price: item.unit_price,
    vat_rate: item.vat_rate,
  });

  revalidatePath(`/oferte/${quoteId}`);
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

  revalidatePath(`/oferte/${quoteId}`);
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

  revalidatePath(`/oferte/${quoteId}`);
}

export async function deleteQuoteItem(quoteId: string, formData: FormData) {
  await requireOrg();

  const itemId = String(formData.get("item_id") ?? "");
  if (!itemId) return;

  const supabase = await createClient();
  await supabase.from("quote_items").delete().eq("id", itemId);

  revalidatePath(`/oferte/${quoteId}`);
}
