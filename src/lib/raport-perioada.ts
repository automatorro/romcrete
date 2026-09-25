import { buildActivity } from "@/lib/activitate";
import { addDays, todayRo } from "@/lib/agenda";
import { getDomains } from "@/lib/domenii";
import { periodFor, previousLabel, REPORT_TYPES, type ReportType } from "@/lib/perioade";
import type { Kpi, ReportSnapshot } from "@/lib/raport-sectiuni";
import { createClient } from "@/lib/supabase/server";

// Tipurile și secțiunile stau separat, ca formularele din browser să le poată folosi.
export { ALL_SECTIONS, DEFAULT_SECTIONS, SECTION_LABELS } from "@/lib/raport-sectiuni";
export type { Kpi, KpiFormat, ReportSection, ReportSnapshot } from "@/lib/raport-sectiuni";

/** Întrebările din vizită care spun ceva despre piață, nu despre o firmă anume. */
const MARKET_GROUPS = ["obiectii", "atragere", "dece", "plata", "santier", "utilaj"];

const LIST_LIMIT = 80;

/** Zile lucrătoare din interval, până azi: ținta nu cere vizite în zile care n-au venit. */
function workingDaysUntilToday(from: string, to: string): number {
  const end = to < todayRo() ? to : todayRo();
  let n = 0;
  for (let d = from; d <= end; d = addDays(d, 1)) {
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd >= 1 && wd <= 5) n++;
  }
  return n;
}

/**
 * Cifrele unui raport pe o perioadă calendaristică. Se bazează pe aceleași
 * calcule ca exportul Excel, ca raportul și foaia de calcul să spună la fel.
 */
