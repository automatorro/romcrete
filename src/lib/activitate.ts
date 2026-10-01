import { todayRo } from "@/lib/agenda";
import { getDomains } from "@/lib/domenii";
import { createClient } from "@/lib/supabase/server";
import type { Answers, Notes } from "@/lib/teren";
import { allRows } from "@/lib/toate-randurile";

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
  /** Pași următori trecuți de termen și nefăcuți, la sfârșitul perioadei (sau azi, dacă perioada ține încă). */
  pasiRestanti: number;
  /** Vizite în care s-a aflat destul cât să se poată califica meseriașul. */
  calificareCompleta: number;
  /** Vizite în care s-au aflat ambele cifre necesare calculului de amortizare. */
  cuCalculAmortizare: number;
  modeleDiscutate: number;
  intrebariOwner: number;
  /** Oferte emise în perioadă, fără ciorne. */
  oferteEmise: number;
  oferteDinVizite: number;
  /** Din ofertele emise în perioadă și pornite dintr-o vizită, câte sunt acum acceptate. */
  acceptateDinVizite: number;
  valoareOferte: number;
  /** Oferte acceptate în perioadă, după data acceptării, oricând ar fi fost emise. */
  oferteAcceptate: number;
  valoareAcceptata: number;
  /** Oferte care au primit un răspuns în perioadă: acceptate, respinse sau expirate. */
  oferteDecise: number;
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
  /** Oferte trimise și fără răspuns la data raportului: banii care așteaptă. */
  pending: {
    number: string;
    client: string;
    agent: string;
    date: string;
    validUntil: string | null;
    gross: number;
    /** Zile de la emitere până la sfârșitul perioadei (sau azi). */
    zile: number;
  }[];
  /** Pașii restanți la sfârșitul perioadei, pe firmă: aceiași pe care îi numără `pasiRestanti`. */
  overdue: { client: string; agent: string; step: string | null; date: string; zile: number }[];
  /** Întrebările tehnice încă fără răspuns, puse în vizite până la sfârșitul perioadei. */
  escalations: { client: string; agent: string; date: string; items: string[] }[];
  /** `answered`: câte firme au răspuns la întrebare, ca „4 firme” să aibă o bază. */
  market: { groupId: string; group: string; option: string; firms: number; answered: number }[];
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

/** O ofertă care a primit răspuns: acceptată, respinsă sau expirată, la data deciziei. */
type Decizie = { status: string; date: string; gross: number; agentId: string | null; clientId: string };

