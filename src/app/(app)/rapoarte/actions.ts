"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import { isReportType } from "@/lib/perioade";
import {
  ALL_SECTIONS,
  buildReportSnapshot,
  defaultTitle,
  DEFAULT_SECTIONS,
  type ReportSection,
} from "@/lib/raport-perioada";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/validation";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Rapoartele se deschid în zona din care au pornit: birou sau teren. */
const base = (formData: FormData) => (formData.get("zona") === "teren" ? "/teren/rapoarte" : "/rapoarte");

function refresh(id?: string) {
  revalidatePath("/rapoarte");
  revalidatePath("/teren/rapoarte");
  if (id) {
    revalidatePath(`/rapoarte/${id}`);
    revalidatePath(`/teren/rapoarte/${id}`);
    revalidatePath(`/print/raport/${id}`);
  }
}

/** Adresele scrise cu virgulă, punct și virgulă sau pe rânduri separate. */
function parseRecipients(raw: string): { ok: string[]; bad: string[] } {
  const all = raw
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  return { ok: [...new Set(all.filter((x) => EMAIL.test(x)))], bad: all.filter((x) => !EMAIL.test(x)) };
}

/**
 * Salvează raportul perioadei alese, cu cifrele de acum, și deschide editarea.
 * Agentul își salvează doar raportul propriu.
 */
export async function createReport(formData: FormData) {
  const { orgId, organization, user, role } = await requireOrg();
  const type = formData.get("tip");
  const anchor = String(formData.get("data") ?? "");
  if (!isReportType(type) || !ISO_DAY.test(anchor)) return;

  const agentId = role === "agent" ? user.id : String(formData.get("ag") ?? "") || null;
  const domainId = String(formData.get("dom") ?? "") || null;

  const data = await buildReportSnapshot(orgId, organization.name, type, anchor, agentId, domainId);
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("reports")
    .insert({
      org_id: orgId,
      created_by: user.id,
      type,
      period_from: data.from,
      period_to: data.to,
      agent_filter: agentId,
      domain_filter: domainId,
      title: defaultTitle(data),
      sections: DEFAULT_SECTIONS[type],
      data,
      recipients: organization.report_recipients ?? [],
    })
    .select("id")
    .single();
  if (error || !row) return;

  refresh();
  redirect(`${base(formData)}/${row.id}`);
}

/** Textele raportului: titlu, rezumat, secțiunile alese, observațiile și destinatarii. */
export async function updateReport(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOrg();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Raportul are nevoie de un titlu." };

  const chosen = formData.getAll("sections").map(String);
  const sections = ALL_SECTIONS.filter((s) => chosen.includes(s));
  if (!sections.length) return { error: "Alege cel puțin o secțiune." };

  const notes: Partial<Record<ReportSection, string>> = {};
  for (const s of ALL_SECTIONS) {
    const text = String(formData.get(`nota_${s}`) ?? "").trim();
    if (text) notes[s] = text;
  }

  const { ok, bad } = parseRecipients(String(formData.get("recipients") ?? ""));
  if (bad.length) return { error: `Adrese de email greșite: ${bad.join(", ")}` };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({
      title,
      summary: String(formData.get("summary") ?? "").trim() || null,
      sections,
      section_notes: notes,
      recipients: ok,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  refresh(id);
  return { success: "Raportul a fost salvat." };
}

/** Recalculează cifrele unei ciorne; textele scrise rămân. Un raport trimis nu se mai schimbă. */
export async function refreshReportData(formData: FormData) {
  const { orgId, organization } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("reports")
    .select("id, type, period_from, agent_filter, domain_filter, status")
    .eq("id", id)
    .maybeSingle();
  if (!r || r.status !== "ciorna" || !isReportType(r.type)) return;

  const data = await buildReportSnapshot(
    orgId,
    organization.name,
    r.type,
    r.period_from as string,
    (r.agent_filter as string | null) ?? null,
    (r.domain_filter as string | null) ?? null,
  );
  await supabase.from("reports").update({ data }).eq("id", id);
  refresh(id);
}

/** Înainte să se deschidă Outlook: raportul trece în „Trimis”, cu data trimiterii. */
export async function markReportSent(id: string) {
  await requireOrg();
  const supabase = await createClient();
  await supabase.from("reports").update({ status: "trimis", sent_at: new Date().toISOString() }).eq("id", id);
  refresh(id);
}

export async function deleteReport(formData: FormData) {
  await requireOrg();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("reports").delete().eq("id", id);
  refresh(id);
  redirect(base(formData));
}
