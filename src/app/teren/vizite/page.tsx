import Link from "next/link";

import { deleteVisit } from "@/app/teren/actions";
import { SubmitButton } from "@/components/submit-button";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { shortDay, todayRo } from "@/lib/agenda";
import { requireOrg } from "@/lib/auth";
import { periodFor } from "@/lib/perioade";
import { getQuestionCatalogue, optionLabel } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import type { Answers } from "@/lib/teren";

export const metadata = { title: "Vizitele mele" };

type Row = {
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

/**
 * Firmele vizitate într-o zi sau într-o săptămână, ca agentul să-și revadă
 * munca: deschide vizita ca s-o corecteze, datele firmei, sau o șterge.
 */
export default async function VizitePage(props: PageProps<"/teren/vizite">) {
  const { orgId, user, role } = await requireOrg();
  const { tip, data, cine } = await props.searchParams;

  const today = todayRo();
  const type = tip === "zi" ? "zi" : "saptamana";
  const anchor = typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : today;
  const period = periodFor(type, anchor);

  const conducere = role !== "agent";
  const echipa = conducere && cine === "echipa";

  const supabase = await createClient();
  let query = supabase
    .from("visits")
    .select("id, client_id, agent_id, visit_date, answers, pump_skus, next_step_date, next_step_done_at, clients(id, name, city, contact_person)")
    .eq("org_id", orgId)
    .gte("visit_date", period.from)
    .lte("visit_date", period.to)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (!echipa) query = query.eq("agent_id", user.id);

  const [sections, { data: visitRows }, { data: memberRows }] = await Promise.all([
    getQuestionCatalogue(orgId),
    query,
    echipa
      ? supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId)
      : Promise.resolve({ data: [] as { user_id: string; full_name: string | null }[] }),
  ]);
  const visits = (visitRows ?? []) as unknown as Row[];
  const memberName = new Map((memberRows ?? []).map((m) => [m.user_id, m.full_name ?? "Fără nume"]));

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

  // Pe zile, cea mai recentă sus.
  const byDay = new Map<string, Row[]>();
  for (const v of visits) byDay.set(v.visit_date, [...(byDay.get(v.visit_date) ?? []), v]);
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
  // După ștergere, agentul rămâne pe aceeași zi sau săptămână.
  const inapoi = href({});

  const label = (groupId: string, value: unknown) =>
    typeof value === "string" && value ? optionLabel(sections, groupId, value) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ href: "/teren/mai-mult", label: "Mai mult" }}
        title={echipa ? "Vizitele echipei" : "Vizitele mele"}
        description="Firmele vizitate, pe zi sau pe săptămână. Deschide vizita ca s-o corectezi sau șterge-o dacă e greșită."
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
          {isCurrent ? (
            <p className="text-xs text-neutral-500">
              {visits.length} {visits.length === 1 ? "vizită" : "vizite"} · {firme} {firme === 1 ? "firmă" : "firme"}
            </p>
          ) : (
            <Link href={href({ data: today })} className="text-xs font-medium text-brand-700 hover:underline">
              {visits.length} {visits.length === 1 ? "vizită" : "vizite"} · la perioada curentă
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

      {visits.length === 0 ? (
        <p className="card p-4 text-sm text-neutral-500">
          Nicio vizită în perioada asta. Vizitele apar aici după ce apeși „＋ Vizită”.
        </p>
      ) : (
        [...byDay.entries()].map(([day, list]) => (
          <section key={day}>
            {type === "saptamana" ? (
              <h2 className="mb-1.5 text-sm font-semibold capitalize">
                {shortDay(day)} <span className="font-normal text-neutral-500">· {list.length}</span>
              </h2>
            ) : null}
            <ul className="grid items-start gap-2 lg:grid-cols-2 lg:gap-3">
              {list.map((v) => {
                const pas = label("urmator", v.answers?.urmator);
                const etapa = label("etapa", v.answers?.etapa);
                return (
                  <li key={v.id} className="card p-3">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          primaZi.get(v.client_id) === v.visit_date
                            ? "border-brand-200 bg-brand-50 text-brand-700"
                            : "border-neutral-200 bg-neutral-100 text-neutral-700"
                        }`}
                      >
                        {primaZi.get(v.client_id) === v.visit_date ? "Prima vizită" : "Revizită"}
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
                        {[etapa, echipa ? (v.agent_id ? (memberName.get(v.agent_id) ?? "Agent") : "Fără agent") : null]
                          .filter(Boolean)
                          .join(" · ")}
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
          </section>
        ))
      )}
    </div>
  );
}
