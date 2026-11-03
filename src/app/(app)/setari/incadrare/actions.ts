"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrg } from "@/lib/auth";
import { getAllDomains } from "@/lib/domenii";
import { createClient } from "@/lib/supabase/server";

const errorUrl = (message: string) => `/setari/incadrare?eroare=${encodeURIComponent(message)}`;

async function requireManagement() {
  const context = await requireOrg();
  if (context.role === "agent") redirect("/teren");
  return context;
}

export async function addOccupation(formData: FormData) {
  const { orgId, user } = await requireManagement();
  const domainId = String(formData.get("domain_id") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const domains = await getAllDomains(orgId);

  if (!domains.some((domain) => domain.id === domainId)) {
    redirect(errorUrl("Alege un domeniu existent."));
  }
  if (label.length < 2 || label.length > 100) {
    redirect(errorUrl("Denumirea ocupației trebuie să aibă între 2 și 100 de caractere."));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("org_occupations").insert({
    org_id: orgId,
    domain_id: domainId,
    label,
    created_by: user.id,
  });

  if (error) {
    redirect(errorUrl(/duplicate key/i.test(error.message)
      ? "Există deja o ocupație cu această denumire în domeniul ales."
      : "Ocupația nu s-a putut salva. Verifică migrarea și permisiunile."));
  }

  revalidatePath("/setari/incadrare");
  redirect("/setari/incadrare");
}

export async function confirmClassification(formData: FormData) {
  const { orgId } = await requireManagement();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const occupationId = String(formData.get("occupation_id") ?? "").trim();
  const note = String(formData.get("classification_note") ?? "").trim() || null;

  if (!clientId || !occupationId) redirect(errorUrl("Alege firma și ocupația confirmată."));

  const supabase = await createClient();
  const { data: occupation, error: occupationError } = await supabase
    .from("org_occupations")
    .select("id, domain_id")
    .eq("org_id", orgId)
    .eq("id", occupationId)
    .eq("active", true)
    .maybeSingle();

  if (occupationError || !occupation) {
    redirect(errorUrl("Ocupația aleasă nu este activă sau nu aparține organizației."));
  }

  const { error } = await supabase
    .from("clients")
    .update({
      domain: occupation.domain_id,
      occupation_id: occupation.id,
      classification_status: "confirmed",
      classification_note: note,
    })
    .eq("org_id", orgId)
    .eq("id", clientId);

  if (error) {
    redirect(errorUrl("Încadrarea nu s-a putut confirma. Verifică migrarea și încearcă din nou."));
  }

  revalidatePath("/setari/incadrare");
  revalidatePath("/teren/firme");
  revalidatePath(`/teren/firma/${clientId}`);
  revalidatePath("/clienti");
  revalidatePath("/raport");
  revalidatePath("/rapoarte");
  redirect("/setari/incadrare");
}