import Link from "next/link";

import { createReport } from "@/app/(app)/rapoarte/actions";
import { ReportDocument } from "@/components/raport/report-document";
import { SubmitButton } from "@/components/submit-button";
import { DataList } from "@/components/ui/data-list";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { todayRo } from "@/lib/agenda";
import { requireOrg } from "@/lib/auth";
import { getDomains } from "@/lib/domenii";
import { isReportType, periodFor, REPORT_TYPES, type ReportType } from "@/lib/perioade";
import {
  buildReportSnapshot,
  defaultSections,
  defaultTitle,
  SCOPE_LABELS,
  type ReportScope,
} from "@/lib/raport-perioada";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/totals";

type Zona = "teren" | "birou";
type Search = {
  tip?: string | string[];
  data?: string | string[];
  ag?: string | string[];
  dom?: string | string[];
  sters?: string | string[];
};

export function ReportStatus({ status, sentAt }: { status: string; sentAt?: string | null }) {
  return status === "trimis" ? (
    <span className="inline-flex rounded-full border border-brand-600 bg-brand-600 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-white">
      ✓ Trimis{sentAt ? ` ${formatDate(sentAt)}` : ""}
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
      Ciornă
    </span>
  );
}

/**
 * Rapoartele: alegi tipul și perioada, vezi raportul generat din date, apoi îl
 * salvezi ca să-l completezi și să-l trimiți. Agentul vede doar raportul lui.
 */
const DATE_TIME = new Intl.DateTimeFormat("ro-RO", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Bucharest",
});
const dateTime = (v: string | null) => (v ? DATE_TIME.format(new Date(v)) : "—");