/** Stările în care o ofertă și-a primit răspunsul. */
const DECISE = ["accepted", "rejected", "expired"];

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
  decizii: Decizie[],
  clientiNoi: number,
  primaVizitaPeFirma: Map<string, string>,
  from: string,
  to: string,
  restante: number,
): Metrics {
  const lucratoare = zileLucratoare(from, to);
  const prime = visits.filter((v) => primaVizitaPeFirma.get(v.client_id) === v.visit_date).length;
  const dinVizite = quotes.filter((q) => q.dinVizita);
  const intarzieri = dinVizite.map((q) => q.zilePanaLaOferta).filter((x): x is number => x !== null);
  const acceptate = decizii.filter((d) => d.status === "accepted");

  return {
    vizite: visits.length,
    firmeVizitate: new Set(visits.map((v) => v.client_id)).size,
    firmeNoi: clientiNoi,
    primeVizite: prime,
    revizite: visits.length - prime,
    zileLucratoare: lucratoare,
    vizitePeZi: lucratoare ? Math.round((visits.length / lucratoare) * 100) / 100 : 0,
    cuPasUrmator: visits.filter((v) => v.next_step_date || v.answers?.urmator).length,
    pasiRestanti: restante,
    calificareCompleta: visits.filter((v) => calificat(v.answers)).length,
    cuCalculAmortizare: visits.filter((v) => v.answers?.supr && v.answers?.manopera).length,
    modeleDiscutate: visits.reduce((n, v) => n + (v.pump_skus?.length ?? 0), 0),
    intrebariOwner: visits.filter(
      (v) => Array.isArray(v.answers?.esc) && (v.answers.esc as string[]).length > 0,
    ).length,
    oferteEmise: quotes.length,
    oferteDinVizite: dinVizite.length,
    acceptateDinVizite: dinVizite.filter((q) => q.status === "accepted").length,
    valoareOferte: Math.round(quotes.reduce((s, q) => s + q.gross, 0) * 100) / 100,
    oferteAcceptate: acceptate.length,
    valoareAcceptata: Math.round(acceptate.reduce((s, d) => s + d.gross, 0) * 100) / 100,
    oferteDecise: decizii.length,
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
  /** Perioada de comparație. Implicit: aceeași lungime, imediat înainte. */
  previousRange?: { from: string; to: string },
): Promise<ActivityDataset> {
  const supabase = await createClient();
  const azi = todayRo();
  const lungime = diferentaZile(from, to);
  const prevTo = previousRange?.to ?? adauga(from, -1);
  const prevFrom = previousRange?.from ?? adauga(prevTo, -lungime);

  type PasVizita = {
    client_id: string; agent_id: string | null; visit_date: string;
    next_step_date: string | null; next_step_done_at: string | null;
    urmator: string | null; esc: unknown; escalation_done_at: string | null;
  };
  const [
    allVisitDates,
    { data: visitRows },
    { data: memberRows },
    { data: clientRows },
    { data: quoteRows },
    { data: stateRows },
    { data: groupRows },
    { data: optionRows },
    { data: decisionRows },
    { data: pendingRows },
  ] = await Promise.all([
    // Tot istoricul vizitelor: prima vizită pe firmă și pașii restanți. Trece
    // ușor de 1.000 de rânduri, așa că se citește pe pagini.
    allRows<PasVizita>((a, b) =>
      supabase
        .from("visits")
        .select(
          "client_id, agent_id, visit_date, next_step_date, next_step_done_at, urmator:answers->>urmator, esc:answers->esc, escalation_done_at",
        )
        .eq("org_id", orgId)
        .order("id")
        .range(a, b),
    ),
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
      // O ciornă nu e încă o ofertă: n-a văzut-o clientul.
      .neq("status", "draft")
      .gte("issue_date", prevFrom)
      .lte("issue_date", to),
    supabase.from("client_state").select("*").eq("org_id", orgId),
    supabase.from("question_groups").select("id, label"),
    supabase.from("question_options").select("group_id, id, label"),
    // Schimbările de stare ale ofertelor, cu ora lor: de aici se știe când a fost
    // acceptată o ofertă, nu doar când a fost emisă. O zi în plus în urmă, pentru
    // diferența dintre ora României și UTC.
    supabase
      .from("client_activities")
      .select("quote_id, occurred_at, meta")
      .eq("org_id", orgId)
      .eq("kind", "oferta_stare")
      .gte("occurred_at", `${adauga(prevFrom, -1)}T00:00:00Z`)
      .order("occurred_at"),
    // Ofertele trimise care încă așteaptă răspuns, oricând ar fi fost emise.
    supabase
      .from("quotes")
      .select("id, number, issue_date, valid_until, client_id, created_by")
      .eq("org_id", orgId)
      .is("archived_at", null)
      .eq("status", "sent")
      .lte("issue_date", to),
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
  for (const v of allVisitDates) {
    const cur = primaVizita.get(v.client_id as string);
    if (!cur || (v.visit_date as string) < cur) primaVizita.set(v.client_id as string, v.visit_date as string);
  }

  const totiiVizite = (visitRows ?? []) as RawVisit[];
  const visitById = new Map(totiiVizite.map((v) => [v.id, v]));

  // Data deciziei pe fiecare ofertă: ultima schimbare de stare din perioadă.
  const ultimaSchimbare = new Map<string, { status: string; date: string }>();
  for (const e of decisionRows ?? []) {
    const status = (e.meta as { status?: string } | null)?.status;
    if (!e.quote_id || !status) continue;
    ultimaSchimbare.set(e.quote_id as string, { status, date: todayRo(new Date(e.occurred_at as string)) });
  }
  // Ofertele decise în perioadă pot fi emise oricând înainte: se citesc separat.
  const emiseInPerioada = new Set((quoteRows ?? []).map((q) => q.id as string));
  const deCitit = [...ultimaSchimbare.keys()].filter((id) => !emiseInPerioada.has(id));
  const { data: olderRows } = deCitit.length
    ? await supabase
        .from("quotes")
        .select("id, number, issue_date, status, client_id, created_by, visit_id")
        .eq("org_id", orgId)
        .is("archived_at", null)
        .in("id", deCitit)
    : { data: [] };

  const idsTotaluri = [
    ...new Set([
      ...emiseInPerioada,
      ...(olderRows ?? []).map((q) => q.id as string),
      ...(pendingRows ?? []).map((q) => q.id as string),
    ]),
  ];
  const { data: totalRows } = await supabase
    .from("quote_totals")
    .select("quote_id, net_total, vat_total")
    .in("quote_id", idsTotaluri.length ? idsTotaluri : ["00000000-0000-0000-0000-000000000000"]);
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

  // Decizia contează doar dacă oferta e încă în starea aceea. Ofertele decise
  // înainte să existe istoricul stărilor nu au o dată a deciziei: pentru ele
  // rămâne data emiterii.
  const toateDeciziile: Decizie[] = [...(quoteRows ?? []), ...(olderRows ?? [])]
    .filter((q) => DECISE.includes(q.status as string))
    .flatMap((q) => {
      const s = ultimaSchimbare.get(q.id as string);
      const date = s ? (s.status === q.status ? s.date : null) : (q.issue_date as string);
      if (!date) return [];
      return [{
        status: q.status as string,
        date,
        gross: totaluri.get(q.id as string)?.gross ?? 0,
        agentId: (q.created_by as string | null) ?? null,
        clientId: q.client_id as string,
      }];
    });

  const etichete = new Map((optionRows ?? []).map((o) => [`${o.group_id}|${o.id}`, o.label as string]));
  const numeGrup = new Map((groupRows ?? []).map((g) => [g.id as string, g.label as string]));
  const eticheta = (gid: string, oid: string) => etichete.get(`${gid}|${oid}`) ?? oid;

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

  const decizii = toateDeciziile.filter(
    (d) =>
      (!agentFilter || d.agentId === agentFilter) &&
      (!domainFilter || domeniuFirma.get(d.clientId) === domainFilter),
  );
  const deciziiPerioada = decizii.filter((d) => inInterval(d.date, from, to));
  const deciziiPrecedent = decizii.filter((d) => inInterval(d.date, prevFrom, prevTo));

  // Pașii restanți la o dată: pași ai vizitelor de până atunci, cu termenul
  // trecut și nefăcuți până la ea. Pentru o perioadă încheiată se citesc la
  // sfârșitul ei, ca săptămâna trecută să nu fie judecată cu restanțele de azi.
  const pasi = allVisitDates.filter(
    (v) =>
      v.next_step_date &&
      (!agentFilter || v.agent_id === agentFilter) &&
      (!domainFilter || domeniuFirma.get(v.client_id) === domainFilter),
  );
  const restanteLa = (pana: string, pastreaza: (v: PasVizita) => boolean = () => true) => {
    const la = pana < azi ? pana : azi;
    return pasi.filter(
      (v) =>
        pastreaza(v) &&
        v.visit_date <= la &&
        (v.next_step_date as string) < la &&
        (!v.next_step_done_at || todayRo(new Date(v.next_step_done_at)) > la),
    ).length;
  };

  // Aceleași reguli, pe nume: ce firmă, al cui pas, de câte zile.
  const laSfarsit = to < azi ? to : azi;
  const overdue = pasi
    .filter(
      (v) =>
        v.visit_date <= laSfarsit &&
        (v.next_step_date as string) < laSfarsit &&
        (!v.next_step_done_at || todayRo(new Date(v.next_step_done_at)) > laSfarsit),
    )
    .map((v) => ({
      client: numeClient.get(v.client_id) ?? "—",
      agent: numeAgent(v.agent_id),
      step: v.urmator ? eticheta("urmator", v.urmator) : null,
      date: v.next_step_date as string,
      zile: diferentaZile(v.next_step_date as string, laSfarsit),
    }))
    .sort((a, b) => b.zile - a.zile);

  const escalations = allVisitDates
    .filter(
      (v) =>
        Array.isArray(v.esc) &&
        v.esc.length > 0 &&
        v.visit_date <= to &&
        (!v.escalation_done_at || todayRo(new Date(v.escalation_done_at)) > laSfarsit) &&
        (!agentFilter || v.agent_id === agentFilter) &&
        (!domainFilter || domeniuFirma.get(v.client_id) === domainFilter),
    )
    .sort((a, b) => a.visit_date.localeCompare(b.visit_date))
    .map((v) => ({
      client: numeClient.get(v.client_id) ?? "—",
      agent: numeAgent(v.agent_id),
      date: v.visit_date,
      items: (v.esc as string[]).map((e) => eticheta("esc", e)),
    }));

  const pending = (pendingRows ?? [])
    .filter(
      (q) =>
        (!agentFilter || q.created_by === agentFilter) &&
        (!domainFilter || domeniuFirma.get(q.client_id as string) === domainFilter),
    )
    .map((q) => ({
      number: q.number as string,
      client: numeClient.get(q.client_id as string) ?? "—",
      agent: numeAgent(q.created_by as string | null),
      date: q.issue_date as string,
      validUntil: (q.valid_until as string | null) ?? null,
      gross: totaluri.get(q.id as string)?.gross ?? 0,
      zile: Math.max(0, diferentaZile(q.issue_date as string, laSfarsit)),
    }))
    .sort((a, b) => b.gross - a.gross);

  const firmeNoiIn = (a: string, b: string) =>
    clients.filter((c) => {
      const creat = (c.created_at as string).slice(0, 10);
      return inInterval(creat, a, b)
        && (!agentFilter || c.owner_agent_id === agentFilter)
        && (!domainFilter || ((c.domain as string) ?? "constructii") === domainFilter);
    }).length;

  const total = computeMetrics(
    vizitePerioada, ofertePerioada, deciziiPerioada, firmeNoiIn(from, to), primaVizita, from, to, restanteLa(to),
  );
  const previous = computeMetrics(
    vizitePrecedent, ofertePrecedent, deciziiPrecedent, firmeNoiIn(prevFrom, prevTo), primaVizita, prevFrom, prevTo,
    restanteLa(prevTo),
  );

  // Pe agent: toți agenții echipei, și cei fără nicio vizită — tocmai ei trebuie
  // văzuți. Plus oricine a lucrat în perioadă, chiar dacă nu are rolul de agent.
  const cheieAgent = (id: string | null) => id ?? "necunoscut";
  const agentIds = agentFilter
    ? [agentFilter]
    : [
        ...new Set([
          ...members.filter((m) => m.role === "agent").map((m) => m.user_id as string),
          ...vizitePerioada.map((v) => cheieAgent(v.agent_id)),
          ...ofertePerioada.map((q) => cheieAgent(q.agentId)),
          ...deciziiPerioada.map((d) => cheieAgent(d.agentId)),
        ]),
      ];
  const perAgent = agentIds
    .map((id) => ({
      agentId: id,
      agent: numeAgent(id === "necunoscut" ? null : id),
      metrics: computeMetrics(
        vizitePerioada.filter((v) => cheieAgent(v.agent_id) === id),
        ofertePerioada.filter((q) => cheieAgent(q.agentId) === id),
        deciziiPerioada.filter((d) => cheieAgent(d.agentId) === id),
        clients.filter(
          (c) => c.owner_agent_id === id && inInterval((c.created_at as string).slice(0, 10), from, to),
        ).length,
        primaVizita, from, to,
        restanteLa(to, (v) => cheieAgent(v.agent_id) === id),
      ),
    }))
    .sort((a, b) => b.metrics.vizite - a.metrics.vizite || a.agent.localeCompare(b.agent, "ro"));

  // Pe domeniu: aceiași indicatori, ca să se vadă unde se lucrează și unde nu.
  const perDomain = domenii
    .map((d) => ({
      domainId: d.id,
      domain: d.label,
      unit: d.unit_short,
      metrics: computeMetrics(
        vizitePerioada.filter((v) => domeniuFirma.get(v.client_id) === d.id),
        ofertePerioada.filter((q) => domeniuFirma.get(q.clientId) === d.id),
        deciziiPerioada.filter((x) => domeniuFirma.get(x.clientId) === d.id),
        clients.filter(
          (c) =>
            ((c.domain as string) ?? "constructii") === d.id &&
            inInterval((c.created_at as string).slice(0, 10), from, to) &&
            (!agentFilter || c.owner_agent_id === agentFilter),
        ).length,
        primaVizita, from, to,
        restanteLa(to, (v) => domeniuFirma.get(v.client_id) === d.id),
      ),
    }))
    .filter((d) => d.metrics.vizite > 0 || d.metrics.firmeNoi > 0 || d.metrics.oferteAcceptate > 0)
    .sort((a, b) => b.metrics.vizite - a.metrics.vizite);

  // Pe perioadă
  const gasit = new Map<string, { label: string; visits: RawVisit[]; quotes: typeof ofertePerioada; decizii: Decizie[] }>();
  for (let d = from; d <= to; d = adauga(d, 1)) {
    const b = bucketOf(d, granularity);
    if (!gasit.has(b.key)) gasit.set(b.key, { label: b.label, visits: [], quotes: [], decizii: [] });
  }
  for (const v of vizitePerioada) gasit.get(bucketOf(v.visit_date, granularity).key)?.visits.push(v);
  for (const q of ofertePerioada) gasit.get(bucketOf(q.date, granularity).key)?.quotes.push(q);
  for (const d of deciziiPerioada) gasit.get(bucketOf(d.date, granularity).key)?.decizii.push(d);

  const perPeriod: Bucket[] = [...gasit.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, g]) => {
      const capat =
        granularity === "zi" ? key
        : granularity === "saptamana" ? adauga(key, 6)
        : `${key}-31`;
      const start = granularity === "luna" ? `${key}-01` : key;
      const sfarsit = capat > to ? to : capat;
      return {
        key,
        label: g.label,
        metrics: computeMetrics(
          g.visits, g.quotes, g.decizii,
          clients.filter((c) => {
            const creat = (c.created_at as string).slice(0, 10);
            return creat >= (start < from ? from : start) && creat <= (capat > to ? to : capat) &&
              (!agentFilter || c.owner_agent_id === agentFilter);
          }).length,
          primaVizita,
          start < from ? from : start,
          sfarsit,
          // Zilele care n-au venit încă nu au restanțe.
          start > azi ? 0 : restanteLa(sfarsit),
        ),
      };
    });


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
    const answered = new Set([...opts.values()].flatMap((set) => [...set])).size;
    for (const [oid, firms] of [...opts.entries()].sort((a, b) => b[1].size - a[1].size)) {
      market.push({ groupId: gid, group: numeGrup.get(gid) ?? gid, option: eticheta(gid, oid), firms: firms.size, answered });
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
    total, previous, perAgent, perDomain, perPeriod, pending, overdue, escalations,
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
