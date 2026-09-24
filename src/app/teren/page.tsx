import Link from "next/link";

import { markStepDone } from "@/app/teren/actions";
import { SubmitButton } from "@/components/submit-button";
import { requireOrg } from "@/lib/auth";
import { getQuestionCatalogue, optionLabel } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/totals";
import { lastVisitLabel, type ClientState } from "@/lib/teren";

export const metadata = { title: "Azi" };

/** Luni–vineri din săptămâna curentă, până azi inclusiv: câte zile s-au consumat din țintă. */
function workingDaysSoFar(today: Date) {
  const dow = (today.getDay() + 6) % 7; // 0 = luni
  let n = 0;
  for (let i = 0; i <= Math.min(dow, 4); i++) n++;
  return n;
}

function Progress({
  label,
  done,
  target,
  hint,
}: {
  label: string;
  done: number;
  target: number;
  hint: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0;
  const atins = target > 0 && done >= target;

  return (
    <div>
      <div className="flex items-baseline gap-2 text-sm">
        <span className="text-neutral-700">{label}</span>
        <span className="flex-1" />
        <span className="tabular-nums">
          <b className="text-base">{done}</b>
          <span className="text-neutral-500"> / {target}</span>
        </span>
      </div>
      <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-neutral-100">
        <span
          className={`block h-full rounded-full ${atins ? "bg-[var(--color-ok)]" : "bg-brand-600"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

export default async function AziPage() {
  const { orgId, organization, user } = await requireOrg();
  const supabase = await createClient();
  const sections = await getQuestionCatalogue(orgId);

  const now = new Date();
  const azi = now.toISOString().slice(0, 10);
  const inceputLuna = `${azi.slice(0, 7)}-01`;
  const luni = new Date(now);
  luni.setDate(luni.getDate() - ((now.getDay() + 6) % 7));
  const inceputSaptamana = luni.toISOString().slice(0, 10);

  const [{ data: membership }, { count: viziteAzi }, { count: viziteSapt }, { count: oferteLuna }, { data: stateRows }] =
    await Promise.all([
      supabase
        .from("memberships")
        .select("target_visits_per_day, target_quotes_per_month")
        .eq("user_id", user.id)
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", user.id)
        .eq("visit_date", azi),
      supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", user.id)
        .gte("visit_date", inceputSaptamana),
      supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user.id)
        .gte("issue_date", inceputLuna),
      supabase.from("client_state").select("*").eq("org_id", orgId),
    ]);

  // Ținta personală bate ținta firmei; null înseamnă „ca la toată lumea”.
  const tintaZi = membership?.target_visits_per_day ?? organization.target_visits_per_day ?? 5;
  const tintaLuna = membership?.target_quotes_per_month ?? organization.target_quotes_per_month ?? 10;

  const rows = (stateRows ?? []) as ClientState[];

  const deFacut = rows
    .filter((r) => r.next_step_date && r.next_step_date <= azi)
    .sort((a, b) => (a.next_step_date ?? "").localeCompare(b.next_step_date ?? ""));

  const deReluat = rows
    .filter((r) => r.needs_recontact)
    .sort((a, b) => (a.recontact_due ?? "").localeCompare(b.recontact_due ?? ""))
    .slice(0, 12);

  const zone = new Map<string, { total: number; urgente: number }>();
  for (const r of rows) {
    const oras = r.city?.trim() || "Fără localitate";
    const z = zone.get(oras) ?? { total: 0, urgente: 0 };
    z.total++;
    if (r.next_step_late || r.needs_recontact) z.urgente++;
    zone.set(oras, z);
  }
  const zoneSortate = [...zone.entries()].sort((a, b) => b[1].urgente - a[1].urgente || b[1].total - a[1].total);

  const zileLucrate = workingDaysSoFar(now);

  return (
    <div>
      <h1 className="text-xl font-semibold">Azi</h1>
      <p className="mt-0.5 text-sm text-neutral-500">
        {new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long" }).format(now)}
      </p>

      <section className="card mt-3 space-y-4 p-4">
        <Progress
          label="Vizite azi"
          done={viziteAzi ?? 0}
          target={tintaZi}
          hint={`Săptămâna asta: ${viziteSapt ?? 0} din ${tintaZi * zileLucrate} până acum.`}
        />
        <Progress
          label="Oferte luna asta"
          done={oferteLuna ?? 0}
          target={tintaLuna}
          hint="Se numără ofertele emise de tine, indiferent din ce vizită pornesc."
        />
      </section>

      <h2 className="mt-5 mb-1 text-base font-semibold">
        De făcut {deFacut.length ? `· ${deFacut.length}` : ""}
      </h2>
      {deFacut.length === 0 ? (
        <p className="card p-3 text-sm text-neutral-500">
          Niciun pas scadent. Dacă ai timp, ia o firmă din „De reluat”.
        </p>
      ) : (
        <ul className="space-y-2">
          {deFacut.map((r) => (
            <li key={r.client_id} className="card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/teren/firma/${r.client_id}`} className="font-medium">
                  {r.name}
                </Link>
                <span className="text-sm text-neutral-500">
                  {[r.city, r.contact_person].filter(Boolean).join(" · ")}
                </span>
                <span className="flex-1" />
                {r.next_step_late ? (
                  <span className="text-xs font-semibold text-[var(--color-bad)]">
                    restant din {formatDate(r.next_step_date)}
                  </span>
                ) : (
                  <span className="text-xs text-neutral-500">azi</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span>
                  →{" "}
                  {r.next_step
                    ? optionLabel(sections, "urmator", r.next_step)
                    : "pas următor"}
                </span>
                <span className="flex-1" />
                {r.phone ? (
                  <a href={`tel:${r.phone}`} className="btn btn-secondary text-xs">
                    Sună
                  </a>
                ) : null}
                <form action={markStepDone}>
                  <input type="hidden" name="visit_id" value={r.next_step_visit_id ?? ""} />
                  <SubmitButton className="btn btn-secondary text-xs" pendingLabel="…">
                    ✓ făcut
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-5 mb-1 text-base font-semibold">
        De reluat {deReluat.length ? `· ${deReluat.length}` : ""}
      </h2>
      <p className="mb-2 text-xs text-neutral-500">
        Firme fără pas următor, la care n-ai mai trecut de mult. Cele calde revin după{" "}
        {organization.recontact_days_warm ?? 7} zile, restul după {organization.recontact_days_cold ?? 30}.
      </p>
      {deReluat.length === 0 ? (
        <p className="card p-3 text-sm text-neutral-500">Nicio firmă uitată. Bine.</p>
      ) : (
        <ul className="space-y-2">
          {deReluat.map((r) => (
            <li key={r.client_id} className="card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/teren/firma/${r.client_id}`} className="font-medium">
                  {r.name}
                </Link>
                <span className="text-sm text-neutral-500">
                  {[r.city, r.contact_person].filter(Boolean).join(" · ")}
                </span>
                <span className="flex-1" />
                {r.is_warm ? (
                  <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                    caldă
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">{lastVisitLabel(r.last_visit)}</p>
            </li>
          ))}
        </ul>
      )}

      {zoneSortate.length > 1 ? (
        <>
          <h2 className="mt-5 mb-1 text-base font-semibold">Pe zone</h2>
          <p className="mb-2 text-xs text-neutral-500">
            Câte firme ai în fiecare localitate și câte cer atenție. Util când îți faci ziua.
          </p>
          <div className="flex flex-wrap gap-2">
            {zoneSortate.map(([oras, z]) => (
              <Link
                key={oras}
                href={`/teren/firme?city=${encodeURIComponent(oras === "Fără localitate" ? "" : oras)}`}
                className="chip chip-s"
              >
                {oras} · {z.total}
                {z.urgente ? (
                  <span className="ml-1 font-semibold text-[var(--color-bad)]">{z.urgente}</span>
                ) : null}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
