import { createClient } from "@/lib/supabase/server";

export type DecisionStatus = "deschisa" | "in_lucru" | "facuta" | "renuntat";

export const DECISION_STATUS_LABELS: Record<DecisionStatus, string> = {
  deschisa: "Deschisă",
  in_lucru: "În lucru",
  facuta: "Făcută",
  renuntat: "Renunțăm",
};

export const isDecisionStatus = (v: unknown): v is DecisionStatus =>
  v === "deschisa" || v === "in_lucru" || v === "facuta" || v === "renuntat";

export type Decision = {
  id: string;
  report_id: string | null;
  text: string;
  owner: string | null;
  due_date: string | null;
  status: DecisionStatus;
  outcome: string | null;
  closed_at: string | null;
  created_at: string;
};

/** Ce arată raportul: urmărirea deciziilor de dinainte și deciziile luate acum. */
export type ReportDecisions = {
  /** Decizii din rapoartele anterioare: cele încă deschise și cele închise de la începutul perioadei. */
  followUp: Decision[];
  /** Decizii luate în acest raport. */
  created: Decision[];
};

const COLUMNS = "id, report_id, text, owner, due_date, status, outcome, closed_at, created_at";

/**
 * Deciziile unui raport, pe aceeași țintă (agentul lui sau echipa). Întoarce
 * null până se aplică migrația tabelului, ca pagina să poată spune ce lipsește.
 */
export async function readReportDecisions(report: {
  id: string;
  org_id?: string;
  agent_filter: string | null;
  period_from: string;
  created_at?: string;
}): Promise<ReportDecisions | null> {
  const supabase = await createClient();
  let q = supabase.from("report_decisions").select(COLUMNS).order("created_at");
  q = report.agent_filter ? q.eq("agent_filter", report.agent_filter) : q.is("agent_filter", null);
  const { data, error } = await q;
  if (error) return null;

  const rows = (data ?? []) as Decision[];
  const created = rows.filter((d) => d.report_id === report.id);
  const followUp = rows.filter(
    (d) =>
      d.report_id !== report.id &&
      // Doar ce exista când s-a scris raportul: deciziile de după aparțin rapoartelor de după.
      (!report.created_at || d.created_at <= report.created_at) &&
      (!d.closed_at || d.closed_at.slice(0, 10) >= report.period_from),
  );
  return { followUp, created };
}

/** Deciziile deschise cu termenul trecut, pe o țintă: pentru „De reținut”. */
export async function overdueDecisions(orgId: string, agentId: string | null, asOf: string): Promise<number> {
  const supabase = await createClient();
  let q = supabase
    .from("report_decisions")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["deschisa", "in_lucru"])
    .lt("due_date", asOf);
  q = agentId ? q.eq("agent_filter", agentId) : q.is("agent_filter", null);
  const { count, error } = await q;
  return error ? 0 : (count ?? 0);
}
