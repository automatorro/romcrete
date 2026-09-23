import Link from "next/link";

import { BarList, Funnel, StatTile, WorkModeShare } from "@/app/(app)/raport/charts";
import { requireOrg } from "@/lib/auth";
import { buildReport, type Period } from "@/lib/raport";
import { formatDate, formatMoney } from "@/lib/totals";
import { FOCUS_EXPLAIN, FOCUS_LABELS, type Focus } from "@/lib/teren";

export const metadata = { title: "Raport" };

const PERIOADE: [Period, string][] = [
  ["7", "7 zile"],
  ["30", "30 zile"],
  ["all", "Tot"],
];

/** Granularitatea foii „Evoluție” din exportul Excel. */
const GRANULARITATI: [string, string][] = [
  ["zi", "zilnic"],
  ["saptamana", "săptămânal"],
  ["luna", "lunar"],
];

export default async function RaportPage(props: PageProps<"/raport">) {
  const { orgId } = await requireOrg();
  const { per, ag, gran } = await props.searchParams;

  const period: Period = per === "7" || per === "all" ? per : "30";
  const agent = typeof ag === "string" ? ag : "";
  const granularitate =
    gran === "zi" || gran === "luna" ? gran : "saptamana";

  const r = await buildReport(orgId, period, agent);
  const agentName = (id: string) =>
    r.members.find((m) => m.user_id === id)?.full_name ?? "Agent fără nume";

  const chipHref = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ per: period, ag: agent, gran: granularitate, ...patch }))
      if (v) p.set(k, v);
    return `/raport?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Raport de teren</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {period === "all" ? "Toată perioada" : `Ultimele ${period} zile`}
          {agent ? ` · ${agentName(agent)}` : " · toți agenții"}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {PERIOADE.map(([v, l]) => (
          <Link key={v} href={chipHref({ per: v })} className={`chip chip-s ${period === v ? "chip-on" : ""}`}>
            {l}
          </Link>
        ))}
        <span className="mx-2 h-5 w-px bg-neutral-200" />
        <Link href={chipHref({ ag: null })} className={`chip chip-s ${agent ? "" : "chip-on"}`}>
          Toți agenții
        </Link>
        {r.members.map((m) => (
          <Link
            key={m.user_id}
            href={chipHref({ ag: m.user_id })}
            className={`chip chip-s ${agent === m.user_id ? "chip-on" : ""}`}
          >
            {m.full_name ?? "Fără nume"}
          </Link>
        ))}
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Vizite" value={String(r.visits.length)} />
        <StatTile label="Firme vizitate" value={String(r.clientCount)} />
        <StatTile label="Oferte din vizite" value={String(r.quotesFromVisits)} />
        <StatTile label="Valoare oferte" value={formatMoney(r.quotedValue)} hint="cu TVA" />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-base font-semibold">De la vizită la client</h2>
        <Funnel
          steps={[
            { label: "Vizite", value: r.visits.length },
            { label: "Oferte emise", value: r.quotesFromVisits },
            { label: "Oferte acceptate", value: r.acceptedQuotes },
          ]}
        />
      </section>

      <section className="card p-4">
        <h2 className="text-base font-semibold">Ce e de făcut cu firmele</h2>
        <p className="mt-0.5 mb-3 text-sm text-neutral-500">
          Două axe: cât vrea și cât poate. O firmă entuziasmată fără bani și fără curent pe
          șantier nu e o vânzare aproape de finalizare, e un blocaj de rezolvat.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["urmareste", "deblocheaza", "educa", "lasa"] as Focus[]).map((f) => (
            <div
              key={f}
              className={`rounded-xl border p-3 ${
                f === "urmareste" ? "border-brand-600 bg-brand-50" : "border-neutral-200"
              }`}
            >
              <p className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">{r.focusCounts[f]}</span>
                <span className="font-medium">{FOCUS_LABELS[f]}</span>
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">{FOCUS_EXPLAIN[f]}</p>
            </div>
          ))}
        </div>
        {r.focusCounts.necunoscut > 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            {r.focusCounts.necunoscut}{" "}
            {r.focusCounts.necunoscut === 1 ? "firmă nu are" : "firme nu au"} destule răspunsuri
            cât să poată fi încadrate. Sunt vizitele de completat la următoarea trecere.
          </p>
        ) : null}
      </section>

      {r.blockers.length ? (
        <section className="card p-4">
          <h2 className="mb-1 text-base font-semibold">Ce le stă în cale</h2>
          <p className="mb-3 text-sm text-neutral-500">
            Firmele care vor, dar nu pot încă. Fiecare blocaj are o soluție comercială:
            leasing, generator, sau un argument care nu depinde de volum.
          </p>
          <BarList rows={r.blockers} />
        </section>
      ) : null}

      <section className="card p-4">
        <h2 className="mb-3 text-base font-semibold">Cum lucrează piața</h2>
        <WorkModeShare counts={r.workModes} />
        <p className="mt-2 text-xs text-neutral-500">
          Fiecare firmă se numără o dată, după ultima vizită în care s-a notat.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 text-base font-semibold">Ce au împotriva mecanizării</h2>
          <BarList rows={r.countBy("obiectii")} />
        </section>
        <section className="card p-4">
          <h2 className="mb-3 text-base font-semibold">Ce i-ar atrage</h2>
          <BarList rows={r.countBy("atragere")} />
        </section>
        <section className="card p-4">
          <h2 className="mb-3 text-base font-semibold">De ce lucrează manual</h2>
          <BarList rows={r.countBy("dece")} />
        </section>
        <section className="card p-4">
          <h2 className="mb-3 text-base font-semibold">Modele discutate</h2>
          <BarList rows={r.models} limit={8} empty="Încă nu s-a discutat niciun model." />
        </section>
        <section className="card p-4">
          <h2 className="mb-1 text-base font-semibold">Ce utilaj au acum</h2>
          <p className="mb-3 text-xs text-neutral-500">
            Cei cu utilaj mai vechi de 5 ani sunt cei mai apropiați de o înlocuire.
          </p>
          <BarList rows={r.countBy("utilaj")} />
        </section>
        <section className="card p-4">
          <h2 className="mb-1 text-base font-semibold">Găsesc oameni?</h2>
          <p className="mb-3 text-xs text-neutral-500">
            Criza de personal e argumentul de mecanizare care nu depinde de volumul de lucrări.
          </p>
          <BarList rows={r.countBy("oameni")} />
        </section>
        <section className="card p-4">
          <h2 className="mb-3 text-base font-semibold">Cum ar plăti</h2>
          <BarList rows={r.countBy("plata")} />
        </section>
        <section className="card p-4">
          <h2 className="mb-1 text-base font-semibold">Condiții pe șantier</h2>
          <p className="mb-3 text-xs text-neutral-500">
            „Șantiere fără curent” înseamnă vânzare de generator înainte de pompă.
          </p>
          <BarList rows={r.countBy("santier")} />
        </section>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-base font-semibold">Activitatea agenților</h2>
        {r.perAgent.length === 0 ? (
          <p className="text-sm text-neutral-500">Nicio vizită în perioada aleasă.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="py-2">Agent</th>
                <th className="py-2 text-right">Vizite</th>
                <th className="py-2 text-right">Firme</th>
                <th className="py-2 text-right">Ultima vizită</th>
              </tr>
            </thead>
            <tbody>
              {r.perAgent.map((a) => (
                <tr key={a.agentId} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2">{agentName(a.agentId)}</td>
                  <td className="py-2 text-right tabular-nums">{a.visits}</td>
                  <td className="py-2 text-right tabular-nums">{a.clients}</td>
                  <td className="py-2 text-right text-neutral-500">{formatDate(a.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {r.escalations.length ? (
        <section className="card p-4">
          <h2 className="mb-2 text-base font-semibold">Întrebări tehnice pentru owner</h2>
          <ul className="space-y-2 text-sm">
            {r.escalations.map((e) => (
              <li key={e.id} className="border-l-2 border-brand-200 pl-3">
                <b>{e.firma}</b> <span className="text-neutral-500">· {formatDate(e.date)}</span>
                <p className="text-neutral-700">{e.items.join(", ")}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card p-4">
        <h2 className="mb-2 text-base font-semibold">Ce au spus, cu cuvintele lor</h2>
        {r.freeNotes.length === 0 ? (
          <p className="text-sm text-neutral-500">Încă nicio notă liberă.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {r.freeNotes.map((n, i) => (
              <li key={i} className="border-l-2 border-neutral-200 pl-3">
                <p className="text-xs text-neutral-500">
                  {n.firma} · {formatDate(n.date)} · {n.group}
                </p>
                <p>{n.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h2 className="text-base font-semibold">Export Excel — activitatea agenților</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Șapte foi: sumar cu comparație față de perioada anterioară, defalcare pe agent,
          evoluție în timp, plus vizitele, firmele, ofertele și răspunsurile din piață, brute,
          pentru pivoturi proprii.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-neutral-700">Evoluția, defalcată</span>
          {GRANULARITATI.map(([v, l]) => (
            <Link
              key={v}
              href={chipHref({ gran: v })}
              className={`chip chip-s ${granularitate === v ? "chip-on" : ""}`}
            >
              {l}
            </Link>
          ))}
        </div>

        <a
          href={`/raport/export?per=${period}&gran=${granularitate}${agent ? `&ag=${agent}` : ""}`}
          className="btn btn-primary mt-3"
        >
          Descarcă Excel
        </a>
      </section>
    </div>
  );
}
