import Link from "next/link";
import { notFound } from "next/navigation";

import { startVisit, updateCompany } from "@/app/teren/actions";
import { CompanyFields } from "@/app/teren/company-fields";
import { SubmitButton } from "@/components/submit-button";
import { requireOrg } from "@/lib/auth";
import { findDomain, getAllDomains } from "@/lib/domenii";
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
  const { orgId, organization } = await requireOrg();

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
      <Link href="/teren/firme" className="text-sm text-brand-700 hover:underline">
        ← Firme
      </Link>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{state.name}</h1>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            state.focus === "urmareste"
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-neutral-200 bg-neutral-100 text-neutral-700"
          }`}
        >
          {FOCUS_LABELS[state.focus]}
        </span>
      </div>

      <p className="text-sm text-neutral-500">
        {[state.city, domain?.label, tradeLabel(state.trade_type)].filter(Boolean).join(" · ")}
      </p>
      <p className="text-sm text-neutral-500">
        {lastVisitLabel(state.last_visit)} · {state.visit_count}{" "}
        {state.visit_count === 1 ? "vizită" : "vizite"}
      </p>

      {state.phone ? (
        <a href={`tel:${state.phone}`} className="btn btn-secondary mt-3 w-full">
          Sună {state.phone}
        </a>
      ) : null}

      {typeof eroare === "string" && eroare ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
            <SubmitButton className="btn btn-primary w-full">Salvează datele</SubmitButton>
          </form>
        </details>
      </div>

      <form action={startVisit} className="mt-2">
        <input type="hidden" name="client_id" value={state.client_id} />
        <SubmitButton className="btn btn-primary w-full" pendingLabel="Se deschide…">
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

      <h2 className="mt-5 mb-1 text-base font-semibold">Istoricul vizitelor</h2>
      {visits.length === 0 ? (
        <p className="card p-3 text-sm text-neutral-500">Încă nicio vizită înregistrată.</p>
      ) : (
        <ul className="space-y-2">
          {visits.map((v) => {
            const scrise = Object.entries(v.notes ?? {}).filter(([, t]) => t?.trim());
            return (
              <li key={v.id} className="card p-3">
                <Link href={`/teren/vizita/${v.id}`} className="block">
                  <div className="flex items-center gap-2">
                    <b className="text-sm">{formatDate(v.visit_date)}</b>
                    <span className="flex-1" />
                    <span className="text-xs text-brand-700">deschide →</span>
                  </div>
                  {v.answers?.interes ? (
                    <p className="mt-1 text-sm">
                      Interes: {optionLabel(sections, "interes", String(v.answers.interes))}
                    </p>
                  ) : null}
                  {v.pump_skus?.length ? (
                    <p className="mt-1 text-xs text-neutral-500">
                      Modele discutate: {v.pump_skus.join(", ")}
                    </p>
                  ) : null}
                  {scrise.map(([gid, text]) => (
                    <p key={gid} className="mt-1 border-l-2 border-neutral-200 pl-2 text-xs text-neutral-700">
                      <span className="text-neutral-500">
                        {allGroups.find((g) => g.id === gid)?.label ?? gid}:{" "}
                      </span>
                      {text}
                    </p>
                  ))}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
