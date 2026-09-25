import { notFound } from "next/navigation";

import { deleteReport, refreshReportData } from "@/app/(app)/rapoarte/actions";
import { ReportDocument } from "@/components/raport/report-document";
import { ReportForm } from "@/components/raport/report-form";
import { ReportStatus } from "@/components/raport/reports-hub";
import { SendReport } from "@/components/raport/send-report";
import { SubmitButton } from "@/components/submit-button";
import { ActionMenu } from "@/components/ui/action-menu";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";
import { periodFor } from "@/lib/perioade";
import type { Kpi, ReportSection, ReportSnapshot } from "@/lib/raport-perioada";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/totals";

type Zona = "teren" | "birou";

export type ReportRow = {
  id: string;
  title: string;
  summary: string | null;
  sections: ReportSection[];
  section_notes: Partial<Record<ReportSection, string>>;
  data: ReportSnapshot;
  status: "ciorna" | "trimis";
  recipients: string[];
  sent_at: string | null;
  created_by: string | null;
  period_from: string;
  period_to: string;
  agent_filter: string | null;
  domain_filter: string | null;
};

/** Indicatorii în textul emailului: se citesc și fără să deschizi atașamentul. */
function kpiLine(k: Kpi): string {
  const v =
    k.format === "money"
      ? formatMoney(k.value)
      : k.format === "pct"
        ? `${Math.round(k.value * 100)}%`
        : String(k.value);
  return `• ${k.label}: ${v}${k.target ? ` (țintă ${k.target})` : ""}`;
}

/** Editarea unui raport salvat: textele, trimiterea și previzualizarea exactă. */
export async function ReportEditor({ id, zona }: { id: string; zona: Zona }) {
  const { orgId } = await requireOrg();
  const supabase = await createClient();
  const [{ data: row }, { data: members }] = await Promise.all([
    supabase.from("reports").select("*").eq("id", id).maybeSingle(),
    supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId),
  ]);
  if (!row) notFound();

  const r = row as ReportRow;
  const root = zona === "teren" ? "/teren/rapoarte" : "/rapoarte";
  const author = members?.find((m) => m.user_id === r.created_by)?.full_name ?? null;

  const excel = new URLSearchParams({ from: r.period_from, to: r.period_to, gran: periodFor(r.data.type, r.period_from).granularity });
  if (r.agent_filter) excel.set("ag", r.agent_filter);
  if (r.domain_filter) excel.set("dom", r.domain_filter);

  const subject = `${r.title} – ${r.data.orgName}`;
  const body = [
    "Bună ziua,",
    "",
    ...(r.summary?.trim() ? [r.summary.trim(), ""] : []),
    `Pe scurt, ${r.data.label}:`,
    ...r.data.kpis.filter((k) => ["vizite", "firmeNoi", "oferte", "valoare", "acceptate"].includes(k.key)).map(kpiLine),
    "",
    "Raportul complet este atașat, în PDF.",
    "",
    "Cu stimă,",
    author ?? "",
  ].join("\n");

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ href: root, label: "Rapoarte" }}
        title={r.title}
        badge={<ReportStatus status={r.status} sentAt={r.sent_at} />}
        description={`${r.data.label}${author ? ` · ${author}` : ""}`}
        actions={
          <>
            <a href={`/print/raport/${r.id}`} target="_blank" rel="noreferrer" className="btn btn-secondary">
              PDF
            </a>
            <a href={`/raport/export?${excel.toString()}`} className="btn btn-secondary">
              Excel
            </a>
            <ActionMenu label="Acțiuni pentru raport">
              {r.status === "ciorna" ? (
                <form action={refreshReportData}>
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton className="menu-item" pendingLabel="Se recalculează…">
                    Actualizează cifrele
                  </SubmitButton>
                </form>
              ) : null}
              <form action={deleteReport}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="zona" value={zona} />
                <SubmitButton
                  className="menu-item menu-item-danger btn-danger-ghost"
                  pendingLabel="Se șterge…"
                  confirm={`Ștergi raportul „${r.title}”?`}
                  confirmLabel="Da, șterge"
                >
                  Șterge raportul
                </SubmitButton>
              </form>
            </ActionMenu>
          </>
        }
      />

      {r.status === "trimis" ? (
        <p className="notice">
          Trimis {r.sent_at ? `pe ${formatDate(r.sent_at)}` : ""}. Cifrele rămân cele din momentul trimiterii, ca raportul
          să fie cel pe care l-a citit destinatarul. Textele se pot corecta în continuare.
        </p>
      ) : (
        <p className="notice">
          Cifrele sunt din {formatDate(r.data.generatedAt)}. Dacă între timp s-au adăugat vizite sau oferte, folosește
          „Actualizează cifrele” din meniul „⋯”; textele scrise rămân.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-3 text-base font-semibold">Textul raportului</h2>
            <ReportForm
              id={r.id}
              title={r.title}
              summary={r.summary}
              sections={r.sections}
              notes={r.section_notes ?? {}}
              recipients={r.recipients ?? []}
            />
          </section>
          <section className="card p-4">
            <h2 className="mb-3 text-base font-semibold">Trimite</h2>
            <SendReport id={r.id} recipients={r.recipients ?? []} subject={subject} body={body} />
          </section>
        </div>

        <section className="card overflow-hidden p-4 md:p-8">
          <p className="mb-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
            Previzualizare · așa arată în PDF
          </p>
          <ReportDocument
            data={r.data}
            title={r.title}
            summary={r.summary}
            sections={r.sections}
            sectionNotes={r.section_notes ?? {}}
            author={author}
          />
        </section>
      </div>
    </div>
  );
}
