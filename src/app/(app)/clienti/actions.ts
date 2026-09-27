"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import {
  IMPORT_FIELDS,
  parseClientsFile,
  planImport,
  type ExistingClient,
} from "@/lib/import-clienti";
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

/** Rezultatul importului: pe lângă mesaj, ce s-a completat, ce s-a sărit și de ce. */
export type ImportState =
  | { error?: string; success?: string; filled?: string[]; skipped?: string[]; problems?: string[] }
  | null;

const INSERT_CHUNK = 500;
const UPDATE_PARALLEL = 10;

export async function importClientsFromFile(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const { orgId } = await requireOrg();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Alege fișierul cu clienții." };

  const parsed = await parseClientsFile(file);
  if (!parsed.ok) return { error: parsed.error };
  if (parsed.clients.length === 0) {
    return { error: "Nu am găsit niciun client în fișier.", problems: parsed.problems };
  }

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("clients")
    .select(["id", ...IMPORT_FIELDS].join(", "))
    .eq("org_id", orgId);
  if (readError) return { error: readError.message };

  const plan = planImport((existing ?? []) as unknown as ExistingClient[], parsed.clients);
  const details = { filled: plan.filled, skipped: plan.unchanged, problems: parsed.problems };

  let added = 0;
  for (let i = 0; i < plan.inserts.length; i += INSERT_CHUNK) {
    const chunk = plan.inserts.slice(i, i + INSERT_CHUNK).map((c) => ({ ...c, org_id: orgId }));
    const { error } = await supabase.from("clients").insert(chunk);
    if (error) {
      if (added > 0) revalidatePath("/clienti");
      return { error: `Importul s-a oprit după ${added} clienți adăugați: ${error.message}`, ...details };
    }
    added += chunk.length;
  }

  // Câte o actualizare pe firmă, doar cu câmpurile care erau goale.
  let updated = 0;
  const failed: string[] = [];
  for (let i = 0; i < plan.updates.length; i += UPDATE_PARALLEL) {
    const batch = plan.updates.slice(i, i + UPDATE_PARALLEL);
    const results = await Promise.all(
      batch.map((u) => supabase.from("clients").update(u.patch).eq("id", u.id)),
    );
    results.forEach(({ error }, j) => {
      if (error) failed.push(`„${batch[j].name}”: ${error.message}`);
      else updated++;
    });
  }

  revalidatePath("/clienti");

  const parts = [
    added === 1 ? "Am adăugat 1 client nou." : `Am adăugat ${added} clienți noi.`,
    updated ? `Am completat date la ${updated} ${updated === 1 ? "client existent" : "clienți existenți"}.` : "",
    plan.unchanged.length ? `${plan.unchanged.length} rânduri nu aduceau nimic nou.` : "",
    parsed.problems.length ? `${parsed.problems.length} rânduri nu au putut fi citite.` : "",
  ];
  const summary = `${parts.filter(Boolean).join(" ")} Coloane folosite: ${parsed.columns.join(", ")}.`;

  if (failed.length) {
    return {
      error: `${summary} Nu s-au putut completa ${failed.length} clienți: ${failed.slice(0, 5).join("; ")}`,
      ...details,
    };
  }
  return { success: summary, ...details };
}
