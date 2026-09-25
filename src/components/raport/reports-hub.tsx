import Link from "next/link";

import { createReport } from "@/app/(app)/rapoarte/actions";
import { ReportDocument } from "@/components/raport/report-document";
import { SubmitButton } from "@/components/submit-button";
import { DataList } from "@/components/ui/data-list";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { todayRo } from "@/lib/agenda";
import { requireOrg } from "@/lib/auth";
import { getDomains } from "@/lib/domenii";
import { isReportType, periodFor, REPORT_TYPES, type ReportType } from "@/lib/perioade";
import { buildReportSnapshot, defaultTitle, DEFAULT_SECTIONS } from "@/lib/raport-perioada";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/totals";

type Zona = "teren" | "birou";
type Search = { tip?: string | string[]; data?: string | string[]; ag?: string | string[]; dom?: string | string[] };

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
export async function ReportsHub({ zona, search }: { zona: Zona; search: Search }) {
  const { orgId, organization, user, role } = await requireOrg();
  const conducere = role !== "agent";
  const root = zona === "teren" ? "/teren/rapoarte" : "/rapoarte";

  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const type: ReportType = isReportType(one(search.tip)) ? (one(search.tip) as ReportType) : "saptamana";
  const today = todayRo();
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(one(search.data)) ? one(search.data) : today;
  // Pe teren fiecare își vede raportul lui; conducerea alege, la birou, agentul.
  // „echipa” e explicit, ca pe teren (unde implicit ești tu) să se poată alege și echipa.
  const agParam = one(search.ag);
  const agentId = !conducere
    ? user.id
    : agParam === "echipa"
      ? null
      : agParam || (zona === "teren" ? user.id : null);
  const domainId = one(search.dom) || null;
  const period = periodFor(type, anchor);

  const supabase = await createClient();
  const [snapshot, domains, { data: members }, { data: saved }] = await Promise.all([
    buildReportSnapshot(orgId, organization.name, type, anchor, agentId, domainId),
    getDomains(orgId),
    supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId),
    supabase
      .from("reports")
      .select("id, title, type, period_from, period_to, status, sent_at, updated_at, created_by")
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
        description="Alegi perioada, verifici cifrele, apoi salvezi raportul ca să adaugi rezumatul și să-l trimiți prin Outlook."
        back={zona === "teren" ? { href: "/teren/mai-mult", label: "Mai mult" } : undefined}
      />

      <nav aria-label="Tipul raportului" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {REPORT_TYPES.map((r) => (
          <Link
            key={r.id}
            href={href({ tip: r.id, data: today })}
            aria-current={r.id === type ? "page" : undefined}
            className={`rounded-xl border p-3 transition-colors ${
              r.id === type
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-neutral-200 bg-white hover:border-brand-200 hover:bg-brand-50"
            }`}
          >
            <span className="block font-semibold">{r.label}</span>
            <span className={`block text-xs ${r.id === type ? "text-white/85" : "text-neutral-500"}`}>{r.hint}</span>
          </Link>
        ))}
      </nav>

      {conducere || domains.length > 1 ? (
        <div className="card space-y-3 p-3">
          {conducere ? (
            <FilterChips
              label="Agentul"
              items={[
                { label: "Toată echipa", href: href({ ag: "echipa" }), active: !agentId },
                ...(members ?? []).map((m) => ({
                  label: m.full_name ?? "Fără nume",
                  href: href({ ag: m.user_id }),
                  active: agentId === m.user_id,
                })),
              ]}
            />
          ) : null}
          {domains.length > 1 ? (
            <FilterChips
              label="Domeniul"
              items={[
                { label: "Toate domeniile", href: href({ dom: null }), active: !domainId },
                ...domains.map((d) => ({ label: d.short_label, href: href({ dom: d.id }), active: domainId === d.id })),
              ]}
            />
          ) : null}
        </div>
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

      <div className="card overflow-hidden p-4 md:p-8">
        <ReportDocument
          data={snapshot}
          title={defaultTitle(snapshot)}
          sections={DEFAULT_SECTIONS[type]}
          author={who(user.id)}
        />
      </div>

      <section>
        <h2 className="mb-2 text-base font-semibold">Rapoarte salvate</h2>
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
              { header: "Stare", cell: (r) => <ReportStatus status={r.status as string} sentAt={r.sent_at as string | null} /> },
              { header: "Autor", className: "text-neutral-500", cell: (r) => who(r.created_by as string | null) ?? "—" },
              { header: "Modificat", className: "text-neutral-500", cell: (r) => formatDate(r.updated_at as string) },
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
