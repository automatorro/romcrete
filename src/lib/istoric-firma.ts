import { shortDay as fmt, todayRo } from "@/lib/agenda";
import { HISTORY_LABELS, isManualKind, type HistoryItem, type HistoryKind } from "@/lib/istoric";
import { optionLabel } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import type { Answers, Notes, QuestionSection } from "@/lib/teren";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "@/lib/types";

type ActivityRow = {
  id: string;
  kind: Exclude<HistoryKind, "vizita">;
  agent_id: string | null;
  occurred_at: string;
  body: string | null;
  step_from: string | null;
  step_to: string | null;
  quote_id: string | null;
  visit_id: string | null;
  meta: { number?: string; status?: QuoteStatus; from?: QuoteStatus };
};

type VisitRow = {
  id: string;
  agent_id: string | null;
  visit_date: string;
  created_at: string;
  answers: Answers;
  notes: Notes;
  pump_skus: string[] | null;
  next_step_date: string | null;
};

/**
 * Istoricul complet al unei firme, cel mai nou sus. Vizitele vin din tabelul
 * lor, restul din `client_activities`; RLS decide ce vede fiecare.
 */
export async function getClientHistory(
  clientId: string,
  orgId: string,
  sections: QuestionSection[],
  viewer: { userId: string; isAdmin: boolean },
  opts: { visitHref?: (id: string) => string; quoteHref?: (id: string) => string } = {},
): Promise<HistoryItem[]> {
  const supabase = await createClient();
  const [{ data: visitRows }, { data: activityRows }, { data: memberRows }, { data: pumpRows }] =
    await Promise.all([
      supabase
        .from("visits")
        .select("id, agent_id, visit_date, created_at, answers, notes, pump_skus, next_step_date")
        .eq("client_id", clientId),
      supabase
        .from("client_activities")
        .select("id, kind, agent_id, occurred_at, body, step_from, step_to, quote_id, visit_id, meta")
        .eq("client_id", clientId),
      supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId),
      supabase.from("catalog_items").select("sku, name").eq("org_id", orgId).not("sku", "is", null),
    ]);

  const who = new Map((memberRows ?? []).map((m) => [m.user_id as string, (m.full_name as string | null) ?? "Fără nume"]));
  const pump = new Map((pumpRows ?? []).map((p) => [p.sku as string, p.name as string]));
  const groups = sections.flatMap((s) => s.groups);
  const agentName = (id: string | null) => (id ? (who.get(id) ?? "Coleg") : null);

  const visits: HistoryItem[] = ((visitRows ?? []) as VisitRow[]).map((v) => {
    const a = v.answers ?? {};
    const lines: string[] = [];
    if (a.interes) lines.push(`Interes: ${optionLabel(sections, "interes", String(a.interes))}`);
    if (v.pump_skus?.length) lines.push(`Modele: ${v.pump_skus.map((s) => pump.get(s) ?? s).join(", ")}`);
    for (const [gid, text] of Object.entries(v.notes ?? {})) {
      if (text?.trim()) lines.push(`${groups.find((g) => g.id === gid)?.label ?? gid}: ${text}`);
    }
    if (a.urmator) {
      lines.push(
        `→ ${optionLabel(sections, "urmator", String(a.urmator))}${v.next_step_date ? ` · ${fmt(v.next_step_date)}` : ""}`,
      );
    }
    return {
      id: v.id,
      kind: "vizita",
      date: v.visit_date,
      sortKey: `${v.visit_date}|${v.created_at}`,
      title: "Vizită",
      lines,
      agent: agentName(v.agent_id),
      href: opts.visitHref ? opts.visitHref(v.id) : null,
      deletable: false,
    };
  });

  const activities: HistoryItem[] = ((activityRows ?? []) as ActivityRow[]).map((r) => {
    const date = todayRo(new Date(r.occurred_at));
    const lines: string[] = [];
    let title = HISTORY_LABELS[r.kind];
    let href: string | null = null;

    if (r.kind === "oferta_creata" || r.kind === "oferta_stare") {
      const number = r.meta?.number ?? "";
      const status = r.meta?.status ? QUOTE_STATUS_LABELS[r.meta.status] : "";
      title =
        r.kind === "oferta_creata"
          ? `Ofertă ${number} creată`
          : `Ofertă ${number}: ${status.toLowerCase()}`;
      if (!r.quote_id) lines.push("Oferta a fost ștearsă între timp.");
      else if (opts.quoteHref) href = opts.quoteHref(r.quote_id);
    } else if (r.kind === "pas_amanat") {
      if (r.step_to) lines.push(`Mutat${r.step_from ? ` de pe ${fmt(r.step_from)}` : ""} pe ${fmt(r.step_to)}`);
    } else if (r.kind === "pas_inchis") {
      lines.push("Fără o nouă revenire programată.");
    } else if (r.step_to) {
      lines.push(`→ Revine pe ${fmt(r.step_to)}`);
    } else if (r.visit_id) {
      lines.push("Pas închis, fără o nouă revenire programată.");
    }
    if (r.body?.trim()) lines.unshift(r.body.trim());

    return {
      id: r.id,
      kind: r.kind,
      date,
      sortKey: `${date}|${r.occurred_at}`,
      title,
      lines,
      agent: agentName(r.agent_id),
      href,
      deletable: isManualKind(r.kind) && (viewer.isAdmin || r.agent_id === viewer.userId),
    };
  });

  return [...visits, ...activities].sort((x, y) => y.sortKey.localeCompare(x.sortKey));
}
