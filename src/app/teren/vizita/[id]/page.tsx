import Link from "next/link";
import { notFound } from "next/navigation";

import { createQuoteFromVisit, deleteVisit } from "@/app/teren/actions";
import { VisitForm, type PumpOption } from "@/app/teren/vizita/[id]/visit-form";
import { SubmitButton } from "@/components/submit-button";
import { requireOrg } from "@/lib/auth";
import { buildMaterialSuggestions } from "@/lib/materiale";
import { getQuestionCatalogue } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import type { Visit } from "@/lib/teren";

export const metadata = { title: "Vizită" };

/** Puntea spre ofertare: din vizită direct în ofertă, cu modelele discutate pe ea. */
function QuoteBridge({
  visitId,
  models,
  quote,
}: {
  visitId: string;
  models: number;
  quote: { id: string; number: string } | null;
}) {
  if (quote) {
    return (
      <div className="card mb-3 flex flex-wrap items-center gap-2 p-3 text-sm">
        <span className="flex-1">
          Din vizita asta a ieșit oferta <b>{quote.number}</b>.
        </span>
        <Link href={`/oferte/${quote.id}`} className="btn btn-secondary text-sm">
          Deschide oferta
        </Link>
      </div>
    );
  }

  if (!models) return null;

  return (
    <form action={createQuoteFromVisit} className="card mb-3 flex flex-wrap items-center gap-2 p-3">
      <input type="hidden" name="visit_id" value={visitId} />
      <span className="flex-1 text-sm">
        {models} {models === 1 ? "model discutat" : "modele discutate"} — le pot trece direct pe ofertă.
      </span>
      <SubmitButton className="btn btn-primary text-sm" pendingLabel="Se pregătește…">
        Ofertă din vizită
      </SubmitButton>
    </form>
  );
}

export default async function VizitaPage(props: PageProps<"/teren/vizita/[id]">) {
  const { id } = await props.params;
  const { orgId } = await requireOrg();

  const supabase = await createClient();
  const [{ data: visitRow }, sections, { data: pumpRows }, { data: quoteRow }] = await Promise.all([
    supabase.from("visits").select("*, clients(id, name, city)").eq("id", id).maybeSingle(),
    getQuestionCatalogue(orgId),
    supabase
      .from("catalog_items")
      .select("sku, name, category, unit_price, description, materials")
      .eq("org_id", orgId)
      .not("sku", "is", null)
      .order("name"),
    supabase.from("quotes").select("id, number").eq("visit_id", id).maybeSingle(),
  ]);

  if (!visitRow) notFound();

  const visit = visitRow as Visit & { clients: { id: string; name: string; city: string | null } | null };
  const pumps = (pumpRows ?? []) as PumpOption[];
  const suggestions = buildMaterialSuggestions(pumpRows ?? []);

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

      <QuoteBridge visitId={visit.id} models={visit.pump_skus?.length ?? 0} quote={quoteRow} />

      <VisitForm
        visitId={visit.id}
        sections={sections}
        pumps={pumps}
        suggestions={suggestions}
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
