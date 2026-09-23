import { getQuestionCatalogue, optionLabel } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import type { Answers, Focus, Notes, QuestionSection } from "@/lib/teren";

export type Period = "7" | "30" | "all";

export type VisitRow = {
  id: string;
  client_id: string;
  agent_id: string | null;
  visit_date: string;
  answers: Answers;
  notes: Notes;
  pump_skus: string[];
  clients: { name: string } | null;
};

export type Report = {
  sections: QuestionSection[];
  members: { user_id: string; full_name: string | null; target_visits_per_day: number | null }[];
  /** Zile lucrătoare din perioada aleasă, pentru comparația cu ținta zilnică. */
  workingDays: number;
  orgTargetVisitsPerDay: number;
  visits: VisitRow[];
  clientCount: number;
  quotesFromVisits: number;
  acceptedQuotes: number;
  quotedValue: number;
  /** Numărul de firme pe fiecare opțiune a unui grup, în ordine descrescătoare. */
  countBy: (groupId: string) => [string, number][];
  workModes: Record<string, number>;
  models: [string, number][];
  perAgent: { agentId: string; visits: number; clients: number; last: string }[];
  escalations: { id: string; firma: string; date: string; items: string[] }[];
  /** Câte firme sunt în fiecare cadran — ce e de făcut cu ele, nu doar cât sunt de calde. */
  focusCounts: Record<Focus, number>;
  /** Ce anume oprește firmele care vor, dar nu pot. */
  blockers: [string, number][];
  freeNotes: { firma: string; date: string; group: string; text: string }[];
};

export const periodCutoff = (period: Period): string | null =>
  period === "all"
    ? null
    : new Date(Date.now() - Number(period) * 86400000).toISOString().slice(0, 10);

/**
 * Agregările raportului. Stau aici, nu în pagină, pentru că sunt reguli de
 * afacere: „o firmă se numără o dată”, „modul de lucru e cel din ultima vizită
 * în care s-a notat”. Pagina doar le afișează.
 */
