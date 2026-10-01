import { buildActivity } from "@/lib/activitate";
import { addDays, todayRo } from "@/lib/agenda";
import { overdueDecisions } from "@/lib/decizii";
import { getDomains } from "@/lib/domenii";
import { periodFor, previousLabel, REPORT_TYPES, type ReportType } from "@/lib/perioade";
import { scopeOf, type Highlight, type Kpi, type ReportSnapshot } from "@/lib/raport-sectiuni";
import { lossReasonLabel } from "@/lib/pierderi";
import { formatMoney } from "@/lib/totals";
import { createClient } from "@/lib/supabase/server";

// Tipurile și secțiunile stau separat, ca formularele din browser să le poată folosi.
export {
  ALL_SECTIONS, defaultSections, hasReflection, REFLECTION_QUESTIONS, SCOPE_LABELS, SECTION_LABELS, sectionsFor, scopeOf,
} from "@/lib/raport-sectiuni";
export { PRIMARY_KPIS } from "@/lib/raport-sectiuni";
export type {
  Highlight, Kpi, KpiFormat, Reflection, ReportScope, ReportSection, ReportSnapshot,
} from "@/lib/raport-sectiuni";

/** Întrebările din vizită care spun ceva despre piață, nu despre o firmă anume. */
const MARKET_GROUPS = ["obiectii", "atragere", "dece", "plata", "santier", "utilaj", "oameni"];

/** Sub atâtea firme care au răspuns, o schimbare de procent e zgomot, nu semnal. */
export const MARKET_MIN_BASE = 5;

const LUNI_LUNG = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

/** Vechimea ofertelor care așteaptă: cât de reci sunt banii. */
const AGING: { label: string; max: number }[] = [
  { label: "0–15 zile", max: 15 },
  { label: "16–30 zile", max: 30 },
  { label: "31–60 zile", max: 60 },
  { label: "peste 60 de zile", max: Infinity },
];

const LIST_LIMIT = 80;
/** Listele de acțiune se citesc într-o ședință: primele, nu toate. */
const ACTION_LIMIT = 12;

const ZILE_SCURT = ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sâ"];
const LUNI_SCURT = ["ian.", "feb.", "mar.", "apr.", "mai", "iun.", "iul.", "aug.", "sept.", "oct.", "nov.", "dec."];

/** Eticheta de sub coloana graficului, după cheia găletii din `buildActivity`. */
function shortLabel(key: string, granularity: "zi" | "saptamana" | "luna"): string {
  if (granularity === "luna") return LUNI_SCURT[Number(key.slice(5, 7)) - 1];
  const d = new Date(`${key}T12:00:00Z`);
  if (granularity === "zi") return `${ZILE_SCURT[d.getUTCDay()]} ${d.getUTCDate()}`;
  const end = addDays(key, 6);
  return `${Number(key.slice(8, 10))}–${Number(end.slice(8, 10))}.${end.slice(5, 7)}`;
}

const nr = (n: number, unu: string, multe: string) => `${n} ${n === 1 ? unu : multe}`;

/**
 * Ce merită citit înainte de cifre, scris din cifre: ținta, banii care
 * așteaptă, restanțele și întrebările deschise. Cel mult cinci rânduri.
 */