export async function ReportsHub({ zona, search }: { zona: Zona; search: Search }) {
  const { orgId, organization, user, role } = await requireOrg();
  const conducere = role !== "agent";
  const root = zona === "teren" ? "/teren/rapoarte" : "/rapoarte";

  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const type: ReportType = isReportType(one(search.tip)) ? (one(search.tip) as ReportType) : "saptamana";
  const today = todayRo();
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(one(search.data)) ? one(search.data) : today;
  // Implicit, fiecare își vede raportul lui. Conducerea poate deschide raportul
  // altui agent sau raportul echipei — „echipa” e explicit, ca cele două să nu
  // se confunde niciodată.
  const agParam = one(search.ag);
  const agentId = !conducere ? user.id : agParam === "echipa" ? null : agParam || user.id;
  const scope: ReportScope = agentId ? "agent" : "echipa";
  const domainId = one(search.dom) || null;
  const period = periodFor(type, anchor);

  const supabase = await createClient();
  const [snapshot, domains, { data: members }, { data: saved }] = await Promise.all([
    buildReportSnapshot(orgId, organization.name, type, anchor, agentId, domainId),
    getDomains(orgId),
    supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId),
    supabase
      .from("reports")
      .select("id, title, type, period_from, period_to, status, sent_at, created_at, updated_at, created_by, agent_filter")
      .eq("org_id", orgId)
      .order("period_from", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur = { tip: type, data: anchor, ag: conducere ? (agentId ?? "echipa") : "", dom: domainId ?? "" };
    for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) p.set(k, v);
    return `${root}?${p.toString()}`;
  };
  const current = periodFor(type, today);
  const isCurrent = current.from === period.from;
  const canGoNext = period.nextAnchor <= today;

  const excel = new URLSearchParams({ from: period.from, to: period.to, gran: period.granularity });
  if (agentId) excel.set("ag", agentId);
  if (domainId) excel.set("dom", domainId);

  const who = (id: string | null) => members?.find((m) => m.user_id === id)?.full_name ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={zona === "teren" && !conducere ? "Rapoartele mele" : "Rapoarte"}
        description="Alegi perioada, verifici cifrele, apoi salvezi raportul săptămânal sau lunar ca să adaugi rezumatul și să-l trimiți prin Outlook."
        back={zona === "teren" ? { href: "/teren/mai-mult", label: "Mai mult" } : undefined}
      />

      {/* Pe telefon, două rânduri compacte în loc de șase cartonașe: cine și ce raport. */}
      <div className="space-y-2">
        {conducere ? (
          <Segmented
            label="Pentru cine e raportul"
            items={(
              [
                ["agent", user.id],
                ["echipa", "echipa"],
              ] as [ReportScope, string][]
            ).map(([id, ag]) => ({ label: SCOPE_LABELS[id], href: href({ ag }), active: scope === id }))}
          />
        ) : null}
        <Segmented
          label="Tipul raportului"
          items={REPORT_TYPES.map((r) => ({ label: r.label, href: href({ tip: r.id, data: today }), active: r.id === type }))}
        />
        <p className="px-1 text-xs text-neutral-500">
          {REPORT_TYPES.find((r) => r.id === type)?.hint}
          {conducere ? ` · ${scope === "echipa" ? "toți agenții împreună, cu defalcare pe agent" : "activitatea unui singur agent"}` : ""}
        </p>
      </div>

      {(conducere && scope === "agent" && (members?.length ?? 0) > 1) || domains.length > 1 ? (
        <FilterBar
          path={root}
          sticky={false}
          params={Object.fromEntries(
            Object.entries({ tip: type, data: anchor, ag: conducere ? (agentId ?? "echipa") : "", dom: domainId ?? "" }).filter(
              ([, v]) => v,
            ),
          )}
          groups={[
            ...(conducere && scope === "agent" && (members?.length ?? 0) > 1
              ? [
                  {
                    param: "ag",
                    label: "Agentul",
                    options: (members ?? []).map((m) => ({ value: m.user_id, label: m.full_name ?? "Fără nume" })),
                  },
                ]
              : []),
            ...(domains.length > 1
              ? [
                  {
                    param: "dom",
                    label: "Domeniul",
                    allLabel: "Toate domeniile",
                    options: domains.map((d) => ({ value: d.id, label: d.short_label })),
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      <div className="card flex items-center gap-2 p-2">
        <Link href={href({ data: period.prevAnchor })} className="btn btn-secondary btn-lg px-3" aria-label="Perioada anterioară">
          ‹
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-semibold">{period.label}</p>
          {isCurrent ? (
            <p className="text-xs text-neutral-500">perioada curentă, în desfășurare</p>
          ) : (
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

      {type === "zi" ? (
        <div className="grid gap-2 sm:flex sm:items-center">
          <p className="notice sm:flex-1">
            Fișa zilei nu se trimite: e centralizarea zilei {scope === "echipa" ? "pentru echipă" : "pentru agent"}.
            Vizitele, contactele și ofertele ei intră singure în rapoartele săptămânale și lunare.
          </p>
          <a href={`/raport/export?${excel.toString()}`} className="btn btn-secondary btn-lg">
            Descarcă Excel
          </a>
        </div>
      ) : (
      <div className="grid gap-2 sm:flex">
        <form action={createReport} className="sm:flex-1">
          <input type="hidden" name="tip" value={type} />
          <input type="hidden" name="data" value={anchor} />
          <input type="hidden" name="ag" value={agentId ?? ""} />
          <input type="hidden" name="dom" value={domainId ?? ""} />
          <input type="hidden" name="zona" value={zona} />
          <SubmitButton className="btn btn-primary btn-lg w-full" pendingLabel="Se salvează…">
            Salvează și completează raportul
          </SubmitButton>
        </form>
        <a href={`/raport/export?${excel.toString()}`} className="btn btn-secondary btn-lg">
          Descarcă Excel
        </a>
      </div>
      )}

      <div className="card overflow-hidden p-4 md:p-8">
        <ReportDocument
          data={snapshot}
          title={defaultTitle(snapshot)}
          sections={defaultSections(type, scope)}
          author={who(user.id)}
        />
      </div>

      <section>
        <h2 className="mb-2 text-base font-semibold">Rapoarte salvate</h2>
        {one(search.sters) === "1" ? (
          <p role="status" className="notice mb-2">
            Raportul a fost șters.
          </p>
        ) : null}
        {saved?.length ? (
          <DataList
            rows={saved}
            rowKey={(r) => r.id as string}
            minWidth={640}
            title={(r) => (
              <Link href={`${root}/${r.id}`} className="text-brand-700 hover:underline">
                {r.title as string}
              </Link>
            )}
            columns={[
              {
                header: "Raport",
                hideOnMobile: true,
                cell: (r) => (
                  <Link href={`${root}/${r.id}`} className="font-medium text-brand-700 hover:underline">
                    {r.title as string}
                  </Link>
                ),
              },
              {
                header: "Pentru",
                cell: (r) =>
                  r.agent_filter ? (
                    (who(r.agent_filter as string) ?? "Agent")
                  ) : (
                    <span className="font-medium">Echipa</span>
                  ),
              },
              { header: "Stare", cell: (r) => <ReportStatus status={r.status as string} sentAt={r.sent_at as string | null} /> },
              { header: "Autor", className: "text-neutral-500", cell: (r) => who(r.created_by as string | null) ?? "—" },
              // Cu ora: două rapoarte pe aceeași perioadă se deosebesc după când au fost făcute.
              { header: "Creat", className: "text-neutral-500", cell: (r) => dateTime(r.created_at as string) },
              { header: "Modificat", className: "text-neutral-500", cell: (r) => dateTime(r.updated_at as string) },
            ]}
          />
        ) : (
          <p className="card p-3 text-sm text-neutral-500">
            Încă niciun raport salvat. Apasă „Salvează și completează raportul” pe perioada dorită.
          </p>
        )}
      </section>
    </div>
  );
}
