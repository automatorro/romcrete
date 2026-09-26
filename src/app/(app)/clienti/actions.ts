"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import { cuiKey, nameKey, parseClientsFile, type ParsedClient } from "@/lib/import-clienti";
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

/** Rezultatul importului: pe lângă mesaj, ce s-a sărit și de ce. */
export type ImportState =
  | { error?: string; success?: string; skipped?: string[]; problems?: string[] }
  | null;

const INSERT_CHUNK = 500;

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
    .select("name, cui")
    .eq("org_id", orgId);
  if (readError) return { error: readError.message };

  // Un client se recunoaște după CUI; fără CUI, după denumire.
  const seenCui = new Set<string>();
  const seenName = new Set<string>();
  for (const c of existing ?? []) {
    const cui = cuiKey(c.cui);
    if (cui) seenCui.add(cui);
    seenName.add(nameKey(c.name));
  }

  const fresh: ParsedClient["data"][] = [];
  const skipped: string[] = [];
  for (const { row, data } of parsed.clients) {
    const cui = cuiKey(data.cui);
    const name = nameKey(data.name);
    if ((cui && seenCui.has(cui)) || (!cui && seenName.has(name))) {
      skipped.push(`rândul ${row}: „${data.name}” există deja`);
      continue;
    }
    if (cui) seenCui.add(cui);
    seenName.add(name);
    fresh.push(data);
  }

  let added = 0;
  for (let i = 0; i < fresh.length; i += INSERT_CHUNK) {
    const chunk = fresh.slice(i, i + INSERT_CHUNK).map((c) => ({ ...c, org_id: orgId }));
    const { error } = await supabase.from("clients").insert(chunk);
    if (error) {
      if (added > 0) revalidatePath("/clienti");
      return {
        error: `Importul s-a oprit după ${added} clienți adăugați: ${error.message}`,
        skipped,
        problems: parsed.problems,
      };
    }
    added += chunk.length;
  }

  revalidatePath("/clienti");

  const parts = [
    added === 1 ? "Am adăugat 1 client." : `Am adăugat ${added} clienți.`,
    skipped.length ? `${skipped.length} existau deja și au rămas neatinși.` : "",
    parsed.problems.length ? `${parsed.problems.length} rânduri nu au putut fi citite.` : "",
  ];
  return {
    success: `${parts.filter(Boolean).join(" ")} Coloane folosite: ${parsed.columns.join(", ")}.`,
    skipped,
    problems: parsed.problems,
  };
}
