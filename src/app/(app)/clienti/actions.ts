"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { clientSchema, parseForm, type ActionState } from "@/lib/validation";

export async function createClientRecord(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { orgId } = await requireOrg();

  const parsed = parseForm(clientSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert({ ...parsed.data, org_id: orgId });

  if (error) return { error: error.message };

  revalidatePath("/clienti");
  return { success: `Clientul „${parsed.data.name}” a fost adăugat.` };
}

export async function updateClientRecord(
  clientId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrg();

  const parsed = parseForm(clientSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(parsed.data).eq("id", clientId);

  if (error) return { error: error.message };

  revalidatePath("/clienti");
  revalidatePath(`/clienti/${clientId}`);
  return { success: "Modificările au fost salvate." };
}

export async function deleteClientRecord(formData: FormData) {
  await requireOrg();

  const clientId = String(formData.get("id") ?? "");
  if (!clientId) return;

  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().eq("id", clientId);

  // Clientul rămâne dacă are oferte emise (restricție de integritate în baza de date).
  if (error) redirect(`/clienti/${clientId}?eroare=${encodeURIComponent(error.message)}`);

  revalidatePath("/clienti");
  redirect("/clienti");
}
