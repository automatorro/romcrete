import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteVisit } from "@/app/teren/actions";
import { VisitForm, type PumpOption } from "@/app/teren/vizita/[id]/visit-form";
import { SubmitButton } from "@/components/submit-button";
import { requireOrg } from "@/lib/auth";
import { getQuestionCatalogue } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import type { Visit } from "@/lib/teren";

export const metadata = { title: "Vizită" };

export default async function VizitaPage(props: PageProps<"/teren/vizita/[id]">) {
  const { id } = await props.params;
  const { orgId } = await requireOrg();

  const supabase = await createClient();
  const [{ data: visitRow }, sections, { data: pumpRows }] = await Promise.all([
    supabase.from("visits").select("*, clients(id, name, city)").eq("id", id).maybeSingle(),
    getQuestionCatalogue(orgId),
    supabase
      .from("catalog_items")
      .select("sku, name, category, unit_price")
      .eq("org_id", orgId)
      .not("sku", "is", null)
      .order("name"),
  ]);

  if (!visitRow) notFound();

  const visit = visitRow as Visit & { clients: { id: string; name: string; city: string | null } | null };
  const pumps = (pumpRows ?? []) as PumpOption[];

  return (
    <div>
      <div className="flex items-center gap-2">
        <Link href="/teren" className="text-sm text-brand-700 hover:underline">
          ← Firme
        </Link>
        <span className="flex-1" />
        <form action={deleteVisit}>
          <input type="hidden" name="visit_id" value={visit.id} />
          <input type="hidden" name="client_id" value={visit.client_id} />
          <SubmitButton
            className="btn btn-ghost text-xs text-[var(--color-bad)]"
            pendingLabel="…"
            confirm="Ștergi vizita? Ce ai completat se pierde."
          >
            Șterge vizita
          </SubmitButton>
        </form>
      </div>

      <h1 className="mt-1 text-xl font-semibold">{visit.clients?.name ?? "Vizită"}</h1>
      {visit.clients?.city ? (
        <p className="text-sm text-neutral-500">{visit.clients.city}</p>
      ) : null}

      <p className="hint my-3">
        Nimic nu e obligatoriu și totul se salvează singur. Prima secțiune se completează în
        20 de secunde; restul poți să-l completezi în mașină.
      </p>

      <VisitForm
        visitId={visit.id}
        sections={sections}
        pumps={pumps}
        initial={{
          answers: visit.answers ?? {},
          notes: visit.notes ?? {},
          pumpSkus: visit.pump_skus ?? [],
          nextStepDate: visit.next_step_date ?? "",
          visitDate: visit.visit_date,
        }}
      />
    </div>
  );
}
