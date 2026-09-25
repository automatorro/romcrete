"use server";

import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { offerProfileSchema, parseForm, type ActionState } from "@/lib/validation";

export type ImageResult = { ok: true } | { ok: false; error: string };

const IMAGE_TYPES = ["image/jpeg", "image/png"];

function checkImage(photo: { mime: string; b64: string }): string | null {
  if (!IMAGE_TYPES.includes(photo.mime)) return "Imaginea trebuie să fie JPG sau PNG.";
  if (!photo.b64 || photo.b64.length > 700_000 || !/^[A-Za-z0-9+/=]+$/.test(photo.b64)) {
    return "Imaginea e prea mare sau nu s-a putut citi. Încearcă alta.";
  }
  return null;
}

/** Numele, telefonul și emailul agentului, așa cum apar pe ofertele lui. */
export async function saveOfferProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId } = await requireOrg();
  const parsed = parseForm(offerProfileSchema, formData);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_my_offer_profile", {
    p_org: orgId,
    p_full_name: parsed.data.full_name,
    p_phone: parsed.data.phone ?? "",
    p_email: parsed.data.contact_email ?? "",
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: "Datele tale de pe ofertă au fost salvate." };
}

/** Semnătura agentului, pusă pe fiecare ofertă a lui; null o șterge. */
export async function saveMySignature(photo: { mime: string; b64: string } | null): Promise<ImageResult> {
  const { orgId } = await requireOrg();
  const problem = photo ? checkImage(photo) : null;
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_my_signature", {
    p_org: orgId,
    p_mime: photo?.mime ?? null,
    p_data: photo?.b64 ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/teren/cont");
  revalidatePath("/setari");
  return { ok: true };
}

/** Ștampila firmei, pusă lângă semnătura agentului; o schimbă doar conducerea. */
export async function saveOrgStamp(photo: { mime: string; b64: string } | null): Promise<ImageResult> {
  const { orgId, role } = await requireOrg();
  if (role === "agent") return { ok: false, error: "Ștampila o schimbă doar conducerea." };
  const problem = photo ? checkImage(photo) : null;
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ stamp_mime: photo?.mime ?? null, stamp_b64: photo?.b64 ?? null })
    .eq("id", orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/setari");
  return { ok: true };
}
