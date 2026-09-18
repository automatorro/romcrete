"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { catalogItemSchema, parseForm, type ActionState } from "@/lib/validation";

export async function createCatalogItem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { orgId } = await requireOrg();

  const parsed = parseForm(catalogItemSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").insert({ ...parsed.data, org_id: orgId });

  if (error) {
    return {
      error: error.code === "23505" ? "Există deja un produs cu acest cod (SKU)." : error.message,
    };
  }

  revalidatePath("/catalog");
  return { success: `Produsul „${parsed.data.name}” a fost adăugat.` };
}

export async function updateCatalogItem(
  itemId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrg();

  const parsed = parseForm(catalogItemSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").update(parsed.data).eq("id", itemId);

  if (error) {
    return {
      error: error.code === "23505" ? "Există deja un produs cu acest cod (SKU)." : error.message,
    };
  }

  revalidatePath("/catalog");
  revalidatePath(`/catalog/${itemId}`);
  return { success: "Modificările au fost salvate." };
}

export async function deleteCatalogItem(formData: FormData) {
  await requireOrg();

  const itemId = String(formData.get("id") ?? "");
  if (!itemId) return;

  const supabase = await createClient();
  await supabase.from("catalog_items").delete().eq("id", itemId);

  revalidatePath("/catalog");
  redirect("/catalog");
}
