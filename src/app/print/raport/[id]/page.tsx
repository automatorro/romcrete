import { notFound } from "next/navigation";

import type { ReportRow } from "@/components/raport/report-editor";
import { ReportDocument } from "@/components/raport/report-document";
import { PrintButton } from "@/components/print-button";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Raport" };

/** Raportul pe foaie A4, pentru „Salvează ca PDF” și tipărire. */
export default async function PrintRaportPage(props: PageProps<"/print/raport/[id]">) {
  const { id } = await props.params;
  const { orgId } = await requireOrg();
  const supabase = await createClient();
  const [{ data: row }, { data: members }] = await Promise.all([
    supabase.from("reports").select("*").eq("id", id).maybeSingle(),
    supabase.from("memberships").select("user_id, full_name").eq("org_id", orgId),
  ]);
  if (!row) notFound();
  const r = row as ReportRow;

  return (
    <div className="min-h-screen bg-neutral-200 py-6 print:min-h-0 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4">
        <p className="text-sm text-neutral-700">
          În fereastra de tipărire alege „Salvează ca PDF”, apoi atașează fișierul la email.
        </p>
        <PrintButton label="Tipărește / Salvează ca PDF" />
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <div className="a4-sheet mx-auto bg-white shadow-lg">
          <ReportDocument
            data={r.data}
            title={r.title}
            summary={r.summary}
            sections={r.sections}
            sectionNotes={r.section_notes ?? {}}
            author={members?.find((m) => m.user_id === r.created_by)?.full_name ?? null}
          />
        </div>
      </div>
    </div>
  );
}
