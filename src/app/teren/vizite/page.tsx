import Link from "next/link";

import { deleteActivity, deleteVisit, logContactFromList } from "@/app/teren/actions";
import { SubmitButton } from "@/components/submit-button";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { addDays, shortDay, todayRo } from "@/lib/agenda";
import { requireOrg } from "@/lib/auth";
import { HISTORY_LABELS } from "@/lib/istoric";
import { periodFor } from "@/lib/perioade";
import { getQuestionCatalogue, optionLabel } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import type { Answers } from "@/lib/teren";

export const metadata = { title: "Vizitele mele" };

/** Contactele pe care le numără raportul, aceleași ca în `buildReportSnapshot`. */
const CONTACT_KINDS = ["telefon", "email", "whatsapp"] as const;
type ContactKind = (typeof CONTACT_KINDS)[number];

type VisitRow = {
  id: string;
  client_id: string;
  agent_id: string | null;
  visit_date: string;
  answers: Answers;
  pump_skus: string[] | null;
  next_step_date: string | null;
  next_step_done_at: string | null;
  clients: { id: string; name: string; city: string | null; contact_person: string | null } | null;
};

type ContactRow = {
  id: string;
  client_id: string;
  agent_id: string | null;
  kind: ContactKind;
  body: string | null;
  occurred_at: string;
  clients: { name: string } | null;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Toată activitatea agentului pe o zi sau o săptămână: vizitele și contactele
 * care intră în raport. De aici se trece agenda de hârtie în aplicație, zi cu
 * zi, se corectează ce e greșit și se trimite raportul.
 */
export default async function VizitePage(props: PageProps<"/teren/vizite">) {
  const { orgId, user, role } = await requireOrg();
  const { tip, data, cine, contact, incheiat } = await props.searchParams;

  const today = todayRo();
  const type = tip === "zi" ? "zi" : "saptamana";
  const anchor = typeof data === "string" && ISO_DAY.test(data) && data <= today ? data : today;
  const period = periodFor(type, anchor);

  const conducere = role !== "agent";
  const echipa = conducere && cine === "echipa";
  // Ziua pe care e deschis formularul de contact; doar în perioada afișată, până azi.
  const contactDay =
    !echipa && typeof contact === "string" && ISO_DAY.test(contact) &&
    contact >= period.from && contact <= period.to && contact <= today
      ? contact
      : null;

  const supabase = await createClient();
  let visitQuery = supabase
    .from("visits")
    .select("id, client_id, agent_id, visit_date, answers, pump_skus, next_step_date, next_step_done_at, clients(id, name, city, contact_person)")
    .eq("org_id", orgId)
    .gte("visit_date", period.from)
    .lte("visit_date", period.to)
    .order("created_at");
  // Contactele se citesc cu o zi în plus la capete: ziua lor e cea din România,
  // nu cea din UTC, și se taie mai jos, exact ca în raport.
  let contactQuery = supabase
    .from("client_activities")
    .select("id, client_id, agent_id, kind, body, occurred_at, clients(name)")
    .eq("org_id", orgId)
    .in("kind", [...CONTACT_KINDS])
    .gte("occurred_at", `${addDays(period.from, -1)}T00:00:00Z`)
    .lt("occurred_at", `${addDays(period.to, 2)}T00:00:00Z`)
    .order("occurred_at");
  if (!echipa) {
    visitQuery = visitQuery.eq("agent_id", user.id);
    contactQuery = contactQuery.eq("agent_id", user.id);
  }

  const [sections, { data: visitRows }, { data: contactRows }, { data: memberRows }, { data: clientRows }] =
    await Promise.all([
      getQuestionCatalogue(orgId),
      visitQuery,
      contactQuery,
      echipa
        ? supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId)
        : Promise.resolve({ data: [] as { user_id: string; full_name: string | null }[] }),
      contactDay
        ? supabase.from("clients").select("id, name, city").eq("org_id", orgId).order("name").limit(2000)
        : Promise.resolve({ data: [] as { id: string; name: string; city: string | null }[] }),
    ]);
  const visits = (visitRows ?? []) as unknown as VisitRow[];
  const contacts = ((contactRows ?? []) as unknown as ContactRow[])
    .map((c) => ({ ...c, day: todayRo(new Date(c.occurred_at)) }))
    .filter((c) => c.day >= period.from && c.day <= period.to);
  const memberName = new Map((memberRows ?? []).map((m) => [m.user_id, m.full_name ?? "Fără nume"]));
  const agentLabel = (id: string | null) => (id ? (memberName.get(id) ?? "Agent") : "Fără agent");

  // „Prima vizită” ca în foaia Vizite din Excel: vizita din ziua în care firma
  // a fost văzută prima oară. Firmele cu vizite înainte de perioadă sunt revizite.
  const clientIds = [...new Set(visits.map((v) => v.client_id))];
  const { data: earlierRows } = clientIds.length
    ? await supabase.from("visits").select("client_id").in("client_id", clientIds).lt("visit_date", period.from)
    : { data: [] };
  const vazuteInainte = new Set((earlierRows ?? []).map((r) => r.client_id as string));
  const primaZi = new Map<string, string>();
  for (const v of visits) {
    if (vazuteInainte.has(v.client_id)) continue;
    const cur = primaZi.get(v.client_id);
    if (!cur || v.visit_date < cur) primaZi.set(v.client_id, v.visit_date);
  }

  // Zilele, în ordinea din agendă: luni, marți… până azi. Weekendul apare doar
  // dacă are ceva trecut pe el.
  const days: string[] = [];
  for (let d = period.from; d <= period.to && d <= today; d = addDays(d, 1)) {
    const weekend = [0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay());
    const used = visits.some((v) => v.visit_date === d) || contacts.some((c) => c.day === d);
    if (!weekend || used || type === "zi") days.push(d);
  }

  const firme = new Set(visits.map((v) => v.client_id)).size;

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur = { tip: type, data: anchor, cine: echipa ? "echipa" : "" };
    for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) p.set(k, v);
    return `/teren/vizite?${p.toString()}`;
  };
  const current = periodFor(type, today);
  const isCurrent = current.from === period.from;
  const canGoNext = period.nextAnchor <= today;
  // După o ștergere, agentul rămâne pe aceeași zi sau săptămână.
  const inapoi = href({});

  // Raportul aceleiași perioade, cu aceleași filtre: ce se vede aici e ce se trimite.
  const raport = new URLSearchParams({ tip: type, data: anchor });
  if (echipa) raport.set("ag", "echipa");

  const finished =
    typeof incheiat === "string" ? visits.find((v) => v.id === incheiat) ?? null : null;

  const label = (groupId: string, value: unknown) =>
    typeof value === "string" && value ? optionLabel(sections, groupId, value) : null;

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  // „luni, 21 septembrie”: numele întreg al zilei, ca titlu de panou.
  const longDay = (day: string) =>
    new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${day}T12:00:00Z`),
    );

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: "/teren/mai-mult", label: "Mai mult" }}
        title={echipa ? "Vizitele echipei" : "Vizitele mele"}
        description="Vizitele, telefoanele și emailurile, pe zi sau pe săptămână — exact ce intră în raport. Trece aici agenda, corectează ce e greșit, apoi trimite raportul."
        actions={
          conducere ? (
            <FilterChips
              label="Ale cui"
              items={[
                { label: "Ale mele", href: href({ cine: null }), active: !echipa },
                { label: "Echipa", href: href({ cine: "echipa" }), active: echipa },
              ]}
            />
          ) : undefined
        }
      />

      {finished ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-3 text-sm">
          <b className="text-[var(--color-ok)]">✓ Vizită încheiată</b>
          {finished.clients?.name ? ` la ${finished.clients.name}` : ""}, pe {shortDay(finished.visit_date)}.
        </p>
      ) : null}

      <FilterChips
        label="Perioada"
        items={[
          { label: "Zilnic", href: href({ tip: "zi", data: today }), active: type === "zi" },
          { label: "Săptămânal", href: href({ tip: "saptamana", data: today }), active: type === "saptamana" },
        ]}
      />

      <div className="card flex items-center gap-2 p-2">
        <Link href={href({ data: period.prevAnchor })} className="btn btn-secondary btn-lg px-3" aria-label="Perioada anterioară">
          ‹
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-semibold">{period.label}</p>
          <p className="text-xs text-neutral-500">
            {plural(visits.length, "vizită", "vizite")} la {plural(firme, "firmă", "firme")} ·{" "}
            {plural(contacts.length, "contact", "contacte")}
          </p>
          {isCurrent ? null : (
            <Link href={href({ data: today })} className="text-xs font-medium text-brand-700 hover:underline">
              la perioada curentă
            </Link>
          )}
        </div>
        {canGoNext ? (
          <Link href={href({ data: period.nextAnchor })} className="btn btn-secondary btn-lg px-3" aria-label="Perioada următoare">
            ›
          </Link>
        ) : (
          <span className="btn btn-secondary btn-lg px-3 opacity-40" aria-hidden>
            ›
          </span>
        )}
      </div>

      {days.map((day) => {
        const dayVisits = visits.filter((v) => v.visit_date === day);
        const dayContacts = contacts.filter((c) => c.day === day);
        // Azi, „＋ Vizită” e vizita obișnuită; pe o zi trecută, vizita se trece pe ziua ei.
        const newVisit = day === today ? "/teren/vizita/noua" : `/teren/vizita/noua?data=${day}`;
        return (
          // Fiecare zi e un panou separat, cu fundal și bară în culoarea de brand:
          // se vede dintr-o privire pe ce zi trec vizita sau telefonul.
          <section
            key={day}
            id={`zi-${day}`}
            className="scroll-mt-4 rounded-2xl border border-brand-100 border-l-4 border-l-brand-600 bg-brand-50 p-3 lg:p-4"
          >
            <div className="mb-3 flex flex-wrap items-baseline gap-x-2 border-b border-brand-100 pb-2">
              <h2 className="text-base font-semibold text-brand-700 first-letter:uppercase">{longDay(day)}</h2>
              {day === today ? (
                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">azi</span>
              ) : null}
              <span className="flex-1" />
              <span className="text-xs text-neutral-500">
                {plural(dayVisits.length, "vizită", "vizite")} · {plural(dayContacts.length, "contact", "contacte")}
              </span>
            </div>

            {!echipa ? (
              <div className="mb-2 grid grid-cols-2 gap-2">
                <Link href={newVisit} className="btn btn-secondary min-h-11">
                  ＋ Vizită
                </Link>
                <Link
                  href={contactDay === day ? `${inapoi}#zi-${day}` : `${href({ contact: day })}#zi-${day}`}
                  className="btn btn-secondary min-h-11"
                  aria-expanded={contactDay === day}
                >
                  ＋ Telefon / email
                </Link>
              </div>
            ) : null}

            {contactDay === day ? (
              <form action={logContactFromList} className="card mb-2 space-y-3 p-3">
                <input type="hidden" name="date" value={day} />
                {(clientRows ?? []).length ? (
                  <>
                    <div>
                      <label htmlFor={`firma-${day}`} className="label">
                        Firma
                      </label>
                      <select id={`firma-${day}`} name="client_id" required className="input" defaultValue="">
                        <option value="" disabled>
                          Alege firma
                        </option>
                        {(clientRows ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.city ? ` · ${c.city}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Felul contactului">
                      {CONTACT_KINDS.map((k, i) => (
                        <label
                          key={k}
                          className="chip justify-center rounded-xl has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:text-white"
                        >
                          <input type="radio" name="kind" value={k} defaultChecked={i === 0} className="sr-only" />
                          {HISTORY_LABELS[k]}
                        </label>
                      ))}
                    </div>
                    <textarea
                      name="body"
                      rows={2}
                      placeholder="Ce s-a discutat (opțional)"
                      className="input"
                    />
                    <SubmitButton className="btn btn-ok btn-lg w-full" pendingLabel="Se salvează…">
                      Salvează pe {shortDay(day)}
                    </SubmitButton>
                    <p className="text-xs text-neutral-500">
                      Firma nouă? Trece întâi o vizită sau adaug-o din „＋ Vizită”, apoi notează contactul.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">
                    Încă nicio firmă. Adaugă firma din „＋ Vizită”, apoi notează contactul.
                  </p>
                )}
              </form>
            ) : null}

            {dayVisits.length === 0 && dayContacts.length === 0 ? (
              <p className="card p-3 text-sm text-neutral-500">Nimic trecut în ziua asta.</p>
            ) : null}

            {dayVisits.length ? (
              <ul className="grid items-start gap-2 lg:grid-cols-2 lg:gap-3">
                {dayVisits.map((v) => {
                  const pas = label("urmator", v.answers?.urmator);
                  const etapa = label("etapa", v.answers?.etapa);
                  const prima = primaZi.get(v.client_id) === v.visit_date;
                  return (
                    <li key={v.id} className="card p-3">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            prima
                              ? "border-brand-200 bg-brand-50 text-brand-700"
                              : "border-neutral-200 bg-neutral-100 text-neutral-700"
                          }`}
                        >
                          {prima ? "Prima vizită" : "Revizită"}
                        </span>
                        {v.clients ? (
                          <Link href={`/teren/firma/${v.clients.id}`} className="text-[15px] font-semibold">
                            {v.clients.name}
                          </Link>
                        ) : (
                          <span className="text-[15px] font-semibold">Firmă ștearsă</span>
                        )}
                        <span className="text-sm text-neutral-500">
                          {[v.clients?.city, v.clients?.contact_person].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm">
                        {pas ? <span className="font-medium">→ {pas}</span> : <span className="text-neutral-500">Fără pas următor</span>}
                        {v.next_step_date ? (
                          <span className="text-neutral-500">
                            {" "}
                            · {shortDay(v.next_step_date)}
                            {v.next_step_done_at ? " · rezolvat" : ""}
                          </span>
                        ) : null}
                      </p>
                      {v.pump_skus?.length ? (
                        <p className="mt-0.5 text-sm">
                          <span className="text-neutral-500">Modele discutate: </span>
                          {v.pump_skus.join(", ")}
                        </p>
                      ) : null}
                      {etapa || echipa ? (
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {[etapa, echipa ? agentLabel(v.agent_id) : null].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link href={`/teren/vizita/${v.id}`} className="btn btn-secondary min-h-11 flex-1">
                          Modifică vizita
                        </Link>
                        {v.clients ? (
                          <Link href={`/teren/firma/${v.clients.id}?date=1`} className="btn btn-secondary min-h-11 flex-1">
                            Datele firmei
                          </Link>
                        ) : null}
                        <form action={deleteVisit}>
                          <input type="hidden" name="visit_id" value={v.id} />
                          <input type="hidden" name="client_id" value={v.client_id} />
                          <input type="hidden" name="inapoi" value={inapoi} />
                          <SubmitButton
                            className="btn btn-danger-ghost min-h-11"
                            pendingLabel="Se șterge…"
                            confirmLabel="Da, șterge"
                            confirm={`Ștergi vizita${v.clients ? ` la ${v.clients.name}` : ""}? Ce ai completat se pierde.`}
                          >
                            Șterge
                          </SubmitButton>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {dayContacts.length ? (
              <ul className="card mt-2 divide-y divide-neutral-200">
                {dayContacts.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1 text-sm">
                      <span className="mr-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs">
                        {HISTORY_LABELS[c.kind]}
                      </span>
                      <Link href={`/teren/firma/${c.client_id}`} className="font-medium">
                        {c.clients?.name ?? "Firmă"}
                      </Link>
                      {echipa ? <span className="text-xs text-neutral-500"> · {agentLabel(c.agent_id)}</span> : null}
                      {c.body ? <p className="mt-0.5 break-words text-neutral-700">{c.body}</p> : null}
                    </div>
                    {conducere || c.agent_id === user.id ? (
                      <form action={deleteActivity}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="client_id" value={c.client_id} />
                        <SubmitButton
                          className="btn btn-danger-ghost btn-sm min-h-10"
                          pendingLabel="…"
                          confirmLabel="Da, șterge"
                          confirm={`Ștergi contactul (${HISTORY_LABELS[c.kind]})${c.clients?.name ? ` cu ${c.clients.name}` : ""}? Nu se mai numără în raport.`}
                        >
                          Șterge
                        </SubmitButton>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}

      <section className="card space-y-2 p-3.5">
        <p className="text-sm">
          <b>Ai trecut tot?</b>{" "}
          <span className="text-neutral-500">
            Raportul {type === "zi" ? "zilei" : "săptămânii"} se face din exact aceste date.
          </span>
        </p>
        <Link href={`/teren/rapoarte?${raport.toString()}`} className="btn btn-primary btn-lg w-full">
          Trimite raportul {type === "zi" ? "zilei" : "săptămânii"}
        </Link>
      </section>
    </div>
  );
}