function buildHighlights(
  s: Pick<
    ReportSnapshot,
    | "kpis" | "pending" | "overdue" | "escalations" | "prevLabel" | "opportunities" | "slipping" | "market" | "type"
    | "losses"
  >,
  isCurrent: boolean,
  acceptedValue: number,
  /** Cât din zilele lucrătoare ale perioadei au trecut (0–1), pentru ritmul vânzărilor. */
  elapsed: number,
  /** Decizii deschise cu termenul trecut, pe aceeași țintă. */
  lateDecisions = 0,
): Highlight[] {
  const out: Highlight[] = [];

  if (lateDecisions > 0) {
    out.push({
      tone: "atentie",
      text: `${nr(lateDecisions, "decizie a trecut", "decizii au trecut")} de termen și nu ${lateDecisions === 1 ? "e închisă" : "sunt închise"}.`,
    });
  }
  const k = (key: string) => s.kpis.find((x) => x.key === key);

  // Vânzările față de ținta lunii: în luna curentă, față de cât din lună a trecut.
  const sales = k("vanzari");
  if (sales?.target) {
    const pct = Math.round((sales.value / sales.target) * 100);
    const ritm = Math.round(elapsed * 100);
    const perioada = s.type === "trimestru" ? "trimestrului" : "lunii";
    out.push({
      tone: pct >= 100 ? "bine" : isCurrent ? (pct >= ritm - 10 ? "info" : "atentie") : "atentie",
      text:
        `Vânzări: ${formatMoney(sales.value)} din ținta ${perioada} de ${formatMoney(sales.target)} (${pct}%)` +
        (isCurrent && pct < 100 ? `, după ${ritm}% din zilele lucrătoare ale ${perioada}.` : "."),
    });
  }

  const viz = k("vizite");
  if (viz?.target) {
    const pct = Math.round((viz.value / viz.target) * 100);
    out.push(
      pct >= 100
        ? { tone: "bine", text: `Ținta de vizite e atinsă: ${viz.value} din ${viz.target} (${pct}%).` }
        : {
            tone: pct >= 80 ? "info" : "atentie",
            text: `Vizite: ${viz.value} din ținta de ${viz.target}${isCurrent ? " până azi" : ""} (${pct}%).`,
          },
    );
  }

  const acc = k("acceptate");
  const castig = k("castig");
  if (acc && acc.value > 0 && !sales?.target) {
    out.push({
      tone: "bine",
      text:
        `${nr(acc.value, "ofertă acceptată", "oferte acceptate")}, ${formatMoney(acceptedValue)}` +
        (castig ? `; rată de câștig ${Math.round(castig.value * 100)}%` : "") +
        ".",
    });
  }

  const p = s.pending;
  if (p && p.expiring > 0) {
    out.push({
      tone: "atentie",
      text: `${nr(p.expiring, "ofertă trimisă expiră", "oferte trimise expiră")} în următoarele 7 zile, în valoare de ${formatMoney(p.expiringValue)}.`,
    });
  } else if (p && p.count > 0) {
    out.push({
      tone: "info",
      text: `${nr(p.count, "ofertă așteaptă", "oferte așteaptă")} răspuns, în valoare de ${formatMoney(p.total)}.`,
    });
  }
  const vechi = p?.rows.filter((r) => r.zile > 30).length ?? 0;
  if (vechi > 0) {
    out.push({ tone: "atentie", text: `${nr(vechi, "ofertă așteaptă", "oferte așteaptă")} răspuns de peste 30 de zile.` });
  }

  const res = k("restante");
  if (res && res.value > 0) {
    out.push({
      tone: res.value > res.prev ? "atentie" : "info",
      text: `${nr(res.value, "pas restant", "pași restanți")} (${res.prev} față de ${s.prevLabel}).`,
    });
  }

  const uitate = s.slipping?.count ?? 0;
  if (uitate > 0) {
    out.push({
      tone: "atentie",
      text: `${nr(uitate, "firmă caldă n-a mai fost contactată", "firme calde n-au mai fost contactate")} la timp și nu au un pas stabilit.`,
    });
  }

  const curand = s.opportunities?.count ?? 0;
  if (curand > 0) {
    out.push({
      tone: "info",
      text: `${nr(curand, "firmă are", "firme au")} o vânzare care se deschide: spun că ar cumpăra curând sau au utilajul de schimbat.`,
    });
  }

  // De ce pierdem: motivul care se repetă, cât timp e notat la cele mai multe.
  const l = s.losses;
  if (l && l.count > 0) {
    const top = l.byReason.find((r) => r.label !== lossReasonLabel(null));
    if (top && top.count >= 2) {
      out.push({
        tone: "atentie",
        text: `Cel mai des pierdem pe „${top.label.toLowerCase()}”: ${top.count} din ${nr(l.count, "ofertă pierdută", "oferte pierdute")}, ${formatMoney(top.value)}.`,
      });
    }
    if (l.unknown > 0) {
      out.push({
        tone: "info",
        text: `${nr(l.unknown, "ofertă pierdută nu are", "oferte pierdute nu au")} motivul notat.`,
      });
    }
  }

  // Cea mai mare schimbare din piață față de perioada anterioară, pe o bază destul de mare.
  let shift: { text: string; size: number } | null = null;
  for (const g of s.market) {
    if (!g.answered || !g.prevAnswered || g.answered < MARKET_MIN_BASE || g.prevAnswered < MARKET_MIN_BASE) continue;
    for (const [option, firms] of g.rows) {
      const now = firms / g.answered;
      const before = (g.prev?.[option] ?? 0) / g.prevAnswered;
      const size = Math.abs(now - before);
      if (size >= 0.15 && (!shift || size > shift.size)) {
        shift = {
          size,
          text: `Piața: „${option}” (${g.group.toLowerCase()}) ${now > before ? "a crescut" : "a scăzut"} de la ${Math.round(before * 100)}% la ${Math.round(now * 100)}% din firme, față de ${s.prevLabel}.`,
        };
      }
    }
  }
  if (shift) out.push({ tone: "info", text: shift.text });

  const esc = s.escalations?.length ?? 0;
  if (esc > 0) {
    out.push({ tone: "atentie", text: `${nr(esc, "întrebare tehnică așteaptă", "întrebări tehnice așteaptă")} răspunsul conducerii.` });
  }

  // Ordinea: ce cere acțiune întâi, apoi veștile bune, apoi restul.
  const rank = { atentie: 0, bine: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 5);
}

