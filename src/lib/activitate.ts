import { getDomains } from "@/lib/domenii";
import { createClient } from "@/lib/supabase/server";
import type { Answers, Notes } from "@/lib/teren";

export type Granularity = "zi" | "saptamana" | "luna";

/** Indicatorii de activitate, calculați identic pentru orice tăietură: agent, zi, săptămână, lună. */
export type Metrics = {
  vizite: number;
  firmeVizitate: number;
  firmeNoi: number;
  primeVizite: number;
  revizite: number;
  zileLucratoare: number;
  vizitePeZi: number;
  /** Vizite după care agentul a stabilit ce urmează. */
  cuPasUrmator: number;
  pasiRestanti: number;
  /** Vizite în care s-a aflat destul cât să se poată califica meseriașul. */
  calificareCompleta: number;
  /** Vizite în care s-au aflat ambele cifre necesare calculului de amortizare. */
  cuCalculAmortizare: number;
  modeleDiscutate: number;
  intrebariOwner: number;
  oferteEmise: number;
  oferteDinVizite: number;
  valoareOferte: number;
  oferteAcceptate: number;
  valoareAcceptata: number;
  /** Zile medii de la vizită la ofertă, pentru ofertele care pornesc dintr-o vizită. */
  zileVizitaOferta: number | null;
};

export type Bucket = { key: string; label: string; metrics: Metrics };

export type VisitDetail = {
  id: string;
  date: string;
  agent: string;
  client: string;
  city: string | null;
  domain: string;
  tradeType: string | null;
  prima: boolean;
  answers: Answers;
  notes: Notes;
  pumpSkus: string[];
  nextStepDate: string | null;
  nextStepDone: boolean;
};

export type QuoteDetail = {
  number: string;
  date: string;
  client: string;
  agent: string;
  status: string;
  net: number;
  gross: number;
  dinVizita: string | null;
  zilePanaLaOferta: number | null;
};

export type ActivityDataset = {
  from: string;
  to: string;
  granularity: Granularity;
  agentFilter: string | null;
  domainFilter: string | null;
  members: {
    user_id: string;
    full_name: string | null;
    role: string;
    target_visits_per_day: number | null;
  }[];
  orgTargetVisitsPerDay: number;
  total: Metrics;
  /** Aceeași perioadă, imediat înainte — pentru comparație. */
  previous: Metrics;
  perAgent: { agentId: string; agent: string; metrics: Metrics }[];
  /** Aceiași indicatori, tăiați pe domeniul firmelor vizitate. */
  perDomain: { domainId: string; domain: string; unit: string; metrics: Metrics }[];
  perPeriod: Bucket[];
  visits: VisitDetail[];
  quotes: QuoteDetail[];
  clients: {
    name: string;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    cui: string | null;
    regCom: string | null;
    address: string | null;
    county: string | null;
    city: string | null;
    domain: string;
    tradeType: string | null;
    agent: string;
    priority: string;
    feasibility: string;
    focus: string;
    stage: string | null;
    visits: number;
    lastVisit: string | null;
    nextStep: string | null;
    nextStepDate: string | null;
    late: boolean;
  }[];
  market: { group: string; option: string; firms: number }[];
};


