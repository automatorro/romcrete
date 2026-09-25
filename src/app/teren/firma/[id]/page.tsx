import { notFound } from "next/navigation";

import { startVisit, updateCompany } from "@/app/teren/actions";
import { CompanyFields } from "@/app/teren/company-fields";
import { ClientHistory } from "@/components/client-history";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { todayRo } from "@/lib/agenda";
import { requireOrg } from "@/lib/auth";
import { findDomain, getAllDomains } from "@/lib/domenii";
import { getClientHistory } from "@/lib/istoric-firma";
import { getQuestionCatalogue, optionLabel } from "@/lib/questions";
import { computePayback, demandFrom } from "@/lib/amortizare";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatNumber } from "@/lib/totals";
import {
  FEASIBILITY_LABELS, FOCUS_EXPLAIN, FOCUS_LABELS,
  gaps, lastVisitLabel, tradeLabel, type ClientState, type Visit,
} from "@/lib/teren";

export const metadata = { title: "Fișa firmei" };

export default async function FirmaPage(props: PageProps<"/teren/firma/[id]">) {
  const { id } = await props.params;
  const { eroare, date } = await props.searchParams;
  const { orgId, organization, user, role } = await requireOrg();

  const supabase = await createClient();
  const [{ data: stateRow }, { data: visitRows }, domains] = await Promise.all([
    supabase.from("client_state").select("*").eq("client_id", id).maybeSingle(),
    supabase.from("visits").select("*").eq("client_id", id).order("visit_date", { ascending: false }),
    getAllDomains(orgId),
  ]);

  if (!stateRow) notFound();

  const state = stateRow as ClientState;
  const visits = (visitRows ?? []) as Visit[];
  const domain = findDomain(domains, state.domain);
  const sections = await getQuestionCatalogue(orgId, domain);

  // Amortizarea, pe starea adunată din toate vizitele, cu cel mai ieftin model discutat.
  const skuri = [...new Set(visits.flatMap((v) => v.pump_skus ?? []))];
  const { data: modele } = skuri.length
    ? await supabase.from("catalog_items").select("unit_price").eq("org_id", orgId).in("sku", skuri)
    : { data: [] };
  const preturi = (modele ?? []).map((m) => Number(m.unit_price)).filter((p) => p > 0);

  const valoare = (groupId: string, optionId: unknown) => {
    if (typeof optionId !== "string" || !optionId) return null;
    const g = sections.flatMap((s) => s.groups).find((x) => x.id === groupId);
    return g?.options.find((o) => o.id === optionId)?.value ?? null;
  };

  const payback = computePayback({
    unitsPerDay: valoare("supr", state.answers.supr),
    leiPerUnit: valoare("manopera", state.answers.manopera),
    productivityFactor: domain?.productivity_factor ?? Number(organization.productivity_factor ?? 2.5),
    workingDaysPerMonth: Number(organization.working_days_per_month ?? 21),
    pumpPrice: preturi.length ? Math.min(...preturi) : null,
    hasDemand: demandFrom(state.answers.refuzat),
  });
  const lipsuri = gaps(state.answers, domain?.unit_short);
  const allGroups = sections.flatMap((s) => s.groups);

  const history = await getClientHistory(
    state.client_id,
    orgId,
    sections,
    { userId: user.id, isAdmin: role !== "agent" },
    { visitHref: (v) => `/teren/vizita/${v}`, quoteHref: (q) => `/teren/oferta/${q}` },
  );

  const adresa = [state.address, state.city, state.county].filter(Boolean).join(", ");
  const dateFirma = [
    { label: "Persoană de contact", value: state.contact_person },
    { label: "Telefon", value: state.phone, href: state.phone ? `tel:${state.phone}` : null },
    { label: "Email", value: state.email, href: state.email ? `mailto:${state.email}` : null, wide: true },
    { label: "CUI", value: state.cui },
    { label: "Nr. Reg. Com.", value: state.reg_com },
    { label: "Adresă", value: adresa || null, wide: true },
  ];
  const lipsesc = dateFirma.filter((d) => !d.value).map((d) => d.label.toLowerCase());

  return (
    <div>
      <PageHeader
        back={{ href: "/teren/firme", label: "Firme" }}
        title={state.name}
        badge={
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-normal ${
              state.focus === "urmareste"
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-neutral-200 bg-neutral-100 text-neutral-700"
            }`}
          >
            {FOCUS_LABELS[state.focus]}
          </span>
        }
        description={
          <>
            <p>{[state.city, domain?.label, tradeLabel(state.trade_type)].filter(Boolean).join(" · ")}</p>
            <p>
              {lastVisitLabel(state.last_visit)} · {state.visit_count}{" "}
              {state.visit_count === 1 ? "vizită" : "vizite"}
            </p>
          </>
        }
      />

      {state.phone || state.email ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {state.phone ? (
            <a
              href={`tel:${state.phone}`}
              className={`btn btn-secondary btn-lg ${state.email ? "" : "col-span-2"}`}
            >
              Sună
            </a>
          ) : null}
          {state.email ? (
            // Se deschide programul de email al calculatorului sau al telefonului (Outlook).
            <a
              href={`mailto:${state.email}`}
              className={`btn btn-secondary btn-lg ${state.phone ? "" : "col-span-2"}`}
            >
              Email
            </a>
          ) : null}
        </div>
      ) : null}

      {typeof eroare === "string" && eroare ? (
        <p role="alert" className="notice-error mt-3">
          {eroare}
        </p>
      ) : null}

      <div className="card mt-3 p-3.5">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {dateFirma
            .filter((d) => d.value)
            .map((d) => (
              <div key={d.label} className={"wide" in d ? "col-span-2" : undefined}>
                <dt className="text-xs text-neutral-500">{d.label}</dt>
                <dd className="break-words">
                  {d.href ? (
                    <a href={d.href} className="text-brand-700 hover:underline">
                      {d.value}
                    </a>
                  ) : (
                    d.value
                  )}
                </dd>
              </div>
            ))}
        </dl>
        {lipsesc.length ? (
          <p className="mt-2 text-xs text-neutral-500">Lipsesc: {lipsesc.join(", ")}.</p>
        ) : null}

        <details className="mt-2" open={date === "1"}>
          <summary className="cursor-pointer text-sm font-medium text-brand-700">
            {lipsesc.length ? "Completează datele firmei" : "Modifică datele firmei"}
          </summary>
          <form action={updateCompany} className="mt-3 space-y-3 border-t border-neutral-200 pt-3">
            <input type="hidden" name="client_id" value={state.client_id} />
            <CompanyFields defaults={state} idPrefix="firma-" />
            <SubmitButton className="btn btn-ok btn-lg w-full">Salvează datele</SubmitButton>
          </form>
        </details>
      </div>

      <form action={startVisit} className="mt-2">
        <input type="hidden" name="client_id" value={state.client_id} />
        <SubmitButton className="btn btn-primary btn-lg w-full" pendingLabel="Se deschide…">
          ＋ Vizită nouă aici
        </SubmitButton>
      </form>

      <p className="hint mt-3">
        <b>{FOCUS_LABELS[state.focus]}.</b> {FOCUS_EXPLAIN[state.focus]}
        <span className="mt-1 block text-xs text-neutral-500">
          Apetit {state.priority} · {FEASIBILITY_LABELS[state.feasibility]}
        </span>
      </p>

      {payback ? (
        <div className="card mt-3 border-brand-200 p-3 text-sm">
          <b>Calculul pentru el:</b> {formatNumber(payback.extraUnitsPerDay)}{" "}
          {domain?.unit_short ?? "mp"} în plus pe zi ={" "}
          {formatMoney(payback.extraLeiPerMonth)} pe lună
          {payback.months !== null ? (
            <> · pompa se plătește în {formatNumber(payback.months)} luni</>
          ) : null}
          {payback.demandWarning ? (
            <span className="mt-1 block text-xs text-neutral-500">
              A spus că nu refuză lucrări — calculul presupune o cerere pe care încă n-o are.
            </span>
          ) : null}
        </div>
      ) : null}

      {state.next_step || state.next_step_date ? (
        <div className={`card mt-3 p-3 text-sm ${state.next_step_late ? "border-[var(--color-bad)]" : ""}`}>
          <b>Pasul următor:</b>{" "}
          {state.next_step ? optionLabel(sections, "urmator", state.next_step) : "nestabilit"}
          {state.next_step_date ? ` · ${formatDate(state.next_step_date)}` : ""}
          {state.next_step_late ? (
            <span className="ml-1 font-semibold text-[var(--color-bad)]">restant</span>
          ) : null}
        </div>
      ) : null}

      {lipsuri.length ? (
        <p className="hint mt-3">
          <b>De aflat la vizita următoare:</b> {lipsuri.join(", ")}.
        </p>
      ) : null}

      {state.pending_escalations > 0 ? (
        <p className="hint mt-2">
          {state.pending_escalations}{" "}
          {state.pending_escalations === 1 ? "întrebare tehnică" : "întrebări tehnice"} în așteptare
          pentru owner.
        </p>
      ) : null}

      <h2 className="mt-5 mb-1 text-base font-semibold">Ce știm despre firmă</h2>
      <div className="card p-3.5">
        <dl className="space-y-2 text-sm">
          {allGroups
            .filter((g) => g.kind === "single" || g.kind === "multi")
            .map((g) => {
              const v = state.answers[g.id];
              const text = Array.isArray(v)
                ? v.map((x) => optionLabel(sections, g.id, x)).join(", ")
                : v
                  ? optionLabel(sections, g.id, String(v))
                  : "";
              if (!text) return null;
              return (
                <div key={g.id}>
                  <dt className="text-xs text-neutral-500">{g.label}</dt>
                  <dd>{text}</dd>
                </div>
              );
            })}
        </dl>
      </div>

      <h2 className="mt-5 mb-1 text-base font-semibold">Istoric</h2>
      <p className="mb-2 text-xs text-neutral-500">
        Vizite, telefoane, emailuri, oferte și pași mutați, cel mai nou sus.
      </p>
      <ClientHistory clientId={state.client_id} items={history} today={todayRo()} />
    </div>
  );
}
