"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import type { Channel } from "@/lib/newsletter";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/validation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Textul cu care pornește un newsletter nou: salut, conținut, semnătură. */
const STARTER_BODY = [
  "Bună ziua, {persoana}!",
  "",
  "Scrie aici noutatea: un produs nou, o promoție, o demonstrație la care îi inviți.",
  "",
  "*Ce câștigă clientul*",
  "- primul avantaj",
  "- al doilea avantaj",
  "",
  "Pentru detalii sau o demonstrație pe șantier, mă găsiți la telefon.",
  "",
  "Cu stimă,",
  "{agent}",
  "{firma_mea} · {telefon}",
].join("\n");

function refresh(id?: string) {
  revalidatePath("/newsletter");
  if (id) revalidatePath(`/newsletter/${id}`);
}

export async function createNewsletter(formData: FormData) {
  const { orgId } = await requireOrg();
  const title = String(formData.get("title") ?? "").trim() || "Newsletter nou";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletters")
    .insert({ org_id: orgId, title, subject: title, body: STARTER_BODY })
    .select("id")
    .single();
  if (error) redirect(`/newsletter?eroare=${encodeURIComponent(error.message)}`);

  refresh();
  redirect(`/newsletter/${data.id}`);
}

export type NewsletterDraft = { title: string; subject: string; body: string; unsubscribe_note: boolean };

/** Salvează textul; previzualizarea lucrează pe ce e scris, trimiterea doar pe ce e salvat. */
export async function saveNewsletter(id: string, draft: NewsletterDraft): Promise<ActionState> {
  await requireOrg();
  const title = draft.title.trim();
  if (!title) return { error: "Dă-i newsletterului un nume, ca să-l găsești în listă." };
  if (!draft.body.trim()) return { error: "Textul mesajului e gol." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("newsletters")
    .update({
      title,
      subject: draft.subject.trim(),
      body: draft.body.replace(/\r\n/g, "\n"),
      unsubscribe_note: Boolean(draft.unsubscribe_note),
    })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  // RLS nu dă eroare când refuză: nu se actualizează niciun rând.
  if (!data?.length) return { error: "Textul îl poate schimba doar autorul lui sau conducerea. Fă-ți o copie." };

  refresh(id);
  return { success: "Salvat." };
}

export async function duplicateNewsletter(formData: FormData) {
  const { orgId } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { data: source } = await supabase
    .from("newsletters")
    .select("title, subject, body, unsubscribe_note")
    .eq("id", id)
    .maybeSingle();
  if (!source) return;

  const { data, error } = await supabase
    .from("newsletters")
    .insert({ ...source, org_id: orgId, title: `${source.title} (copie)` })
    .select("id")
    .single();
  if (error) redirect(`/newsletter/${id}?eroare=${encodeURIComponent(error.message)}`);

  refresh();
  redirect(`/newsletter/${data.id}`);
}

export async function deleteNewsletter(formData: FormData) {
  await requireOrg();
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { data, error } = await supabase.from("newsletters").delete().eq("id", id).select("id");
  if (error || !data?.length) {
    const message = error?.message ?? "Newsletterul îl poate șterge doar autorul lui sau conducerea.";
    redirect(`/newsletter/${id}?eroare=${encodeURIComponent(message)}`);
  }

  // Istoricul firmelor păstrează trimiterile, cu titlul newsletterului.
  refresh();
  redirect("/newsletter");
}

/**
 * Notează în istoricul firmelor că newsletterul a plecat pe canalul dat.
 * Se cheamă când agentul deschide Outlook sau WhatsApp pentru ele.
 */
export async function logNewsletterSent(
  id: string,
  channel: Channel,
  clientIds: string[],
): Promise<{ logged: number; error?: string }> {
  await requireOrg();
  const ids = [...new Set(clientIds)].filter((c) => UUID.test(c));
  if (!UUID.test(id) || !ids.length || (channel !== "email" && channel !== "whatsapp")) return { logged: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_newsletter_sent", {
    p_newsletter: id,
    p_channel: channel,
    p_clients: ids,
  });
  if (error) return { logged: 0, error: error.message };

  refresh(id);
  for (const c of ids) {
    revalidatePath(`/clienti/${c}`);
    revalidatePath(`/teren/firma/${c}`);
  }
  return { logged: Number(data ?? 0) };
}

/** Canalul preferat al firmei și refuzul newsletterelor, din fișa firmei. */
export async function setNewsletterPrefs(clientId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOrg();
  if (!UUID.test(clientId)) return { error: "Firma nu există." };

  const channel = String(formData.get("preferred_channel") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({
      preferred_channel: channel === "email" || channel === "whatsapp" ? channel : null,
      newsletter_opt_out: formData.get("newsletter_opt_out") === "on",
    })
    .eq("id", clientId)
    .select("id");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Nu ai drept să modifici această firmă." };

  revalidatePath(`/clienti/${clientId}`);
  revalidatePath(`/teren/firma/${clientId}`);
  revalidatePath("/newsletter", "layout");
  return { success: "Preferința a fost salvată." };
}