const zi = (d: Date) => d.toISOString().slice(0, 10);
const adauga = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return zi(d);
};
const diferentaZile = (a: string, b: string) =>
  Math.round(
    (new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86400000,
  );

/** Zile de luni până vineri dintr-un interval, capetele incluse. */
function zileLucratoare(from: string, to: string): number {
  let n = 0;
  for (let d = from; d <= to; d = adauga(d, 1)) {
    const wd = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (wd >= 1 && wd <= 5) n++;
  }
  return n;
}

const LUNI = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

/** Cheia și eticheta găletii în care cade o vizită, după granularitatea cerută. */
function bucketOf(date: string, g: Granularity): { key: string; label: string } {
  if (g === "zi") {
    const d = new Date(`${date}T12:00:00Z`);
    return { key: date, label: `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}` };
  }
  if (g === "luna") {
    const [y, m] = date.split("-");
    return { key: `${y}-${m}`, label: `${LUNI[Number(m) - 1]} ${y}` };
  }
  // Săptămâna începe luni.
  const d = new Date(`${date}T12:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7;
  const monday = adauga(date, -shift);
  const sunday = adauga(monday, 6);
  const scurt = (s: string) => s.slice(8, 10) + "." + s.slice(5, 7);
  return { key: monday, label: `${scurt(monday)}–${scurt(sunday)}` };
}

type RawVisit = {
  id: string; client_id: string; agent_id: string | null; visit_date: string;
  answers: Answers; notes: Notes; pump_skus: string[];
  next_step_date: string | null; next_step_done_at: string | null;
};

/** Cât de complet e calificat meseriașul după o vizită. */
const calificat = (a: Answers) =>
  Boolean(a?.mod) &&
  Array.isArray(a?.materiale) && a.materiale.length > 0 &&
  Boolean(a?.interes) &&
  Boolean(a?.decide) &&
  ((Array.isArray(a?.obiectii) && a.obiectii.length > 0) ||
    (Array.isArray(a?.atragere) && a.atragere.length > 0));

function computeMetrics(
  visits: RawVisit[],
  quotes: QuoteDetail[],
  clientiNoi: number,
  primaVizitaPeFirma: Map<string, string>,
  from: string,
  to: string,
  azi: string,
): Metrics {
  const lucratoare = zileLucratoare(from, to);
  const prime = visits.filter((v) => primaVizitaPeFirma.get(v.client_id) === v.visit_date).length;
  const dinVizite = quotes.filter((q) => q.dinVizita);
  const intarzieri = dinVizite.map((q) => q.zilePanaLaOferta).filter((x): x is number => x !== null);
  const acceptate = quotes.filter((q) => q.status === "accepted");

  return {
    vizite: visits.length,
    firmeVizitate: new Set(visits.map((v) => v.client_id)).size,
    firmeNoi: clientiNoi,
    primeVizite: prime,
    revizite: visits.length - prime,
    zileLucratoare: lucratoare,
    vizitePeZi: lucratoare ? Math.round((visits.length / lucratoare) * 100) / 100 : 0,
    cuPasUrmator: visits.filter((v) => v.next_step_date || v.answers?.urmator).length,
    pasiRestanti: visits.filter(
      (v) => v.next_step_date && !v.next_step_done_at && v.next_step_date < azi,
    ).length,
    calificareCompleta: visits.filter((v) => calificat(v.answers)).length,
    cuCalculAmortizare: visits.filter((v) => v.answers?.supr && v.answers?.manopera).length,
    modeleDiscutate: visits.reduce((n, v) => n + (v.pump_skus?.length ?? 0), 0),
    intrebariOwner: visits.filter(
      (v) => Array.isArray(v.answers?.esc) && (v.answers.esc as string[]).length > 0,
    ).length,
    oferteEmise: quotes.length,
    oferteDinVizite: dinVizite.length,
    valoareOferte: Math.round(quotes.reduce((s, q) => s + q.gross, 0) * 100) / 100,
    oferteAcceptate: acceptate.length,
    valoareAcceptata: Math.round(acceptate.reduce((s, q) => s + q.gross, 0) * 100) / 100,
    zileVizitaOferta: intarzieri.length
      ? Math.round((intarzieri.reduce((a, b) => a + b, 0) / intarzieri.length) * 10) / 10
      : null,
  };
}

export async function buildActivity(
  orgId: string,
  from: string,
  to: string,
  granularity: Granularity,
  agentFilter: string | null,
  domainFilter: string | null = null,
): Promise<ActivityDataset> {
  const supabase = await createClient();
  const azi = zi(new Date());
  const lungime = diferentaZile(from, to);
  const prevTo = adauga(from, -1);
  const prevFrom = adauga(prevTo, -lungime);

  const [
    { data: allVisitDates },
    { data: visitRows },
    { data: memberRows },
    { data: clientRows },
    { data: quoteRows },
    { data: stateRows },
    { data: groupRows },
    { data: optionRows },
  ] = await Promise.all([
    supabase.from("visits").select("client_id, visit_date").eq("org_id", orgId),
    supabase
      .from("visits")
      .select("id, client_id, agent_id, visit_date, answers, notes, pump_skus, next_step_date, next_step_done_at")
      .eq("org_id", orgId)
      .gte("visit_date", prevFrom)
      .lte("visit_date", to)
      .order("visit_date"),
    supabase
      .from("memberships")
      .select("user_id, full_name, role, target_visits_per_day")
      .eq("org_id", orgId),
    supabase
      .from("clients")
      .select("id, name, city, domain, trade_type, owner_agent_id, created_at")
      .eq("org_id", orgId),
    supabase
      .from("quotes")
      .select("id, number, issue_date, status, client_id, created_by, visit_id")
      .eq("org_id", orgId)
      .is("archived_at", null)
      .gte("issue_date", prevFrom)
      .lte("issue_date", to),
    supabase.from("client_state").select("*").eq("org_id", orgId),
    supabase.from("question_groups").select("id, label"),
    supabase.from("question_options").select("group_id, id, label"),
  ]);

  const domenii = await getDomains(orgId);
  const numeDomeniu = new Map(domenii.map((d) => [d.id, d.short_label]));

  const members = memberRows ?? [];
  const numeAgent = (id: string | null) =>
    members.find((m) => m.user_id === id)?.full_name ?? (id ? "Agent fără nume" : "—");

  const clients = clientRows ?? [];
  const numeClient = new Map(clients.map((c) => [c.id, c.name as string]));
  // Domeniul unei vizite e domeniul firmei vizitate: acolo se decide în ce
  // unitate se măsoară lucrarea și ce pompe se discută.
  const domeniuFirma = new Map(clients.map((c) => [c.id as string, (c.domain as string) ?? "constructii"]));

  // Prima vizită pe fiecare firmă, din tot istoricul — nu doar din perioada cerută.
  const primaVizita = new Map<string, string>();
  for (const v of allVisitDates ?? []) {
    const cur = primaVizita.get(v.client_id as string);
    if (!cur || (v.visit_date as string) < cur) primaVizita.set(v.client_id as string, v.visit_date as string);
  }

  const totiiVizite = (visitRows ?? []) as RawVisit[];
  const visitById = new Map(totiiVizite.map((v) => [v.id, v]));

  const { data: totalRows } = await supabase
    .from("quote_totals")
    .select("quote_id, net_total, vat_total")
    .in("quote_id", (quoteRows ?? []).length ? (quoteRows ?? []).map((q) => q.id) : ["00000000-0000-0000-0000-000000000000"]);
  const totaluri = new Map(
    (totalRows ?? []).map((t) => [
      t.quote_id as string,
      { net: Number(t.net_total), gross: Number(t.net_total) + Number(t.vat_total) },
    ]),
  );

  const toateOfertele: (QuoteDetail & { agentId: string | null; clientId: string; date: string })[] = (quoteRows ?? []).map((q) => {
    const sursa = q.visit_id ? visitById.get(q.visit_id) : undefined;
    const t = totaluri.get(q.id) ?? { net: 0, gross: 0 };
    return {
      number: q.number as string,
      date: q.issue_date as string,
      client: numeClient.get(q.client_id as string) ?? "—",
      clientId: q.client_id as string,
      agent: numeAgent(q.created_by as string | null),
      agentId: (q.created_by as string | null) ?? null,
      status: q.status as string,
      net: t.net,
      gross: t.gross,
      dinVizita: sursa ? sursa.visit_date : q.visit_id ? "—" : null,
      zilePanaLaOferta: sursa ? diferentaZile(sursa.visit_date, q.issue_date as string) : null,
    };
  });

  const inInterval = (d: string, a: string, b: string) => d >= a && d <= b;
  const filtruAgent = <T extends { agent_id?: string | null; agentId?: string | null }>(rows: T[]) =>
    agentFilter ? rows.filter((r) => (r.agent_id ?? r.agentId) === agentFilter) : rows;
  const filtruDomeniu = (rows: RawVisit[]) =>
    domainFilter ? rows.filter((v) => domeniuFirma.get(v.client_id) === domainFilter) : rows;

  const vizitePerioada = filtruDomeniu(filtruAgent(totiiVizite.filter((v) => inInterval(v.visit_date, from, to))));
  const vizitePrecedent = filtruDomeniu(filtruAgent(totiiVizite.filter((v) => inInterval(v.visit_date, prevFrom, prevTo))));
  const filtruDomeniuOferte = (rows: typeof toateOfertele) =>
    domainFilter ? rows.filter((q) => domeniuFirma.get(q.clientId) === domainFilter) : rows;

  const ofertePerioada = filtruDomeniuOferte(filtruAgent(toateOfertele.filter((q) => inInterval(q.date, from, to))));
  const ofertePrecedent = filtruDomeniuOferte(filtruAgent(toateOfertele.filter((q) => inInterval(q.date, prevFrom, prevTo))));

  const firmeNoiIn = (a: string, b: string) =>
    clients.filter((c) => {
      const creat = (c.created_at as string).slice(0, 10);
      return inInterval(creat, a, b)
        && (!agentFilter || c.owner_agent_id === agentFilter)
        && (!domainFilter || ((c.domain as string) ?? "constructii") === domainFilter);
    }).length;

  const total = computeMetrics(vizitePerioada, ofertePerioada, firmeNoiIn(from, to), primaVizita, from, to, azi);
  const previous = computeMetrics(vizitePrecedent, ofertePrecedent, firmeNoiIn(prevFrom, prevTo), primaVizita, prevFrom, prevTo, azi);

  // Pe agent
  const agentIds = [...new Set(vizitePerioada.map((v) => v.agent_id ?? "necunoscut"))];
  const perAgent = agentIds
    .map((id) => ({
      agentId: id,
      agent: numeAgent(id === "necunoscut" ? null : id),
      metrics: computeMetrics(
        vizitePerioada.filter((v) => (v.agent_id ?? "necunoscut") === id),
        ofertePerioada.filter((q) => (q.agentId ?? "necunoscut") === id),
        clients.filter(
          (c) => c.owner_agent_id === id && inInterval((c.created_at as string).slice(0, 10), from, to),
        ).length,
        primaVizita, from, to, azi,
      ),
    }))
    .sort((a, b) => b.metrics.vizite - a.metrics.vizite);

  // Pe domeniu: aceiași indicatori, ca să se vadă unde se lucrează și unde nu.
  const perDomain = domenii
    .map((d) => ({
      domainId: d.id,
      domain: d.label,
      unit: d.unit_short,
      metrics: computeMetrics(
        vizitePerioada.filter((v) => domeniuFirma.get(v.client_id) === d.id),
        ofertePerioada.filter((q) => domeniuFirma.get(q.clientId) === d.id),
        clients.filter(
          (c) =>
            ((c.domain as string) ?? "constructii") === d.id &&
            inInterval((c.created_at as string).slice(0, 10), from, to) &&
            (!agentFilter || c.owner_agent_id === agentFilter),
        ).length,
        primaVizita, from, to, azi,
      ),
    }))
    .filter((d) => d.metrics.vizite > 0 || d.metrics.firmeNoi > 0)
    .sort((a, b) => b.metrics.vizite - a.metrics.vizite);

  // Pe perioadă
  const gasit = new Map<string, { label: string; visits: RawVisit[]; quotes: typeof ofertePerioada }>();
  for (let d = from; d <= to; d = adauga(d, 1)) {
    const b = bucketOf(d, granularity);
    if (!gasit.has(b.key)) gasit.set(b.key, { label: b.label, visits: [], quotes: [] });
  }
  for (const v of vizitePerioada) gasit.get(bucketOf(v.visit_date, granularity).key)?.visits.push(v);
  for (const q of ofertePerioada) gasit.get(bucketOf(q.date, granularity).key)?.quotes.push(q);

  const perPeriod: Bucket[] = [...gasit.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, g]) => {
      const capat =
        granularity === "zi" ? key
        : granularity === "saptamana" ? adauga(key, 6)
        : `${key}-31`;
      const start = granularity === "luna" ? `${key}-01` : key;
      return {
        key,
        label: g.label,
        metrics: computeMetrics(
          g.visits, g.quotes,
          clients.filter((c) => {
            const creat = (c.created_at as string).slice(0, 10);
            return creat >= (start < from ? from : start) && creat <= (capat > to ? to : capat) &&
              (!agentFilter || c.owner_agent_id === agentFilter);
          }).length,
          primaVizita,
          start < from ? from : start,
          capat > to ? to : capat,
          azi,
        ),
      };
    });

  const etichete = new Map((optionRows ?? []).map((o) => [`${o.group_id}|${o.id}`, o.label as string]));
  const numeGrup = new Map((groupRows ?? []).map((g) => [g.id as string, g.label as string]));
  const eticheta = (gid: string, oid: string) => etichete.get(`${gid}|${oid}`) ?? oid;

  const clientById = new Map(clients.map((c) => [c.id, c]));

  const market: ActivityDataset["market"] = [];
  const perGrup = new Map<string, Map<string, Set<string>>>();
  for (const v of vizitePerioada) {
    for (const [gid, raw] of Object.entries(v.answers ?? {})) {
      const values = Array.isArray(raw) ? raw : raw ? [String(raw)] : [];
      if (!values.length) continue;
      const g = perGrup.get(gid) ?? new Map<string, Set<string>>();
      for (const val of values) {
        const set = g.get(val) ?? new Set<string>();
        set.add(v.client_id);
        g.set(val, set);
      }
      perGrup.set(gid, g);
    }
  }
  for (const [gid, opts] of perGrup) {
    for (const [oid, firms] of [...opts.entries()].sort((a, b) => b[1].size - a[1].size)) {
      market.push({ group: numeGrup.get(gid) ?? gid, option: eticheta(gid, oid), firms: firms.size });
    }
  }

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("target_visits_per_day")
    .eq("id", orgId)
    .maybeSingle();

  return {
    from, to, granularity, agentFilter, domainFilter, members,
    orgTargetVisitsPerDay: Number(orgRow?.target_visits_per_day ?? 5),
    total, previous, perAgent, perDomain, perPeriod,
    visits: vizitePerioada.map((v) => {
      const c = clientById.get(v.client_id);
      return {
        id: v.id,
        date: v.visit_date,
        agent: numeAgent(v.agent_id),
        client: (c?.name as string) ?? "—",
        city: (c?.city as string) ?? null,
        domain: numeDomeniu.get(domeniuFirma.get(v.client_id) ?? "") ?? "—",
        tradeType: (c?.trade_type as string) ?? null,
        prima: primaVizita.get(v.client_id) === v.visit_date,
        answers: v.answers ?? {},
        notes: v.notes ?? {},
        pumpSkus: v.pump_skus ?? [],
        nextStepDate: v.next_step_date,
        nextStepDone: Boolean(v.next_step_done_at),
      };
    }),
    quotes: ofertePerioada.map((q) => ({
      number: q.number,
      date: q.date,
      client: q.client,
      agent: q.agent,
      status: q.status,
      net: q.net,
      gross: q.gross,
      dinVizita: q.dinVizita,
      zilePanaLaOferta: q.zilePanaLaOferta,
    })),
    clients: (stateRows ?? [])
      .filter((s) => !agentFilter || s.owner_agent_id === agentFilter)
      .filter((s) => !domainFilter || ((s.domain as string) ?? "constructii") === domainFilter)
      .map((s) => ({
        name: s.name as string,
        contactPerson: (s.contact_person as string) ?? null,
        phone: (s.phone as string) ?? null,
        email: (s.email as string) ?? null,
        cui: (s.cui as string) ?? null,
        regCom: (s.reg_com as string) ?? null,
        address: (s.address as string) ?? null,
        county: (s.county as string) ?? null,
        city: (s.city as string) ?? null,
        domain: numeDomeniu.get((s.domain as string) ?? "") ?? "—",
        tradeType: (s.trade_type as string) ?? null,
        agent: numeAgent(s.owner_agent_id as string | null),
        priority: s.priority as string,
        feasibility: (s.feasibility as string) ?? "?",
        focus: (s.focus as string) ?? "necunoscut",
        stage: s.stage ? eticheta("etapa", s.stage as string) : null,
        visits: Number(s.visit_count ?? 0),
        lastVisit: (s.last_visit as string) ?? null,
        nextStep: s.next_step ? eticheta("urmator", s.next_step as string) : null,
        nextStepDate: (s.next_step_date as string) ?? null,
        late: Boolean(s.next_step_late),
      })),
    market,
  };
}