/** Zile lucrătoare din tot intervalul, capetele incluse. */
function workingDaysBetween(from: string, to: string): number {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd >= 1 && wd <= 5) n++;
  }
  return n;
}

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
 * Țintele lunare de vânzări: a firmei și ale fiecărui om. Până se aplică
 * migrația lor, coloanele lipsesc și raportul merge mai departe fără țintă.
 */
async function readSalesTargets(orgId: string): Promise<{ org: number; byUser: Map<string, number | null> }> {
  const supabase = await createClient();
  const [{ data: org, error: orgError }, { data: members, error: memberError }] = await Promise.all([
    supabase.from("organizations").select("target_sales_per_month").eq("id", orgId).maybeSingle(),
    supabase.from("memberships").select("user_id, target_sales_per_month").eq("org_id", orgId),
  ]);
  return {
    org: orgError ? 0 : Number(org?.target_sales_per_month ?? 0),
    byUser: new Map(
      memberError
        ? []
        : (members ?? []).map((m) => [
            m.user_id as string,
            m.target_sales_per_month === null ? null : Number(m.target_sales_per_month),
          ]),
    ),
  };
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

  // Raportul lunar și cel trimestrial se uită și în urmă: ultimele 6 luni, pe luni.
  const lunar = type === "luna" || type === "trimestru";
  const trendFrom = (() => {
    const [y, m] = p.to.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 - 5, 1));
    return d.toISOString().slice(0, 10);
  })();

  const [ds, domains, { data: activityRows }, trendDs, salesTargets] = await Promise.all([
    buildActivity(orgId, p.from, p.to, p.granularity, agentId, domainId, { from: p.prevFrom, to: p.prevTo }),
    getDomains(orgId),
    supabase
      .from("client_activities")
      .select("kind, agent_id, occurred_at, clients(domain)")
      .eq("org_id", orgId)
      .in("kind", ["telefon", "email", "whatsapp"])
      .gte("occurred_at", `${p.prevFrom}T00:00:00Z`)
      .lt("occurred_at", `${addDays(p.to, 1)}T00:00:00Z`),
    lunar ? buildActivity(orgId, trendFrom, p.to, "luna", agentId, domainId) : Promise.resolve(null),
    readSalesTargets(orgId),
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

  // Ținta echipei: suma țintelor celor din tabelul pe agenți — agenții echipei și
  // oricine a lucrat în perioadă —, ca vizitele și ținta să numere aceiași oameni.
  // Pe un agent, ținta lui.
  const teamTarget = agentId
    ? dailyTarget(agentId) * days
    : ds.perAgent
        .filter((a) => a.agentId !== "necunoscut")
        .reduce((s, a) => s + dailyTarget(a.agentId) * days, 0) || ds.orgTargetVisitsPerDay * days;

  const t = ds.total;
  const v = ds.previous;

  // Ținta de vânzări pe lună a celor numărați; pe trimestru, de trei ori.
  const salesTarget = (id: string) => salesTargets.byUser.get(id) ?? salesTargets.org;
  const monthlySales = agentId
    ? salesTarget(agentId)
    : ds.perAgent.filter((a) => a.agentId !== "necunoscut").reduce((s, a) => s + salesTarget(a.agentId), 0) ||
      salesTargets.org;
  const salesTargetPeriod = lunar && monthlySales > 0 ? monthlySales * (type === "trimestru" ? 3 : 1) : null;
  const isCurrent = p.to >= todayRo();

  // Banii care așteaptă: ofertele trimise, fără răspuns, la data raportului.
  const asOf = p.to < todayRo() ? p.to : todayRo();
  const inSapteZile = addDays(asOf, 7);
  const expiring = ds.pending.filter((q) => q.validUntil && q.validUntil <= inSapteZile);
  const aging = AGING.map((b, i) => {
    const min = i ? AGING[i - 1].max + 1 : 0;
    const rows = ds.pending.filter((q) => q.zile >= min && q.zile <= b.max);
    return { label: b.label, count: rows.length, value: Math.round(rows.reduce((s, q) => s + q.gross, 0) * 100) / 100 };
  });
  const pending = {
    aging,
    total: Math.round(ds.pending.reduce((s, q) => s + q.gross, 0) * 100) / 100,
    count: ds.pending.length,
    expiring: expiring.length,
    expiringValue: Math.round(expiring.reduce((s, q) => s + q.gross, 0) * 100) / 100,
    // Cele care expiră întâi, apoi cele mai mari.
    rows: [...ds.pending]
      .sort(
        (a, b) =>
          Number(Boolean(b.validUntil && b.validUntil <= inSapteZile)) -
            Number(Boolean(a.validUntil && a.validUntil <= inSapteZile)) || b.gross - a.gross,
      )
      .slice(0, ACTION_LIMIT)
      .map((q) => ({ ...q, expira: Boolean(q.validUntil && q.validUntil <= inSapteZile) })),
  };
  // Ținta pe zi a celor numărați: un agent, sau toată echipa.
  const dailyTeamTarget = agentId
    ? dailyTarget(agentId)
    : ds.perAgent.filter((a) => a.agentId !== "necunoscut").reduce((s, a) => s + dailyTarget(a.agentId), 0) ||
      ds.orgTargetVisitsPerDay;
  const kpis: Kpi[] = [
    {
      key: "vizite",
      label: "Vizite",
      value: t.vizite,
      prev: v.vizite,
      format: "int",
      target: teamTarget || null,
      targetNote: isCurrent ? "până azi" : "pe perioadă",
    },
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
    {
      key: "oferte",
      label: "Oferte emise",
      value: t.oferteEmise,
      prev: v.oferteEmise,
      format: "int",
      hint: "trimise clientului, fără ciorne",
    },
    {
      key: "valoare",
      label: "Valoare ofertată",
      value: t.valoareOferte,
      prev: v.valoareOferte,
      format: "money",
      hint: "ofertele emise, cu TVA",
    },
    {
      key: "vanzari",
      label: "Vânzări",
      value: t.valoareAcceptata,
      prev: v.valoareAcceptata,
      format: "money",
      hint: "oferte acceptate în perioadă, cu TVA",
      target: salesTargetPeriod,
      targetNote: type === "trimestru" ? "pe trimestru" : "pe lună",
    },
    {
      key: "acceptate",
      label: "Oferte acceptate",
      value: t.oferteAcceptate,
      prev: v.oferteAcceptate,
      format: "int",
      hint: "acceptate în perioadă, oricând ar fi fost emise",
    },
    {
      key: "castig",
      label: "Rată de câștig",
      value: t.oferteDecise ? t.oferteAcceptate / t.oferteDecise : 0,
      prev: v.oferteDecise ? v.oferteAcceptate / v.oferteDecise : 0,
      format: "pct",
      hint: t.oferteDecise
        ? `${t.oferteAcceptate} acceptate din ${t.oferteDecise} cu răspuns în perioadă`
        : "nicio ofertă cu răspuns în perioadă",
    },
    {
      key: "restante",
      label: "Pași restanți",
      value: t.pasiRestanti,
      prev: v.pasiRestanti,
      format: "int",
      lowerIsBetter: true,
      hint: "la sfârșitul perioadei",
    },
    {
      key: "asteptare",
      label: "Așteaptă răspuns",
      value: pending.total,
      // Starea de acum a ofertelor; perioada anterioară nu are o fotografie a ei.
      prev: pending.total,
      noCompare: true,
      format: "money",
      hint: `${nr(pending.count, "ofertă trimisă", "oferte trimise")}, fără răspuns`,
    },
  ];

  type MarketGroup = ReportSnapshot["market"][number];
  const byGroup = new Map<string, MarketGroup>();
  for (const m of ds.market) {
    if (!MARKET_GROUPS.includes(m.groupId)) continue;
    const g = byGroup.get(m.groupId) ?? { group: m.group, rows: [], answered: m.answered, prevAnswered: 0, prev: {} };
    if (g.rows.length < 5) g.rows.push([m.option, m.firms]);
    byGroup.set(m.groupId, g);
  }
  // Perioada anterioară, pentru aceleași răspunsuri: piața ca tendință.
  for (const m of ds.marketPrevious) {
    const g = byGroup.get(m.groupId);
    if (!g) continue;
    g.prevAnswered = m.answered;
    g.prev![m.option] = m.firms;
  }

  const agentName = agentId ? (member(agentId)?.full_name ?? "Agent fără nume") : null;
  const recente = [...ds.visits].reverse();
  const domainName = domainId ? (domains.find((d) => d.id === domainId)?.label ?? domainId) : null;

  const snapshot: ReportSnapshot = {
    version: 1,
    type,
    typeLabel: REPORT_TYPES.find((r) => r.id === type)?.adjective ?? type,
    from: p.from,
    to: p.to,
    label: p.label,
    prevLabel: previousLabel[type],
    generatedAt: new Date().toISOString(),
    orgName,
    scope: agentId ? "agent" : "echipa",
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
      short: shortLabel(b.key, p.granularity),
      vizite: b.metrics.vizite,
      oferte: b.metrics.oferteEmise,
      valoare: b.metrics.valoareOferte,
      tinta: dailyTeamTarget * b.metrics.zileLucratoare || null,
      viitor: (p.granularity === "luna" ? `${b.key}-01` : b.key) > todayRo(),
    })),
    trend: trendDs?.perPeriod.map((b) => {
      const [y, m] = b.key.split("-").map(Number);
      return {
        label: `${LUNI_LUNG[m - 1]} ${y}`,
        short: shortLabel(b.key, "luna"),
        vizite: b.metrics.vizite,
        oferte: b.metrics.oferteEmise,
        vanzari: b.metrics.valoareAcceptata,
        castig: b.metrics.oferteDecise ? b.metrics.oferteAcceptate / b.metrics.oferteDecise : null,
        curent: `${b.key}-01` >= p.from.slice(0, 8) + "01" && `${b.key}-01` <= p.to,
        viitor: `${b.key}-01` > todayRo(),
      };
    }),
    losses: (() => {
      const grupe = new Map<string, { label: string; count: number; value: number }>();
      for (const x of ds.lost) {
        const label = lossReasonLabel(x.reason);
        const g = grupe.get(label) ?? { label, count: 0, value: 0 };
        g.count++;
        g.value = Math.round((g.value + x.gross) * 100) / 100;
        grupe.set(label, g);
      }
      return {
        count: ds.lost.length,
        value: Math.round(ds.lost.reduce((s, x) => s + x.gross, 0) * 100) / 100,
        unknown: ds.lost.filter((x) => !x.reason).length,
        // Nenotatele la urmă: nu sunt un motiv, sunt o lipsă.
        byReason: [...grupe.values()].sort(
          (a, b) =>
            Number(a.label === lossReasonLabel(null)) - Number(b.label === lossReasonLabel(null)) ||
            b.count - a.count ||
            b.value - a.value,
        ),
        rows: ds.lost.slice(0, ACTION_LIMIT).map((x) => ({ ...x, reason: lossReasonLabel(x.reason) })),
      };
    })(),
    pending,
    overdue: { count: ds.overdue.length, rows: ds.overdue.slice(0, ACTION_LIMIT) },
    // Privirea înainte: starea de acum a firmelor, nu a perioadei.
    opportunities: {
      count: ds.opportunities.length,
      rows: ds.opportunities.slice(0, ACTION_LIMIT).map((o) => ({
        client: o.client,
        agent: o.agent,
        reasons: o.reasons,
        interest: o.interest,
        nextStep: o.nextStep,
        nextStepDate: o.nextStepDate,
      })),
    },
    slipping: { count: ds.slipping.length, rows: ds.slipping.slice(0, ACTION_LIMIT) },
    // Toate: sunt puține și fiecare așteaptă un răspuns de la conducere.
    escalations: ds.escalations,
    // Pâlnia urmărește aceleași oferte de la un pas la altul: acceptate sunt
    // doar cele pornite din vizite, nu toate acceptările perioadei.
    funnel: {
      vizite: t.vizite,
      cuPas: t.cuPasUrmator,
      oferteDinVizite: t.oferteDinVizite,
      acceptate: t.acceptateDinVizite,
    },
    // Cele mai noi întâi: când lista se taie, se pierd cele vechi, nu cele proaspete.
    visits: recente.slice(0, LIST_LIMIT).map((x) => ({
      date: x.date,
      agent: x.agent,
      client: x.client,
      city: x.city,
      prima: x.prima,
      nextStepDate: x.nextStepDate,
    })),
    quotes: [...ds.quotes]
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
      .slice(0, LIST_LIMIT)
      .map((q) => ({
      number: q.number,
      date: q.date,
      client: q.client,
      agent: q.agent,
      status: q.status,
      gross: q.gross,
    })),
    market: [...byGroup.values()],
    notes: recente
      .flatMap((x) =>
        Object.values(x.notes ?? {})
          .filter((text) => text?.trim())
          .map((text) => ({ date: x.date, client: x.client, agent: x.agent, text: text.trim() })),
      )
      .slice(0, 25),
  };
  const totalDays = workingDaysBetween(p.from, p.to);
  snapshot.highlights = buildHighlights(
    snapshot,
    asOf === todayRo() && p.to >= todayRo(),
    t.valoareAcceptata,
    totalDays ? days / totalDays : 1,
    await overdueDecisions(orgId, agentId, asOf),
  );
  return snapshot;
}

/** Titlul propus la salvare: „Raport săptămânal · Săptămâna 39 · Ion Pop” sau „… de echipă · …”. */
export function defaultTitle(s: ReportSnapshot): string {
  return scopeOf(s) === "echipa"
    ? `Raport ${s.typeLabel} de echipă · ${s.label}`
    : `Raport ${s.typeLabel} · ${s.label} · ${s.filters.agent ?? "agent"}`;
}