export async function buildReport(
  orgId: string,
  period: Period,
  agentId: string,
): Promise<Report> {
  const cut = periodCutoff(period);
  const supabase = await createClient();
  const azi = new Date().toISOString().slice(0, 10);

  // Zile de luni până vineri din perioadă: fără ele, „vizite pe zi” e diluat de weekenduri.
  let workingDays = 0;
  for (let d = new Date(`${cut ?? azi}T12:00:00Z`); d.toISOString().slice(0, 10) <= azi; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd >= 1 && wd <= 5) workingDays++;
  }
  const sections = await getQuestionCatalogue(orgId);

  let visitQuery = supabase
    .from("visits")
    .select("id, client_id, agent_id, visit_date, answers, notes, pump_skus, clients(name)")
    .eq("org_id", orgId)
    .order("visit_date", { ascending: false });
  if (cut) visitQuery = visitQuery.gte("visit_date", cut);
  if (agentId) visitQuery = visitQuery.eq("agent_id", agentId);

  const [{ data: visitRows }, { data: memberRows }, { data: quoteRows }, { data: itemRows }] =
    await Promise.all([
      visitQuery,
      supabase
        .from("memberships")
        .select("user_id, full_name, target_visits_per_day")
        .eq("org_id", orgId),
      supabase.from("quotes").select("id, status, visit_id").eq("org_id", orgId),
      supabase.from("catalog_items").select("sku, name").eq("org_id", orgId).not("sku", "is", null),
    ]);

  // Cadranele se citesc din view, care aplică aceleași reguli ca pe teren.
  const { data: stateRows } = await supabase
    .from("client_state")
    .select("focus, answers")
    .eq("org_id", orgId);

  const visits = (visitRows ?? []) as unknown as VisitRow[];
  const pumpName = new Map((itemRows ?? []).map((i) => [i.sku as string, i.name as string]));

  const visitIds = new Set(visits.map((v) => v.id));
  const fromVisits = (quoteRows ?? []).filter((q) => q.visit_id && visitIds.has(q.visit_id));

  const { data: totalRows } = await supabase
    .from("quote_totals")
    .select("quote_id, net_total, vat_total")
    .in(
      "quote_id",
      fromVisits.length ? fromVisits.map((q) => q.id) : ["00000000-0000-0000-0000-000000000000"],
    );

  const countBy = (groupId: string): [string, number][] => {
    // O firmă contează o singură dată per opțiune, oricâte vizite ar avea.
    const seen = new Map<string, Set<string>>();
    for (const v of visits) {
      const raw = v.answers?.[groupId];
      const values = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
      for (const val of values) {
        const set = seen.get(val) ?? new Set<string>();
        set.add(v.client_id);
        seen.set(val, set);
      }
    }
    return [...seen.entries()]
      .map(([id, set]) => [optionLabel(sections, groupId, id), set.size] as [string, number])
      .sort((a, b) => b[1] - a[1]);
  };

  // Modul de lucru al unei firme e cel din ultima vizită în care s-a notat.
  const lastMode = new Map<string, string>();
  for (const v of [...visits].reverse()) {
    if (typeof v.answers?.mod === "string" && v.answers.mod) lastMode.set(v.client_id, v.answers.mod);
  }
  const workModes: Record<string, number> = {};
  for (const mode of lastMode.values()) workModes[mode] = (workModes[mode] ?? 0) + 1;

  const modelCounts = new Map<string, number>();
  for (const v of visits) {
    for (const sku of v.pump_skus ?? []) modelCounts.set(sku, (modelCounts.get(sku) ?? 0) + 1);
  }

  const agents = new Map<string, { visits: number; clients: Set<string>; last: string }>();
  for (const v of visits) {
    const key = v.agent_id ?? "necunoscut";
    const rec = agents.get(key) ?? { visits: 0, clients: new Set<string>(), last: "" };
    rec.visits++;
    rec.clients.add(v.client_id);
    if (v.visit_date > rec.last) rec.last = v.visit_date;
    agents.set(key, rec);
  }

  const allGroups = sections.flatMap((s) => s.groups);

  const focusCounts: Record<Focus, number> = {
    urmareste: 0, deblocheaza: 0, educa: 0, lasa: 0, necunoscut: 0,
  };
  const blocaje = new Map<string, number>();
  for (const row of stateRows ?? []) {
    const f = (row.focus as Focus) ?? "necunoscut";
    focusCounts[f] = (focusCounts[f] ?? 0) + 1;
    if (f !== "deblocheaza") continue;

    // Numim blocajul cu numele lui: altfel „deblochează” rămâne o etichetă fără acțiune.
    const a = (row.answers ?? {}) as Answers;
    const santier = Array.isArray(a.santier) ? (a.santier as string[]) : [];
    if (a.plata === "nupoate") blocaje.set("Nu are cu ce plăti acum", (blocaje.get("Nu are cu ce plăti acum") ?? 0) + 1);
    if (!a.plata || a.plata === "nustie") blocaje.set("Nu se știe cum ar plăti", (blocaje.get("Nu se știe cum ar plăti") ?? 0) + 1);
    if (santier.includes("faracurent") && !santier.includes("230v") && !santier.includes("trifazic"))
      blocaje.set("Șantiere fără curent", (blocaje.get("Șantiere fără curent") ?? 0) + 1);
    if (a.refuzat === "nu") blocaje.set("Nu are destule lucrări", (blocaje.get("Nu are destule lucrări") ?? 0) + 1);
  }

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("target_visits_per_day")
    .eq("id", orgId)
    .maybeSingle();

  return {
    sections,
    members: memberRows ?? [],
    workingDays,
    orgTargetVisitsPerDay: Number(orgRow?.target_visits_per_day ?? 5),
    visits,
    clientCount: new Set(visits.map((v) => v.client_id)).size,
    quotesFromVisits: fromVisits.length,
    acceptedQuotes: fromVisits.filter((q) => q.status === "accepted").length,
    quotedValue: (totalRows ?? []).reduce(
      (s, t) => s + Number(t.net_total) + Number(t.vat_total),
      0,
    ),
    countBy,
    workModes,
    models: [...modelCounts.entries()]
      .map(([sku, n]) => [pumpName.get(sku) ?? sku, n] as [string, number])
      .sort((a, b) => b[1] - a[1]),
    perAgent: [...agents.entries()]
      .map(([agentId, r]) => ({ agentId, visits: r.visits, clients: r.clients.size, last: r.last }))
      .sort((a, b) => b.visits - a.visits),
    focusCounts,
    blockers: [...blocaje.entries()].sort((a, b) => b[1] - a[1]),
    escalations: visits
      .filter((v) => Array.isArray(v.answers?.esc) && (v.answers.esc as string[]).length > 0)
      .map((v) => ({
        id: v.id,
        firma: v.clients?.name ?? "—",
        date: v.visit_date,
        items: (v.answers.esc as string[]).map((e) => optionLabel(sections, "esc", e)),
      })),
    freeNotes: visits
      .flatMap((v) =>
        Object.entries(v.notes ?? {})
          .filter(([, t]) => t?.trim())
          .map(([gid, t]) => ({
            firma: v.clients?.name ?? "—",
            date: v.visit_date,
            group: allGroups.find((g) => g.id === gid)?.label ?? gid,
            text: t,
          })),
      )
      .slice(0, 25),
  };
}
