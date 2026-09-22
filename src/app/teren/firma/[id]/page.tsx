import Link from "next/link";
import { notFound } from "next/navigation";

import { startVisit } from "@/app/teren/actions";
import { SubmitButton } from "@/components/submit-button";
import { requireOrg } from "@/lib/auth";
import { getQuestionCatalogue, optionLabel } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/totals";
import { gaps, lastVisitLabel, tradeLabel, type ClientState, type Visit } from "@/lib/teren";

export const metadata = { title: "Fișa firmei" };

export default async function FirmaPage(props: PageProps<"/teren/firma/[id]">) {
  const { id } = await props.params;
  const { orgId } = await requireOrg();

  const supabase = await createClient();
  const [{ data: stateRow }, { data: visitRows }, sections] = await Promise.all([
    supabase.from("client_state").select("*").eq("client_id", id).maybeSingle(),
    supabase.from("visits").select("*").eq("client_id", id).order("visit_date", { ascending: false }),
    getQuestionCatalogue(orgId),
  ]);

  if (!stateRow) notFound();

  const state = stateRow as ClientState;
  const visits = (visitRows ?? []) as Visit[];
  const lipsuri = gaps(state.answers);
  const allGroups = sections.flatMap((s) => s.groups);

  return (
    <div>
      <Link href="/teren" className="text-sm text-brand-700 hover:underline">
        ← Firme
      </Link>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{state.name}</h1>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${
            state.priority === "A"
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-neutral-200 bg-neutral-100 text-neutral-700"
          }`}
        >
          prioritate {state.priority}
        </span>
      </div>

      <p className="text-sm text-neutral-500">
        {[state.city, tradeLabel(state.trade_type)].filter(Boolean).join(" · ")}
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

      <form action={startVisit} className="mt-2">
        <input type="hidden" name="client_id" value={state.client_id} />
        <SubmitButton className="btn btn-primary w-full" pendingLabel="Se deschide…">
          ＋ Vizită nouă aici
        </SubmitButton>
      </form>

      {state.next_step ? (
        <div className={`card mt-3 p-3 text-sm ${state.next_step_late ? "border-[var(--color-bad)]" : ""}`}>
          <b>Pasul următor:</b> {optionLabel(sections, "urmator", state.next_step)}
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
