"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/auth";
import { isDecisionStatus, readReportDecisions } from "@/lib/decizii";
import { isReportType } from "@/lib/perioade";
import {
  ALL_SECTIONS,
  buildReportSnapshot,
  defaultSections,
  defaultTitle,
  REFLECTION_QUESTIONS,
  scopeOf,
  type Reflection,
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
 * Agentul își salvează doar raportul propriu. Ziua nu se salvează: fișa zilei
 * nu se trimite nimănui, iar cifrele ei intră singure în săptămână și în lună.
 */
export async function createReport(formData: FormData) {
  const { orgId, organization, user, role } = await requireOrg();
  const type = formData.get("tip");
  const anchor = String(formData.get("data") ?? "");
  if (!isReportType(type) || type === "zi" || !ISO_DAY.test(anchor)) return;

  const agentId = role === "agent" ? user.id : String(formData.get("ag") ?? "") || null;
  const domainId = String(formData.get("dom") ?? "") || null;

  const data = await buildReportSnapshot(orgId, organization.name, type, anchor, agentId, domainId);
  const supabase = await createClient();

  // O singură ciornă pe perioadă și filtre, pentru fiecare autor: la a doua
  // apăsare se deschide ciorna existentă, cu cifrele reîmprospătate și textele
  // păstrate, în loc să apară două rapoarte identice în listă.
  let existing = supabase
    .from("reports")
    .select("id")
    .eq("org_id", orgId)
    .eq("created_by", user.id)
    .eq("status", "ciorna")
    .eq("type", type)
    .eq("period_from", data.from);
  existing = agentId ? existing.eq("agent_filter", agentId) : existing.is("agent_filter", null);
  existing = domainId ? existing.eq("domain_filter", domainId) : existing.is("domain_filter", null);
  const { data: draft } = await existing.order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (draft) {
    await supabase.from("reports").update({ data }).eq("id", draft.id);
    refresh(draft.id);
    redirect(`${base(formData)}/${draft.id}`);
  }

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
      sections: defaultSections(type, scopeOf(data)),
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

  const reflection: Reflection = {};
  for (const q of REFLECTION_QUESTIONS) {
    const text = String(formData.get(`refl_${q.key}`) ?? "").trim();
    if (text) reflection[q.key] = text;
  }

  const { ok, bad } = parseRecipients(String(formData.get("recipients") ?? ""));
  if (bad.length) return { error: `Adrese de email greșite: ${bad.join(", ")}` };

  const supabase = await createClient();
  const fields = {
    title,
    summary: String(formData.get("summary") ?? "").trim() || null,
    sections,
    section_notes: notes,
    recipients: ok,
  };
  const { error } = await supabase.from("reports").update({ ...fields, reflection }).eq("id", id);
  if (error) {
    // Până se aplică migrația câmpului nou, restul raportului se salvează oricum.
    if (!/reflection/.test(error.message)) return { error: error.message };
    const { error: again } = await supabase.from("reports").update(fields).eq("id", id);
    if (again) return { error: again.message };
    refresh(id);
    return {
      error:
        "Raportul s-a salvat, fără cele patru întrebări: aplică migrația 20261001090000_raport_din_teren.sql în Supabase.",
    };
  }

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

/**
 * Înainte să se deschidă Outlook: raportul trece în „Trimis”, cu data trimiterii.
 * Deciziile se îngheață în raport, ca cifrele: PDF-ul rămâne cel citit de
 * destinatar, chiar dacă deciziile se închid între timp.
 */
export async function markReportSent(id: string) {
  await requireOrg();
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("reports")
    .select("id, agent_filter, period_from, created_at, data")
    .eq("id", id)
    .maybeSingle();
  const decisions = r ? await readReportDecisions(r as Parameters<typeof readReportDecisions>[0]) : null;
  await supabase
    .from("reports")
    .update({
      status: "trimis",
      sent_at: new Date().toISOString(),
      ...(r && decisions ? { data: { ...(r.data as object), decisions } } : {}),
    })
    .eq("id", id);
  refresh(id);
}

/** O decizie nouă, luată pe baza raportului: pentru aceeași țintă ca raportul. */
export async function addDecision(reportId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { orgId } = await requireOrg();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Scrie ce s-a hotărât." };
  const due = String(formData.get("due_date") ?? "");
  if (due && !ISO_DAY.test(due)) return { error: "Termenul nu e o dată validă." };

  const supabase = await createClient();
  const { data: report } = await supabase.from("reports").select("id, agent_filter").eq("id", reportId).maybeSingle();
  if (!report) return { error: "Raportul nu mai există." };

  const { error } = await supabase.from("report_decisions").insert({
    org_id: orgId,
    report_id: reportId,
    agent_filter: report.agent_filter,
    text,
    owner: String(formData.get("owner") ?? "").trim() || null,
    due_date: due || null,
  });
  if (error) {
    return {
      error: /report_decisions/.test(error.message)
        ? "Deciziile se pot nota după ce se aplică migrația 20261001180000_decizii.sql în Supabase."
        : error.message,
    };
  }
  refresh(reportId);
  return { success: "Decizia a fost notată." };
}

/** Starea unei decizii și ce a ieșit; „făcută” și „renunțăm” o închid. */
export async function updateDecision(formData: FormData) {
  await requireOrg();
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");
  if (!id || !isDecisionStatus(status)) return;
  const closed = status === "facuta" || status === "renuntat";

  const supabase = await createClient();
  // O decizie deja închisă își păstrează data: adăugarea rezultatului nu o redeschide.
  const { data: cur } = await supabase.from("report_decisions").select("closed_at").eq("id", id).maybeSingle();
  await supabase
    .from("report_decisions")
    .update({
      status,
      outcome: String(formData.get("outcome") ?? "").trim() || null,
      closed_at: closed ? ((cur?.closed_at as string | null) ?? new Date().toISOString()) : null,
    })
    .eq("id", id);
  refresh(String(formData.get("report_id") ?? "") || undefined);
}

export async function deleteDecision(formData: FormData) {
  await requireOrg();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("report_decisions").delete().eq("id", id);
  refresh(String(formData.get("report_id") ?? "") || undefined);
}

/** Ce spune `delete_report` când refuză, pe înțelesul celui care a apăsat. */
const DELETE_REASONS: Record<string, string> = {
  neautentificat: "Sesiunea a expirat. Intră din nou în cont și reîncearcă.",
  alta_firma: "Raportul este al altei firme.",
  fara_drept: "Doar autorul raportului sau conducerea firmei îl pot șterge.",
};

export async function deleteReport(formData: FormData) {
  await requireOrg();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();

  // Ștergerea trece prin funcția din baza de date, care verifică singură cine
  // are voie și spune de ce refuză. Până se aplică migrația ei, se încearcă
  // ștergerea directă și se verifică rândul întors.
  let motiv: string | null = null;
  const { data: rezultat, error: rpcError } = await supabase.rpc("delete_report", { p_id: id });
  if (!rpcError) {
    // Deja șters (de exemplu, un al doilea clic): nu mai e nimic de arătat.
    if (rezultat !== "sters" && rezultat !== "nu_exista") motiv = DELETE_REASONS[rezultat as string] ?? `Raportul nu a putut fi șters (${rezultat}).`;
  } else {
    const { data: deleted, error } = await supabase.from("reports").delete().eq("id", id).select("id");
    if (error) motiv = error.message;
    else if (!deleted?.length) {
      motiv =
        "Baza de date a refuzat ștergerea fără să spună de ce. Aplică migrația 20260928120000_rapoarte_stergere.sql în Supabase.";
    }
  }

  refresh(id);
  if (motiv) redirect(`${base(formData)}/${id}?eroare=${encodeURIComponent(motiv)}`);
  redirect(`${base(formData)}?sters=1`);
}
