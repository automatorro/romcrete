import Link from "next/link";

import { StepActions } from "@/app/teren/step-actions";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { addDays, addWorkingDays, daysBetween, shortDay, todayRo } from "@/lib/agenda";
import { requireOrg } from "@/lib/auth";
import { getQuestionCatalogue, optionLabel } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import { lastVisitLabel, type ClientState } from "@/lib/teren";

export const metadata = { title: "Azi" };

/** Luni–vineri din săptămâna curentă, până azi inclusiv: câte zile s-au consumat din țintă. */
function workingDaysSoFar(today: Date) {
  const dow = (today.getDay() + 6) % 7; // 0 = luni
  let n = 0;
  for (let i = 0; i <= Math.min(dow, 4); i++) n++;
  return n;
}

function Progress({
  label,
  done,
  target,
  hint,
}: {
  label: string;
  done: number;
  target: number;
  hint: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const atins = target > 0 && done >= target;

  return (
    <div>
      <div className="flex items-baseline gap-2 text-sm">
        <span className="text-neutral-700">{label}</span>
        <span className="flex-1" />
        <span className="tabular-nums">
          <b className="text-base">{done}</b>
          <span className="text-neutral-500"> / {target}</span>
        </span>
      </div>
      <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-neutral-100">
        <span
          className={`block h-full rounded-full ${atins ? "bg-[var(--color-ok)]" : "bg-brand-600"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

type Task = ClientState & {
  next_step_date: string;
  next_step_visit_id: string;
  /** Agentul care a stabilit pasul, adică al cui e de făcut. */
  owner: string | null;
};

export default async function AziPage(props: PageProps<"/teren">) {
  const { orgId, organization, user, role } = await requireOrg();
  const { cine, incheiat } = await props.searchParams;
  const supabase = await createClient();
  const sections = await getQuestionCatalogue(orgId);

  // Conducerea vede fie agenda ei, fie pe a echipei; agentul, doar pe a lui.
  const conducere = role !== "agent";
  const echipa = conducere && cine === "echipa";

  const now = new Date();
  const azi = now.toISOString().slice(0, 10);
  const inceputLuna = `${azi.slice(0, 7)}-01`;
  const luni = new Date(now);
  luni.setDate(luni.getDate() - ((now.getDay() + 6) % 7));
  const inceputSaptamana = luni.toISOString().slice(0, 10);

  const [{ data: membership }, { count: viziteAzi }, { count: viziteSapt }, { count: oferteLuna }, { data: stateRows }] =
    await Promise.all([
      supabase
        .from("memberships")
        .select("target_visits_per_day, target_quotes_per_month")
        .eq("user_id", user.id)
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", user.id)
        .eq("visit_date", azi),
      supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", user.id)
        .gte("visit_date", inceputSaptamana),
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user.id)
        .gte("issue_date", inceputLuna),
      supabase.from("client_state").select("*").eq("org_id", orgId),
    ]);

  // Ținta personală bate ținta firmei; null înseamnă „ca la toată lumea”.
  const tintaZi = membership?.target_visits_per_day ?? organization.target_visits_per_day ?? 5;
  const tintaLuna = membership?.target_quotes_per_month ?? organization.target_quotes_per_month ?? 10;

  const rows = (stateRows ?? []) as ClientState[];

  // Pasul următor e al agentului care l-a stabilit în vizită, nu al celui
  // care deține firma: dacă un coleg a trecut pe acolo, el are de revenit.
  // Se citesc doar vizitele cu pas deschis, nu o listă de id-uri: la sute de
  // firme lista ar depăși lungimea maximă a unei cereri.
  const [{ data: stepVisits }, { data: memberRows }, { data: finished }] = await Promise.all([
    supabase
      .from("visits")
      .select("id, agent_id")
      .eq("org_id", orgId)
      .is("next_step_done_at", null)
      .not("next_step_date", "is", null),
    echipa
      ? supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string | null }[] }),
    typeof incheiat === "string"
      ? supabase
          .from("visits")
          .select("next_step_date, answers, clients(name)")
          .eq("id", incheiat)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const stepOwner = new Map((stepVisits ?? []).map((v) => [v.id as string, v.agent_id as string | null]));
  const memberName = new Map((memberRows ?? []).map((m) => [m.user_id, m.full_name ?? "Fără nume"]));

  // O vizită fără agent (date vechi) rămâne în grija responsabilului firmei.
  const mine = (r: ClientState) =>
    echipa ||
    (r.next_step_visit_id ? stepOwner.get(r.next_step_visit_id) ?? r.owner_agent_id : null) === user.id;

  const astazi = todayRo();
  // Ziua lucrătoare următoare: vinerea, „mâine” înseamnă luni.
  const maine = addWorkingDays(astazi, 1);
  const numeMaine = maine === addDays(astazi, 1) ? "Mâine" : "Luni";
  const pesteOSaptamana = addDays(astazi, 8);

  const tasks: Task[] = rows
    .filter((r): r is ClientState & { next_step_date: string; next_step_visit_id: string } =>
      Boolean(r.next_step_date && r.next_step_visit_id),
    )
    .filter(mine)
    .map((r) => ({ ...r, owner: stepOwner.get(r.next_step_visit_id) ?? null }))
    .sort((a, b) => a.next_step_date.localeCompare(b.next_step_date) || a.name.localeCompare(b.name));

  const restante = tasks.filter((t) => t.next_step_date < astazi);
  const deAzi = tasks.filter((t) => t.next_step_date === astazi);
  const deMaine = tasks.filter((t) => t.next_step_date === maine);
  const urmatoarele = tasks.filter((t) => t.next_step_date > maine && t.next_step_date < pesteOSaptamana);

  // „De reluat” sunt firmele fără pas deschis: ale cui sunt se vede după responsabilul firmei.
  const deReluat = rows
    .filter((r) => r.needs_recontact && (echipa || r.owner_agent_id === user.id || r.owner_agent_id === null))
    .sort((a, b) => (a.recontact_due ?? "").localeCompare(b.recontact_due ?? ""))
    .slice(0, 12);

  const zone = new Map<string, { total: number; urgente: number }>();
  for (const r of rows) {
    const oras = r.city?.trim() || "Fără localitate";
    const z = zone.get(oras) ?? { total: 0, urgente: 0 };
    z.total++;
    if ((r.next_step_date && r.next_step_date < astazi) || r.needs_recontact) z.urgente++;
    zone.set(oras, z);
  }
  const zoneSortate = [...zone.entries()].sort((a, b) => b[1].urgente - a[1].urgente || b[1].total - a[1].total);

  const zileLucrate = workingDaysSoFar(now);

  const stepLabel = (t: Task) =>
    t.next_step ? optionLabel(sections, "urmator", t.next_step) : "Pas următor";

  const renderTasks = (list: Task[]) => (
    <ul className="space-y-2">
      {list.map((t) => {
        const intarziere = daysBetween(t.next_step_date, astazi);
        const adresa = [t.address, t.city, t.county].filter(Boolean).join(", ");
        return (
          <li key={t.client_id} className={`card p-3 ${intarziere > 0 ? "border-l-4 border-l-[var(--color-bad)]" : ""}`}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <Link href={`/teren/firma/${t.client_id}`} className="text-[15px] font-semibold">
                {t.name}
              </Link>
              <span className="text-sm text-neutral-500">
                {[t.city, t.contact_person].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
              <span className="font-medium">→ {stepLabel(t)}</span>
              <span className="flex-1" />
              {intarziere > 0 ? (
                <span className="text-xs font-semibold text-[var(--color-bad)]">
                  restant de {intarziere} {intarziere === 1 ? "zi" : "zile"} · {shortDay(t.next_step_date)}
                </span>
              ) : (
                <span className="text-xs text-neutral-500">{shortDay(t.next_step_date)}</span>
              )}
            </div>
            {echipa ? (
              <p className="mt-0.5 text-xs text-neutral-500">
                {t.owner ? (memberName.get(t.owner) ?? "Agent") : "Fără agent"}
              </p>
            ) : null}
            <StepActions
              visitId={t.next_step_visit_id}
              clientId={t.client_id}
              phone={t.phone}
              mapQuery={adresa || null}
              today={astazi}
              step={t.next_step}
            />
          </li>
        );
      })}
    </ul>
  );

  const incheiatInfo = finished as {
    next_step_date: string | null;
    answers: Record<string, unknown> | null;
    clients: { name: string } | null;
  } | null;

  return (
    <div>
      <PageHeader
        title="Azi"
        description={new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long" }).format(now)}
        actions={
          conducere ? (
            <FilterChips
              label="Agenda cui"
              items={[
                { label: "Ale mele", href: "/teren", active: !echipa },
                { label: "Echipa", href: "/teren?cine=echipa", active: echipa },
              ]}
            />
          ) : undefined
        }
      />

      {incheiatInfo ? (
        <p className="mt-3 rounded-xl border border-neutral-200 bg-white p-3 text-sm">
          <b className="text-[var(--color-ok)]">✓ Vizită încheiată</b>
          {incheiatInfo.clients?.name ? ` la ${incheiatInfo.clients.name}` : ""}.{" "}
          {incheiatInfo.next_step_date
            ? `Firma îți apare în agendă ${shortDay(incheiatInfo.next_step_date)}.`
            : "Ai ales să nu mai insiști deocamdată."}
        </p>
      ) : null}

      <section className="card mt-3 space-y-4 p-4">
        <Progress
          label="Vizite azi"
          done={viziteAzi ?? 0}
          target={tintaZi}
          hint={`Săptămâna asta: ${viziteSapt ?? 0} din ${tintaZi * zileLucrate} până acum.`}
        />
        <Progress
          label="Oferte luna asta"
          done={oferteLuna ?? 0}
          target={tintaLuna}
          hint="Se numără ofertele emise de tine, indiferent din ce vizită pornesc."
        />
      </section>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Counter href="#restante" label="Restante" value={restante.length} alert />
        <Counter href="#azi" label="Azi" value={deAzi.length} />
        <Counter href="#maine" label={numeMaine} value={deMaine.length} />
      </div>

      {restante.length ? (
        <>
          <h2 id="restante" className="mt-5 mb-1 scroll-mt-4 text-base font-semibold text-[var(--color-bad)]">
            Restante · {restante.length}
          </h2>
          <p className="mb-2 text-xs text-neutral-500">
            Pași care trebuiau făcuți deja. Rezolvă-i sau mută-i pe o zi în care chiar ajungi.
          </p>
          {renderTasks(restante)}
        </>
      ) : null}

      <h2 id="azi" className="mt-5 mb-1 scroll-mt-4 text-base font-semibold">
        De făcut azi {deAzi.length ? `· ${deAzi.length}` : ""}
      </h2>
      {deAzi.length === 0 ? (
        <p className="card p-3 text-sm text-neutral-500">
          Nicio revenire programată azi. Dacă ai timp, ia o firmă din „De reluat”.
        </p>
      ) : (
        renderTasks(deAzi)
      )}

      <h2 id="maine" className="mt-5 mb-1 scroll-mt-4 text-base font-semibold">
        {numeMaine} {deMaine.length ? `· ${deMaine.length}` : ""}
      </h2>
      {deMaine.length === 0 ? (
        <p className="card p-3 text-sm text-neutral-500">Nimic programat pentru {numeMaine.toLowerCase()}.</p>
      ) : (
        renderTasks(deMaine)
      )}

      {urmatoarele.length ? (
        <details className="sec mt-5">
          <summary>
            Următoarele 7 zile
            <span className="ml-auto text-xs font-normal text-neutral-500">{urmatoarele.length}</span>
          </summary>
          <div className="pt-2 pb-3.5">{renderTasks(urmatoarele)}</div>
        </details>
      ) : null}

      <h2 className="mt-5 mb-1 text-base font-semibold">
        De reluat {deReluat.length ? `· ${deReluat.length}` : ""}
      </h2>
      <p className="mb-2 text-xs text-neutral-500">
        Firme fără pas următor, la care n-ai mai trecut de mult. Cele calde revin după{" "}
        {organization.recontact_days_warm ?? 7} zile, restul după {organization.recontact_days_cold ?? 30}.
      </p>
      {deReluat.length === 0 ? (
        <p className="card p-3 text-sm text-neutral-500">Nicio firmă uitată. Bine.</p>
      ) : (
        <ul className="space-y-2">
          {deReluat.map((r) => (
            <li key={r.client_id} className="card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/teren/firma/${r.client_id}`} className="font-medium">
                  {r.name}
                </Link>
                <span className="text-sm text-neutral-500">
                  {[r.city, r.contact_person].filter(Boolean).join(" · ")}
                </span>
                <span className="flex-1" />
                {r.is_warm ? (
                  <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                    caldă
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">{lastVisitLabel(r.last_visit)}</p>
            </li>
          ))}
        </ul>
      )}

      {zoneSortate.length > 1 ? (
        <>
          <h2 className="mt-5 mb-1 text-base font-semibold">Pe zone</h2>
          <p className="mb-2 text-xs text-neutral-500">
            Câte firme ai în fiecare localitate și câte cer atenție. Util când îți faci ziua.
          </p>
          <div className="flex flex-wrap gap-2">
            {zoneSortate.map(([oras, z]) => (
              <Link
                key={oras}
                href={`/teren/firme?city=${encodeURIComponent(oras === "Fără localitate" ? "" : oras)}`}
                className="chip chip-s"
              >
                {oras} · {z.total}
                {z.urgente ? (
                  <span className="ml-1 font-semibold text-[var(--color-bad)]">{z.urgente}</span>
                ) : null}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Counter({ href, label, value, alert }: { href: string; label: string; value: number; alert?: boolean }) {
  const red = alert && value > 0;
  return (
    <a href={href} className="card block min-h-12 p-2.5">
      <span className={`block text-2xl font-semibold tabular-nums ${red ? "text-[var(--color-bad)]" : ""}`}>
        {value}
      </span>
      <span className="text-xs text-neutral-500">{label}</span>
    </a>
  );
}
