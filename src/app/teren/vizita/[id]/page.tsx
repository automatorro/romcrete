import Link from "next/link";
import { notFound } from "next/navigation";

import { createQuoteFromVisit, deleteVisit } from "@/app/teren/actions";
import { VisitForm, type PumpOption } from "@/app/teren/vizita/[id]/visit-form";
import { SubmitButton } from "@/components/submit-button";
import { ActionMenu } from "@/components/ui/action-menu";
import { PageHeader } from "@/components/ui/page-header";
import { todayRo } from "@/lib/agenda";
import { requireOrg } from "@/lib/auth";
import { findDomain, getAllDomains, matchesDomain } from "@/lib/domenii";
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
        <Link href={`/teren/oferta/${quote.id}`} className="btn btn-secondary min-h-11">
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
      <SubmitButton className="btn btn-primary min-h-11" pendingLabel="Se pregătește…">
        Ofertă din vizită
      </SubmitButton>
    </form>
  );
}

export default async function VizitaPage(props: PageProps<"/teren/vizita/[id]">) {
  const { id } = await props.params;
  const { orgId, organization } = await requireOrg();

  const supabase = await createClient();
  const [{ data: visitRow }, domains, { data: pumpRows }, { data: quoteRow }] = await Promise.all([
    supabase
      .from("visits")
      .select("*, clients(id, name, city, domain, contact_person, phone, cui, email)")
      .eq("id", id)
      .maybeSingle(),
    getAllDomains(orgId),
    supabase
      .from("catalog_items")
      .select("sku, name, category, tech_type, unit_price, price_on_request, description, materials")
      .eq("org_id", orgId)
      .not("sku", "is", null)
      .order("name"),
    supabase.from("quotes").select("id, number").eq("visit_id", id).is("archived_at", null).limit(1).maybeSingle(),
  ]);

  if (!visitRow) notFound();

  const visit = visitRow as Visit & {
    clients: {
      id: string;
      name: string;
      city: string | null;
      domain: string | null;
      contact_person: string | null;
      phone: string | null;
      cui: string | null;
      email: string | null;
    } | null;
  };

  // Domeniul firmei hotărăște ce se întreabă, în ce unitate se socotește și ce
  // pompe au rost să fie discutate.
  const domain = findDomain(domains, visit.clients?.domain ?? null);
  const sections = await getQuestionCatalogue(orgId, domain);

  const allPumps = (pumpRows ?? []) as (PumpOption & {
    tech_type: string | null;
    description: string | null;
    materials: { certain?: string[]; equivalent?: string[] } | null;
  })[];
  const pumps = allPumps.filter((p) => matchesDomain(domain, p));
  const suggestions = buildMaterialSuggestions(pumps);

  return (
    <div>
      <PageHeader
        back={
          visit.clients
            ? { href: `/teren/firma/${visit.clients.id}`, label: "Fișa firmei" }
            : { href: "/teren/firme", label: "Firme" }
        }
        title={visit.clients?.name ?? "Vizită"}
        description={
          <>
            <p>{[visit.clients?.city, domain?.label].filter(Boolean).join(" · ")}</p>
            {visit.clients?.contact_person || visit.clients?.phone ? (
              <p>{[visit.clients.contact_person, visit.clients.phone].filter(Boolean).join(" · ")}</p>
            ) : null}
          </>
        }
        actions={
          <ActionMenu label="Acțiuni pentru vizită">
            {visit.clients ? (
              <Link href={`/teren/firma/${visit.clients.id}?date=1`} className="menu-item" role="menuitem">
                Datele firmei
              </Link>
            ) : null}
            <form action={deleteVisit}>
              <input type="hidden" name="visit_id" value={visit.id} />
              <input type="hidden" name="client_id" value={visit.client_id} />
              <SubmitButton
                className="menu-item menu-item-danger btn-danger-ghost"
                pendingLabel="Se șterge…"
                confirmLabel="Da, șterge"
                confirm="Ștergi vizita? Ce ai completat se pierde."
              >
                Șterge vizita
              </SubmitButton>
            </form>
          </ActionMenu>
        }
      />

      {visit.clients && (!visit.clients.contact_person || !visit.clients.cui || !visit.clients.email) ? (
        <Link
          href={`/teren/firma/${visit.clients.id}?date=1`}
          className="mt-1 inline-block text-xs text-brand-700 hover:underline"
        >
          Completează datele firmei (persoană de contact, CUI, email…) →
        </Link>
      ) : null}

      <p className="hint my-3">
        Totul se salvează singur. Obligatoriu e doar pasul următor, cu data lui, ca să poți
        încheia vizita. Prima secțiune se completează în 20 de secunde; restul, în mașină.
      </p>

      <QuoteBridge visitId={visit.id} models={visit.pump_skus?.length ?? 0} quote={quoteRow} />

      <VisitForm
        visitId={visit.id}
        sections={sections}
        pumps={pumps}
        suggestions={suggestions}
        assumptions={{
          // Randamentul e al domeniului: la marcaje mecanizarea schimbă ordinul
          // de mărime, la atelierul auto abia dublează.
          productivityFactor: domain?.productivity_factor ?? Number(organization.productivity_factor ?? 2.5),
          workingDaysPerMonth: Number(organization.working_days_per_month ?? 21),
          unitShort: domain?.unit_short ?? "mp",
          unitLabel: domain?.unit_label ?? "metri pătrați",
        }}
        today={todayRo()}
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