export async function buildReportSnapshot(
  orgId: string,
  orgName: string,
  type: ReportType,
  anchor: string,
  agentId: string | null,
  domainId: string | null,
): Promise<ReportSnapshot> {
  const p = periodFor(type, anchor);
  const supabase = await createClient();

  const [ds, domains, { data: activityRows }] = await Promise.all([
    buildActivity(orgId, p.from, p.to, p.granularity, agentId, domainId, { from: p.prevFrom, to: p.prevTo }),
    getDomains(orgId),
    supabase
      .from("client_activities")
      .select("kind, agent_id, occurred_at, clients(domain)")
      .eq("org_id", orgId)
      .in("kind", ["telefon", "email", "whatsapp"])
      .gte("occurred_at", `${p.prevFrom}T00:00:00Z`)
      .lt("occurred_at", `${addDays(p.to, 1)}T00:00:00Z`),
  ]);

  // Telefoanele și emailurile vin din istoricul firmelor, pe aceleași filtre.
  const contacts = ((activityRows ?? []) as unknown as {
    kind: string;
    agent_id: string | null;
    occurred_at: string;
    clients: { domain: string | null } | null;
  }[]).filter(
    (a) =>
      (!agentId || a.agent_id === agentId) &&
      (!domainId || (a.clients?.domain ?? "constructii") === domainId),
  );
  const countContacts = (kind: string, from: string, to: string, agent?: string) =>
    contacts.filter((a) => {
      const day = todayRo(new Date(a.occurred_at));
      return a.kind === kind && day >= from && day <= to && (agent === undefined || a.agent_id === agent);
    }).length;

  const member = (id: string) => ds.members.find((m) => m.user_id === id);
  const dailyTarget = (id: string) => member(id)?.target_visits_per_day ?? ds.orgTargetVisitsPerDay;
  const days = workingDaysUntilToday(p.from, p.to);

  // Ținta echipei: suma țintelor agenților de teren; filtrat pe un agent, ținta lui.
  const teamTarget = agentId
    ? dailyTarget(agentId) * days
    : ds.members.filter((m) => m.role === "agent").reduce((s, m) => s + dailyTarget(m.user_id) * days, 0) ||
      ds.orgTargetVisitsPerDay * days;

  const t = ds.total;
  const v = ds.previous;
  const kpis: Kpi[] = [
    { key: "vizite", label: "Vizite", value: t.vizite, prev: v.vizite, format: "int", target: teamTarget || null },
    { key: "firmeNoi", label: "Firme noi", value: t.firmeNoi, prev: v.firmeNoi, format: "int" },
    {
      key: "telefoane",
      label: "Telefoane",
      value: countContacts("telefon", p.from, p.to),
      prev: countContacts("telefon", p.prevFrom, p.prevTo),
      format: "int",
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      value: countContacts("whatsapp", p.from, p.to),
      prev: countContacts("whatsapp", p.prevFrom, p.prevTo),
      format: "int",
    },
    {
      key: "emailuri",
      label: "Emailuri",
      value: countContacts("email", p.from, p.to),
      prev: countContacts("email", p.prevFrom, p.prevTo),
      format: "int",
    },
    { key: "oferte", label: "Oferte emise", value: t.oferteEmise, prev: v.oferteEmise, format: "int" },
    { key: "valoare", label: "Valoare ofertată", value: t.valoareOferte, prev: v.valoareOferte, format: "money" },
    { key: "acceptate", label: "Oferte acceptate", value: t.oferteAcceptate, prev: v.oferteAcceptate, format: "int" },
    {
      key: "castig",
      label: "Rată de câștig",
      value: t.oferteEmise ? t.oferteAcceptate / t.oferteEmise : 0,
      prev: v.oferteEmise ? v.oferteAcceptate / v.oferteEmise : 0,
      format: "pct",
    },
    {
      key: "restante",
      label: "Pași restanți",
      value: t.pasiRestanti,
      prev: v.pasiRestanti,
      format: "int",
      lowerIsBetter: true,
    },
  ];

  const byGroup = new Map<string, { group: string; rows: [string, number][] }>();
  for (const m of ds.market) {
    if (!MARKET_GROUPS.includes(m.groupId)) continue;
    const g = byGroup.get(m.groupId) ?? { group: m.group, rows: [] };
    if (g.rows.length < 5) g.rows.push([m.option, m.firms]);
    byGroup.set(m.groupId, g);
  }

  const agentName = agentId ? (member(agentId)?.full_name ?? "Agent fără nume") : null;
  const domainName = domainId ? (domains.find((d) => d.id === domainId)?.label ?? domainId) : null;

  return {
    version: 1,
    type,
    typeLabel: REPORT_TYPES.find((r) => r.id === type)?.adjective ?? type,
    from: p.from,
    to: p.to,
    label: p.label,
    prevLabel: previousLabel[type],
    generatedAt: new Date().toISOString(),
    orgName,
    filters: { agentId, agent: agentName, domainId, domain: domainName },
    kpis,
    agents: ds.perAgent.map((a) => ({
      agent: a.agent,
      vizite: a.metrics.vizite,
      firmeNoi: a.metrics.firmeNoi,
      telefoane: countContacts("telefon", p.from, p.to, a.agentId),
      emailuri: countContacts("email", p.from, p.to, a.agentId),
      whatsapp: countContacts("whatsapp", p.from, p.to, a.agentId),
      oferte: a.metrics.oferteEmise,
      valoare: a.metrics.valoareOferte,
      acceptate: a.metrics.oferteAcceptate,
      tinta: a.agentId === "necunoscut" ? null : dailyTarget(a.agentId) * days || null,
    })),
    evolution: ds.perPeriod.map((b) => ({
      label: b.label,
      vizite: b.metrics.vizite,
      oferte: b.metrics.oferteEmise,
      valoare: b.metrics.valoareOferte,
    })),
    funnel: {
      vizite: t.vizite,
      cuPas: t.cuPasUrmator,
      oferteDinVizite: t.oferteDinVizite,
      acceptate: t.oferteAcceptate,
    },
    visits: ds.visits.slice(0, LIST_LIMIT).map((x) => ({
      date: x.date,
      agent: x.agent,
      client: x.client,
      city: x.city,
      prima: x.prima,
      nextStepDate: x.nextStepDate,
    })),
    quotes: ds.quotes.slice(0, LIST_LIMIT).map((q) => ({
      number: q.number,
      date: q.date,
      client: q.client,
      agent: q.agent,
      status: q.status,
      gross: q.gross,
    })),
    market: [...byGroup.values()],
    notes: ds.visits
      .flatMap((x) =>
        Object.values(x.notes ?? {})
          .filter((text) => text?.trim())
          .map((text) => ({ date: x.date, client: x.client, agent: x.agent, text: text.trim() })),
      )
      .slice(0, 25),
  };
}

/** Titlul propus la salvare: „Raport săptămânal · Săptămâna 39 · …”. */
export function defaultTitle(s: ReportSnapshot): string {
  return `Raport ${s.typeLabel} · ${s.label}${s.filters.agent ? ` · ${s.filters.agent}` : ""}`;
}
