import Link from "next/link";

import { StepActions } from "@/app/teren/step-actions";
import { todayRo } from "@/lib/agenda";
import { requireOrg } from "@/lib/auth";
import { getAllDomains, getDomains } from "@/lib/domenii";
import { getQuestionCatalogue } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/totals";
import { FOCUS_LABELS, gaps, lastVisitLabel, tradeLabel, type ClientState, type Focus } from "@/lib/teren";

export const metadata = { title: "Firme" };

export default async function TerenPage(props: PageProps<"/teren/firme">) {
  const { orgId } = await requireOrg();
  const { q, etapa, prio, restante, focus, city, domeniu } = await props.searchParams;

  const search = typeof q === "string" ? q.trim() : "";
  const stage = typeof etapa === "string" ? etapa : "";
  const priority = typeof prio === "string" ? prio : "";
  const onlyLate = restante === "1";
  const focusFilter = typeof focus === "string" ? focus : "";
  const oras = typeof city === "string" ? city : "";
  const domainFilter = typeof domeniu === "string" ? domeniu : "";

  const [sections, domains, toate, supabase] = await Promise.all([
    getQuestionCatalogue(orgId),
    getDomains(orgId),
    getAllDomains(orgId),
    createClient(),
  ]);
  // Filtrele arată domeniile folosite; etichetele se citesc din toate, ca o
  // firmă rămasă într-un domeniu scos din uz să nu apară fără nume.
  const domainById = new Map(toate.map((d) => [d.id, d]));
  const stageGroup = sections.flatMap((s) => s.groups).find((g) => g.id === "etapa");

  let query = supabase.from("client_state").select("*").eq("org_id", orgId);
  if (search) {
    const cols = ["name", "city", "phone", "contact_person", "cui", "reg_com", "email"];
    query = query.or(cols.map((col) => `${col}.ilike.%${search}%`).join(","));
  }
  if (stage) query = query.eq("stage", stage);
  if (priority) query = query.eq("priority", priority);
  if (onlyLate) query = query.eq("next_step_late", true);
  if (focusFilter) query = query.eq("focus", focusFilter);
  if (oras) query = query.eq("city", oras);
  if (domainFilter) query = query.eq("domain", domainFilter);

  const { data } = await query;
  const rows = (data ?? []) as ClientState[];

  // Întâi ce are pas scadent, apoi ce a fost vizitat cel mai recent.
  rows.sort((a, b) => {
    const ka = a.next_step_date ?? "9999-12-31";
    const kb = b.next_step_date ?? "9999-12-31";
    if (ka !== kb) return ka < kb ? -1 : 1;
    return (b.last_visit ?? "").localeCompare(a.last_visit ?? "") || a.name.localeCompare(b.name, "ro");
  });

  const late = rows.filter((r) => r.next_step_late).length;
  const today = todayRo();
  const due = rows.filter((r) => r.next_step_date === today).length;

  const chipHref = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string> = {
      q: search, etapa: stage, prio: priority,
      restante: onlyLate ? "1" : "", focus: focusFilter, city: oras,
      domeniu: domainFilter,
    };
    for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/teren/firme?${s}` : "/teren/firme";
  };

  return (
    <div>
      <h1 className="text-xl font-semibold">Firme și meseriași</h1>
      <p className="mt-0.5 text-sm text-neutral-500">
        {rows.length} {rows.length === 1 ? "firmă" : "firme"} · {late}{" "}
        {late === 1 ? "pas restant" : "pași restanți"} · {due} scadent{due === 1 ? "" : "e"} azi
      </p>

      <form className="my-3">
        {stage ? <input type="hidden" name="etapa" value={stage} /> : null}
        {priority ? <input type="hidden" name="prio" value={priority} /> : null}
        {onlyLate ? <input type="hidden" name="restante" value="1" /> : null}
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Caută firmă, persoană, CUI, telefon"
          className="input"
        />
      </form>

      <div className="mb-2 flex flex-wrap gap-2">
        {domains.map((d) => (
          <Link
            key={d.id}
            href={chipHref({ domeniu: domainFilter === d.id ? null : d.id })}
            className={`chip chip-s ${domainFilter === d.id ? "chip-on" : ""}`}
          >
            {d.short_label}
          </Link>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {(["urmareste", "deblocheaza", "educa"] as Focus[]).map((f) => (
          <Link
            key={f}
            href={chipHref({ focus: focusFilter === f ? null : f })}
            className={`chip chip-s ${focusFilter === f ? "chip-on" : ""}`}
          >
            {FOCUS_LABELS[f]}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(stageGroup?.options ?? []).map((o) => (
          <Link
            key={o.id}
            href={chipHref({ etapa: stage === o.id ? null : o.id })}
            className={`chip chip-s ${stage === o.id ? "chip-on" : ""}`}
          >
            {o.label}
          </Link>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          href={chipHref({ restante: onlyLate ? null : "1" })}
          className={`chip chip-s ${onlyLate ? "chip-on" : ""}`}
        >
          Pași restanți
        </Link>
        {["A", "B", "C"].map((p) => (
          <Link
            key={p}
            href={chipHref({ prio: priority === p ? null : p })}
            className={`chip chip-s ${priority === p ? "chip-on" : ""}`}
          >
            Prioritate {p}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card mt-3 p-4 text-sm text-neutral-500">
          {search || stage || priority || onlyLate || domainFilter
            ? "Nicio firmă pentru filtrul ales."
            : "Încă nicio firmă. Apasă „＋ Vizită” după prima întâlnire."}
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => {
            // Lipsurile se numesc în unitatea domeniului: „ml/zi” la marcaje.
            const lipsuri = gaps(r.answers, domainById.get(r.domain ?? "")?.unit_short).slice(0, 2);
            // Pasul e programat dacă are dată, chiar dacă agentul n-a apucat să aleagă
            // și felul lui. Altfel ar fi numărat în antet, dar invizibil pe card.
            const hasStep = Boolean(r.next_step || r.next_step_date);
            const stepLabel = r.next_step
              ? stageGroupLabel(sections, "urmator", r.next_step)
              : "pas următor";

            return (
              <li key={r.client_id} className="card p-3">
                <Link href={`/teren/firma/${r.client_id}`} className="block">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-[15px]">{r.name}</b>
                    <span className="text-sm text-neutral-500">
                      {[r.city, r.contact_person].filter(Boolean).join(" · ")}
                    </span>
                    <span className="flex-1" />
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        r.focus === "urmareste"
                          ? "border-brand-600 bg-brand-600 text-white"
                          : r.focus === "deblocheaza"
                            ? "border-brand-200 bg-brand-50 text-brand-700"
                            : "border-neutral-200 bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {FOCUS_LABELS[r.focus]}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    {r.stage ? <Badge>{stageGroupLabel(sections, "etapa", r.stage)}</Badge> : null}
                    {r.answers.mod ? (
                      <Badge>{stageGroupLabel(sections, "mod", String(r.answers.mod))}</Badge>
                    ) : null}
                    {r.interest ? (
                      <Badge>{stageGroupLabel(sections, "interes", r.interest)}</Badge>
                    ) : null}
                    {r.domain ? (
                      <Badge>{domainById.get(r.domain)?.short_label ?? r.domain}</Badge>
                    ) : null}
                    {r.trade_type ? (
                      <span className="text-neutral-500">{tradeLabel(r.trade_type)}</span>
                    ) : null}
                    <span className="text-neutral-500">apetit {r.priority}</span>
                    {r.pending_escalations > 0 ? <Badge>întrebare owner</Badge> : null}
                  </div>
                </Link>

                {hasStep ? (
                  <details className="mt-1.5">
                    <summary
                      className={`flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm ${
                        r.next_step_late ? "font-semibold text-[var(--color-bad)]" : ""
                      }`}
                    >
                      <span className="flex-1">
                        → {stepLabel}
                        {r.next_step_date ? ` · ${formatDate(r.next_step_date)}` : ""}
                      </span>
                      <span className="text-xs font-medium text-brand-700">Rezolvă ▾</span>
                    </summary>
                    {r.next_step_visit_id ? (
                      <StepActions
                        visitId={r.next_step_visit_id}
                        clientId={r.client_id}
                        phone={null}
                        mapQuery={null}
                        today={today}
                        withStartVisit={false}
                      />
                    ) : null}
                  </details>
                ) : null}

                <p className="mt-1 text-xs text-neutral-500">
                  {lastVisitLabel(r.last_visit)}
                  {lipsuri.length ? ` · de aflat: ${lipsuri.join(", ")}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5">
      {children}
    </span>
  );
}

function stageGroupLabel(
  sections: Awaited<ReturnType<typeof getQuestionCatalogue>>,
  groupId: string,
  optionId: string,
): string {
  for (const s of sections) {
    const g = s.groups.find((x) => x.id === groupId);
    if (g) return g.options.find((o) => o.id === optionId)?.label ?? optionId;
  }
  return optionId;
}
