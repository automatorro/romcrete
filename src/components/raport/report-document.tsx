import { BarList, Funnel } from "@/app/(app)/raport/charts";
import { Logo } from "@/components/logo";
import { StatusBadge } from "@/components/status-badge";
import type { Kpi, ReportSection, ReportSnapshot } from "@/lib/raport-perioada";
import type { Highlight, Reflection } from "@/lib/raport-perioada";
import {
  ALL_SECTIONS,
  hasReflection,
  MARKET_MIN_BASE,
  PRIMARY_KPIS,
  REFLECTION_QUESTIONS,
  SCOPE_LABELS,
  SECTION_LABELS,
  scopeOf,
} from "@/lib/raport-perioada";
import { lossReasonLabel } from "@/lib/pierderi";
import { formatDate, formatMoney } from "@/lib/totals";
import type { QuoteStatus } from "@/lib/types";

const intFmt = new Intl.NumberFormat("ro-RO");
const pctFmt = new Intl.NumberFormat("ro-RO", { style: "percent", maximumFractionDigits: 0 });

function formatKpi(k: Pick<Kpi, "format">, value: number): string {
  if (k.format === "money") return formatMoney(value);
  if (k.format === "pct") return pctFmt.format(value);
  if (k.format === "dec") return value.toFixed(1).replace(".", ",");
  return intFmt.format(value);
}

/**
 * Comparația cu perioada anterioară, scrisă, nu colorată: săgeata și procentul
 * spun direcția, iar „mai bine / mai rău” se citește din context.
 */
function Delta({ k, prevLabel }: { k: Kpi; prevLabel: string }) {
  if (k.noCompare) return <span>starea de la data raportului</span>;
  if (k.format === "pct") {
    const diff = Math.round((k.value - k.prev) * 100);
    return (
      <span>
        {diff === 0 ? "= " : diff > 0 ? "▲ " : "▼ "}
        {diff === 0 ? "la fel" : `${Math.abs(diff)} pp`} față de {prevLabel}
      </span>
    );
  }
  if (k.prev === 0) {
    return <span>{k.value === 0 ? "la fel" : "nou"} față de {prevLabel}</span>;
  }
  const change = Math.round(((k.value - k.prev) / k.prev) * 100);
  return (
    <span>
      {change === 0 ? "= " : change > 0 ? "▲ " : "▼ "}
      {change === 0 ? "la fel" : `${Math.abs(change)}%`} față de {prevLabel} ({formatKpi(k, k.prev)})
    </span>
  );
}

function KpiTile({ k, prevLabel }: { k: Kpi; prevLabel: string }) {
  const pct = k.target ? Math.min(100, Math.round((k.value / k.target) * 100)) : null;
  return (
    <div className="rounded-xl border border-neutral-200 p-3 break-inside-avoid">
      <p className="text-xs text-neutral-500">{k.label}</p>
      {k.hint ? <p className="text-[11px] leading-snug text-neutral-500">{k.hint}</p> : null}
      <p className={`mt-0.5 font-semibold tabular-nums ${k.format === "money" ? "text-lg sm:text-xl" : "text-2xl"}`}>
        {formatKpi(k, k.value)}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">
        <Delta k={k} prevLabel={prevLabel} />
      </p>
      {k.target ? (
        <div className="mt-1.5">
          <span className="block h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <span className="block h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
          </span>
          <p className="mt-0.5 text-[11px] text-neutral-600">
            {Math.round((k.value / k.target) * 100)}% din ținta de {formatKpi(k, k.target)} {k.targetNote ?? "până azi"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Raportul, gata de citit și de tipărit. Aceeași componentă pe ecran, pe
 * telefon și în PDF; primește cifrele înghețate și textele scrise de om.
 */
export function ReportDocument({
  data,
  title,
  summary,
  sections,
  sectionNotes = {},
  reflection,
  author,
}: {
  data: ReportSnapshot;
  title: string;
  summary?: string | null;
  sections: ReportSection[];
  sectionNotes?: Partial<Record<ReportSection, string>>;
  /** Răspunsurile la cele patru întrebări; secțiunea lipsește cât sunt goale. */
  reflection?: Reflection | null;
  author?: string | null;
}) {
  const scope = scopeOf(data);
  const filters = [
    scope === "echipa" ? "Toți agenții" : (data.filters.agent ?? "Agent"),
    data.filters.domain ?? "Toate domeniile",
  ].join(" · ");
  // Numerotarea urmează ordinea fixă a secțiunilor, doar pentru cele alese.
  const shown = ALL_SECTIONS.filter(
    (id) => sections.includes(id) && (id !== "reflectie" || hasReflection(reflection)),
  );
  const at = (id: ReportSection) => ({ id, index: shown.indexOf(id) + 1, note: sectionNotes[id] });

  // Indicatorii mari ai tipului de raport; ceilalți, pe un rând dedesubt.
  const primaryKeys = PRIMARY_KPIS[data.type] ?? [];
  const primary = primaryKeys
    .map((key) => data.kpis.find((k) => k.key === key))
    .filter((k): k is Kpi => Boolean(k));
  const secondary = data.kpis.filter((k) => !primaryKeys.includes(k.key));
  const echipa = scope === "echipa";

  return (
    <article className="text-[13px] leading-snug text-neutral-900">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
        <div>
          <Logo className="mb-2 h-8 w-auto" />
          <p className="font-semibold">{data.orgName}</p>
        </div>
        <div className="sm:text-right print:text-right">
          <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
            {SCOPE_LABELS[scope]} {data.typeLabel}
          </p>
          <p className="text-base font-semibold">{data.label}</p>
          <p className="text-xs text-neutral-600">{filters}</p>
          <p className="text-xs text-neutral-500">
            Cifre la {formatDate(data.generatedAt)}{" "}
            {new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }).format(
              new Date(data.generatedAt),
            )}
            {author ? ` · ${author}` : ""}
          </p>
        </div>
      </header>

      <h1 className="mt-4 text-xl font-semibold tracking-tight">{title}</h1>
      {summary?.trim() ? (
        <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm whitespace-pre-line">
          {summary.trim()}
        </div>
      ) : null}

      <Section {...at("retine")}>
        <Highlights items={data.highlights} />
      </Section>

      <Section {...at("reflectie")}>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {REFLECTION_QUESTIONS.filter((q) => reflection?.[q.key]?.trim()).map((q) => (
            <div
              key={q.key}
              className={`break-inside-avoid ${q.key === "nevoie" ? "rounded-lg border-2 border-neutral-900 p-3 sm:col-span-2" : ""}`}
            >
              <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{q.label}</dt>
              <dd className="mt-0.5 text-sm whitespace-pre-line">{reflection?.[q.key]?.trim()}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section {...at("kpi")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(primary.length ? primary : data.kpis).map((k) => (
            <KpiTile key={k.key} k={k} prevLabel={data.prevLabel} />
          ))}
        </div>
        {primary.length && secondary.length ? (
          <p className="mt-2 text-xs text-neutral-600">
            <span className="text-neutral-500">Și: </span>
            {secondary.map((k, i) => (
              <span key={k.key} className="whitespace-nowrap">
                {i ? " · " : ""}
                {k.label} <b className="font-semibold tabular-nums text-neutral-900">{formatKpi(k, k.value)}</b>
              </span>
            ))}
          </p>
        ) : null}
      </Section>

      <Section {...at("agenti")}>
        {data.agents.length === 0 ? (
          <p className="text-sm text-neutral-500">Nicio vizită în perioadă.</p>
        ) : (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
                  <th className="py-1.5 pr-2">Agent</th>
                  <th className="py-1.5 pr-2 text-right">Vizite</th>
                  <th className="py-1.5 pr-2 text-right">Țintă</th>
                  <th className="py-1.5 pr-2 text-right">Firme noi</th>
                  <th className="py-1.5 pr-2 text-right">Tel.</th>
                  <th className="py-1.5 pr-2 text-right">Email</th>
                  <th className="py-1.5 pr-2 text-right">WA</th>
                  <th className="py-1.5 pr-2 text-right">Oferte</th>
                  <th className="py-1.5 pr-2 text-right">Valoare</th>
                  <th className="py-1.5 text-right">Accept.</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((a) => (
                  <tr key={a.agent} className="border-b border-neutral-100">
                    <td className="py-1.5 pr-2 font-medium">{a.agent}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{a.vizite}</td>
                    <td className="py-1.5 pr-2 text-right text-neutral-600 tabular-nums">
                      {a.tinta ? `${Math.round((a.vizite / a.tinta) * 100)}% din ${a.tinta}` : "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{a.firmeNoi}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{a.telefoane}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{a.emailuri}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{a.whatsapp ?? 0}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{a.oferte}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(a.valoare)}</td>
                    <td className="py-1.5 text-right tabular-nums">{a.acceptate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section {...at("tendinta")}>
        <Trend rows={data.trend} />
      </Section>

      <Section {...at("evolutie")}>
        <VisitsVsTarget rows={data.evolution} />
      </Section>

      <Section {...at("palnie")}>
        <Funnel
          steps={[
            { label: "Vizite", value: data.funnel.vizite },
            { label: "Cu pas următor stabilit", value: data.funnel.cuPas },
            { label: "Oferte din vizite", value: data.funnel.oferteDinVizite },
            { label: "Oferte acceptate", value: data.funnel.acceptate },
          ]}
        />
      </Section>

      <Section {...at("pierderi")}>
        <Losses losses={data.losses} echipa={echipa} />
      </Section>

      <Section {...at("asteptare")}>
        <PendingQuotes pending={data.pending} echipa={echipa} />
      </Section>

      <Section {...at("fereastra")}>
        {!data.opportunities ? (
          <p className="text-sm text-neutral-500">Raport salvat înainte de această secțiune.</p>
        ) : data.opportunities.count === 0 ? (
          <p className="text-sm text-neutral-500">
            Nicio firmă nu a spus că ar cumpăra curând. Întrebarea „Când ar cumpăra” din vizită hrănește această listă.
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-neutral-500">
              Firme care spun că ar cumpăra în cel mult 3 luni, sunt gata de cumpărare sau au un utilaj de peste 5 ani.
              Starea de la data raportului.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
                  <th className="py-1.5 pr-2">Firma</th>
                  <th className="py-1.5 pr-2">De ce acum</th>
                  <th className="py-1.5">Pasul următor</th>
                </tr>
              </thead>
              <tbody>
                {data.opportunities.rows.map((o, i) => (
                  <tr key={i} className="border-b border-neutral-100 align-top">
                    <td className="py-1.5 pr-2">
                      {o.client}
                      <span className="block text-xs text-neutral-500">
                        {[o.interest, echipa ? o.agent : null].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2">{o.reasons.join("; ")}</td>
                    <td className="py-1.5">
                      {o.nextStep ?? <span className="font-semibold text-[var(--color-warn)]">niciunul stabilit</span>}
                      {o.nextStepDate ? <span className="block text-xs text-neutral-500">{formatDate(o.nextStepDate)}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.opportunities.count > data.opportunities.rows.length ? (
              <p className="mt-1.5 text-xs text-neutral-500">
                Cele mai apropiate {data.opportunities.rows.length} din {data.opportunities.count}.
              </p>
            ) : null}
          </>
        )}
      </Section>

      <Section {...at("restante")}>
        {!data.overdue ? (
          <p className="text-sm text-neutral-500">Raport salvat înainte de lista restanțelor.</p>
        ) : data.overdue.count === 0 ? (
          <p className="text-sm text-neutral-500">Niciun pas restant la sfârșitul perioadei.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
                  <th className="py-1.5 pr-2">Firma</th>
                  <th className="py-1.5 pr-2">Pasul</th>
                  <th className="py-1.5 pr-2 whitespace-nowrap">Termen</th>
                  <th className="py-1.5 text-right whitespace-nowrap">Întârziere</th>
                </tr>
              </thead>
              <tbody>
                {data.overdue.rows.map((x, i) => (
                  <tr key={i} className="border-b border-neutral-100 align-top">
                    <td className="py-1.5 pr-2">
                      {x.client}
                      {echipa ? <span className="block text-xs text-neutral-500">{x.agent}</span> : null}
                    </td>
                    <td className="py-1.5 pr-2">{x.step ?? "—"}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(x.date)}</td>
                    <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{zile(x.zile)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.overdue.count > data.overdue.rows.length ? (
              <p className="mt-1.5 text-xs text-neutral-500">
                Cele mai vechi {data.overdue.rows.length} din {data.overdue.count}. Lista completă e în Excel, foaia „Firme”.
              </p>
            ) : null}
          </>
        )}
      </Section>

      <Section {...at("uitate")}>
        {!data.slipping ? (
          <p className="text-sm text-neutral-500">Raport salvat înainte de această secțiune.</p>
        ) : data.slipping.count === 0 ? (
          <p className="text-sm text-neutral-500">Toate firmele calde au fost contactate la timp sau au un pas stabilit.</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-neutral-500">
              Firme interesate, fără un pas stabilit, la care a trecut termenul de revenire din Setări. Starea de la data
              raportului.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
                  <th className="py-1.5 pr-2">Firma</th>
                  <th className="py-1.5 pr-2 whitespace-nowrap">Ultima vizită</th>
                  <th className="py-1.5 text-right whitespace-nowrap">Peste termen</th>
                </tr>
              </thead>
              <tbody>
                {data.slipping.rows.map((x, i) => (
                  <tr key={i} className="border-b border-neutral-100 align-top">
                    <td className="py-1.5 pr-2">
                      {x.client}
                      <span className="block text-xs text-neutral-500">
                        {[x.interest, echipa ? x.agent : null].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{x.lastVisit ? formatDate(x.lastVisit) : "—"}</td>
                    <td className="py-1.5 text-right tabular-nums whitespace-nowrap">{zile(x.zile)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.slipping.count > data.slipping.rows.length ? (
              <p className="mt-1.5 text-xs text-neutral-500">
                Cele mai vechi {data.slipping.rows.length} din {data.slipping.count}.
              </p>
            ) : null}
          </>
        )}
      </Section>

      <Section {...at("owner")}>
        {!data.escalations ? (
          <p className="text-sm text-neutral-500">Raport salvat înainte de lista întrebărilor.</p>
        ) : data.escalations.length === 0 ? (
          <p className="text-sm text-neutral-500">Nicio întrebare deschisă.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.escalations.map((e, i) => (
              <li key={i} className="border-l-2 border-[var(--color-warn)] pl-3 break-inside-avoid">
                <p className="text-xs text-neutral-500">
                  {e.client} · {formatDate(e.date)}
                  {echipa ? ` · ${e.agent}` : ""}
                </p>
                <p>{e.items.join(", ")}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section {...at("vizite")}>
        {data.visits.length === 0 ? (
          <p className="text-sm text-neutral-500">Nicio vizită în perioadă.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
                <th className="py-1.5 pr-2">Data</th>
                <th className="py-1.5 pr-2">Firma</th>
                <th className="py-1.5 pr-2">Agent</th>
                <th className="py-1.5">Revine</th>
              </tr>
            </thead>
            <tbody>
              {data.visits.map((x, i) => (
                <tr key={i} className="border-b border-neutral-100 align-top">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{formatDate(x.date)}</td>
                  <td className="py-1.5 pr-2">
                    {x.client}
                    {x.city ? <span className="text-neutral-500"> · {x.city}</span> : null}
                    {x.prima ? <span className="ml-1 text-xs text-brand-700">(prima vizită)</span> : null}
                  </td>
                  <td className="py-1.5 pr-2">{x.agent}</td>
                  <td className="py-1.5 whitespace-nowrap">{x.nextStepDate ? formatDate(x.nextStepDate) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section {...at("oferte")}>
        {data.quotes.length === 0 ? (
          <p className="text-sm text-neutral-500">Nicio ofertă emisă în perioadă.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
                <th className="py-1.5 pr-2">Număr</th>
                <th className="py-1.5 pr-2">Client</th>
                <th className="py-1.5 pr-2">Stare</th>
                <th className="py-1.5 text-right">Valoare cu TVA</th>
              </tr>
            </thead>
            <tbody>
              {data.quotes.map((q) => (
                <tr key={q.number} className="border-b border-neutral-100">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{q.number}</td>
                  <td className="py-1.5 pr-2">
                    {q.client}
                    <span className="block text-xs text-neutral-500">{q.agent}</span>
                  </td>
                  <td className="py-1.5 pr-2">
                    <StatusBadge status={q.status as QuoteStatus} />
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(q.gross)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section {...at("piata")}>
        {data.market.length === 0 ? (
          <p className="text-sm text-neutral-500">Nu s-au notat încă răspunsuri despre piață.</p>
        ) : (
          <>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {data.market.map((g) => (
                <MarketGroup key={g.group} g={g} prevLabel={data.prevLabel} />
              ))}
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Procentele sunt din firmele care au răspuns la întrebare. Schimbarea față de {data.prevLabel} apare doar când
              ambele perioade au cel puțin {MARKET_MIN_BASE} firme care au răspuns; sub atât, e zgomot.
            </p>
          </>
        )}
      </Section>

      <Section {...at("note")}>
        {data.notes.length === 0 ? (
          <p className="text-sm text-neutral-500">Nicio notă liberă în perioadă.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.notes.map((x, i) => (
              <li key={i} className="border-l-2 border-neutral-300 pl-3 break-inside-avoid">
                <p className="text-xs text-neutral-500">
                  {x.client} · {formatDate(x.date)} · {x.agent}
                </p>
                <p>{x.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <footer className="mt-8 border-t border-neutral-200 pt-2 text-[11px] text-neutral-500">
        {data.orgName} · {SCOPE_LABELS[scope]} {data.typeLabel} · {data.label} · Comparațiile sunt față de {data.prevLabel}.
      </footer>
    </article>
  );
}

/** O secțiune numerotată, cu observația scrisă de om deasupra cifrelor. Lipsește dacă n-a fost aleasă. */
function Section({
  id,
  index,
  note,
  children,
}: {
  id: ReportSection;
  index: number;
  note?: string;
  children: React.ReactNode;
}) {
  if (!index) return null;
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="border-b border-neutral-300 pb-1 text-base font-semibold">
        {index}. {SECTION_LABELS[id]}
      </h2>
      {note?.trim() ? (
        <p className="mt-2 border-l-2 border-brand-600 bg-brand-50 px-3 py-1.5 text-sm whitespace-pre-line text-neutral-900">
          {note.trim()}
        </p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const zile = (n: number) => (n === 1 ? "1 zi" : `${n} zile`);

/** Ce e de reținut, cu tonul scris în cuvânt, nu doar în culoare. */
function Highlights({ items }: { items?: Highlight[] }) {
  if (!items) return <p className="text-sm text-neutral-500">Raport salvat înainte de această secțiune.</p>;
  if (!items.length) return <p className="text-sm text-neutral-500">Nimic deosebit în perioadă.</p>;
  const TONE: Record<Highlight["tone"], { label: string; border: string }> = {
    atentie: { label: "De urmărit", border: "border-[var(--color-warn)]" },
    bine: { label: "Bine", border: "border-[var(--color-ok)]" },
    info: { label: "De știut", border: "border-neutral-300" },
  };
  return (
    <ul className="space-y-1.5">
      {items.map((h, i) => (
        <li key={i} className={`border-l-4 pl-3 text-sm ${TONE[h.tone].border}`}>
          <span className="mr-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{TONE[h.tone].label}</span>
          {h.text}
        </li>
      ))}
    </ul>
  );
}

/**
 * Vizitele pe zi (sau pe săptămână) față de țintă. O singură serie: coloanele
 * sunt vizitele, linia punctată e ținta fiecărei coloane. Valoarea stă deasupra,
 * ca graficul să se citească și tipărit, fără mouse.
 */
function VisitsVsTarget({ rows }: { rows: ReportSnapshot["evolution"] }) {
  if (!rows.length) return <p className="text-sm text-neutral-500">Nicio zi în perioadă.</p>;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.vizite, r.tinta ?? 0)));
  const hasTarget = rows.some((r) => r.tinta);
  const oferte = rows.reduce((n, r) => n + r.oferte, 0);
  const valoare = rows.reduce((n, r) => n + r.valoare, 0);

  return (
    <figure className="break-inside-avoid">
      <div className="flex h-36 items-end gap-1.5 border-b border-neutral-400 pt-5" role="img" aria-label="Vizite față de țintă">
        {rows.map((r) => {
          const h = Math.round((r.vizite / max) * 100);
          const t = r.tinta ? Math.round((r.tinta / max) * 100) : null;
          // Cifra stă pe coloană; doar când ar atinge linia țintei urcă deasupra ei.
          const labelAt = t !== null && t >= h && t - h < 14 ? t : h;
          return (
            <div
              key={r.label}
              className="relative h-full flex-1"
              title={`${r.label}: ${r.vizite} vizite${r.tinta ? ` din ținta de ${r.tinta}` : ""} · ${r.oferte} oferte, ${formatMoney(r.valoare)}`}
            >
              {r.vizite > 0 ? (
                <span
                  className="absolute inset-x-[22%] bottom-0 rounded-t-[4px] bg-brand-600"
                  style={{ height: `${h}%` }}
                />
              ) : null}
              {t !== null ? (
                <span
                  aria-hidden
                  className={`absolute inset-x-0 border-t-2 border-dashed ${r.viitor ? "border-neutral-300" : "border-neutral-900"}`}
                  style={{ bottom: `${t}%` }}
                />
              ) : null}
              {!r.viitor ? (
                <span
                  className="absolute inset-x-0 text-center text-[11px] font-medium text-neutral-900 tabular-nums"
                  style={{ bottom: `calc(${labelAt}% + 3px)` }}
                >
                  {r.vizite}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1.5">
        {rows.map((r) => (
          <span key={r.label} className={`flex-1 truncate text-center text-[11px] ${r.viitor ? "text-neutral-400" : "text-neutral-600"}`}>
            {r.short ?? r.label}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-600" /> Vizite
        </span>
        {hasTarget ? (
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block w-4 border-t-2 border-dashed border-neutral-900" /> Ținta
          </span>
        ) : null}
        <span>
          Oferte emise în perioadă: <b className="tabular-nums">{oferte}</b>, {formatMoney(valoare)}
        </span>
      </figcaption>
    </figure>
  );
}

/** Banii care așteaptă un răspuns: cele care expiră întâi, apoi cele mai mari. */
function PendingQuotes({ pending, echipa }: { pending?: ReportSnapshot["pending"]; echipa: boolean }) {
  if (!pending) return <p className="text-sm text-neutral-500">Raport salvat înainte de această secțiune.</p>;
  if (!pending.count) return <p className="text-sm text-neutral-500">Nicio ofertă trimisă nu așteaptă răspuns.</p>;
  return (
    <>
      <p className="mb-2 text-sm">
        <b className="tabular-nums">{pending.count}</b> {pending.count === 1 ? "ofertă" : "oferte"} trimise, în valoare de{" "}
        <b className="tabular-nums">{formatMoney(pending.total)}</b>
        {pending.expiring ? (
          <>
            ; <b className="tabular-nums">{pending.expiring}</b> expiră în 7 zile ({formatMoney(pending.expiringValue)})
          </>
        ) : null}
        .
      </p>
      {pending.aging && pending.count > 2 ? <Aging rows={pending.aging} /> : null}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
            <th className="py-1.5 pr-2">Oferta</th>
            <th className="py-1.5 pr-2 text-right whitespace-nowrap">Așteaptă</th>
            <th className="py-1.5 pr-2 whitespace-nowrap">Valabilă până</th>
            <th className="py-1.5 text-right">Valoare cu TVA</th>
          </tr>
        </thead>
        <tbody>
          {pending.rows.map((q) => (
            <tr key={q.number} className="border-b border-neutral-100 align-top">
              <td className="py-1.5 pr-2">
                {q.client}
                <span className="block text-xs text-neutral-500">
                  {q.number}
                  {echipa ? ` · ${q.agent}` : ""}
                </span>
              </td>
              <td className={`py-1.5 pr-2 text-right tabular-nums whitespace-nowrap ${q.zile > 30 ? "font-semibold" : ""}`}>
                {zile(q.zile)}
              </td>
              <td className="py-1.5 pr-2 whitespace-nowrap">
                {q.validUntil ? formatDate(q.validUntil) : "—"}
                {q.expira ? <span className="block text-xs font-semibold text-[var(--color-warn)]">expiră curând</span> : null}
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatMoney(q.gross)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pending.count > pending.rows.length ? (
        <p className="mt-1.5 text-xs text-neutral-500">
          Primele {pending.rows.length} din {pending.count}: cele care expiră curând, apoi cele mai mari.
        </p>
      ) : null}
    </>
  );
}

/** Banii care așteaptă, pe vechime: o singură nuanță, valoarea scrisă lângă bară. */
function Aging({ rows }: { rows: NonNullable<NonNullable<ReportSnapshot["pending"]>["aging"]> }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="mb-3 break-inside-avoid">
      <p className="mb-1.5 text-xs font-medium text-neutral-600">Pe vechime, de la emitere</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 text-sm" title={`${r.label}: ${r.count} oferte, ${formatMoney(r.value)}`}>
            <span className="w-28 shrink-0 text-neutral-700">{r.label}</span>
            <span className="h-3 flex-1 overflow-hidden rounded-sm bg-neutral-100">
              {r.value > 0 ? (
                <span
                  className="block h-full rounded-e-[4px] bg-brand-600"
                  style={{ width: `${Math.max(2, Math.round((r.value / max) * 100))}%` }}
                />
              ) : null}
            </span>
            <span className="w-40 shrink-0 text-right text-xs text-neutral-600 tabular-nums">
              {r.count} · {formatMoney(r.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Tendința pe 6 luni: patru grafice mici, fiecare pe scara lui — niciodată
 * două mărimi pe aceeași axă. Luna raportului e plină, celelalte estompate.
 */
function Trend({ rows }: { rows?: ReportSnapshot["trend"] }) {
  if (!rows) return <p className="text-sm text-neutral-500">Tendința apare în rapoartele lunare și trimestriale.</p>;
  const pctFmt0 = (v: number) => `${Math.round(v * 100)}%`;
  const panels: { title: string; get: (r: NonNullable<typeof rows>[number]) => number | null; fmt: (v: number) => string }[] = [
    { title: "Vizite", get: (r) => r.vizite, fmt: (v) => intFmt.format(v) },
    { title: "Oferte emise", get: (r) => r.oferte, fmt: (v) => intFmt.format(v) },
    { title: "Vânzări (acceptate, cu TVA)", get: (r) => r.vanzari, fmt: (v) => formatMoney(v) },
    { title: "Rată de câștig", get: (r) => r.castig, fmt: pctFmt0 },
  ];
  const last = [...rows].reverse().find((r) => r.curent && !r.viitor) ?? rows[rows.length - 1];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {panels.map((panel) => {
        const values = rows.map((r) => panel.get(r));
        const max = Math.max(...values.map((v) => v ?? 0), panel.title === "Rată de câștig" ? 0.01 : 1);
        const now = last ? panel.get(last) : null;
        return (
          <figure key={panel.title} className="break-inside-avoid">
            <figcaption className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium text-neutral-600">{panel.title}</span>
              <span className="text-sm font-semibold tabular-nums">{now === null ? "—" : panel.fmt(now)}</span>
            </figcaption>
            <div className="mt-1 flex h-16 items-end gap-1.5 border-b border-neutral-300">
              {rows.map((r, i) => {
                const v = values[i];
                return (
                  <div
                    key={r.label}
                    className="flex h-full flex-1 items-end justify-center"
                    title={`${r.label}: ${v === null ? "fără oferte cu răspuns" : panel.fmt(v)}`}
                  >
                    {v ? (
                      <span
                        className={`block w-[70%] rounded-t-[4px] ${r.curent ? "bg-brand-600" : "bg-brand-300"}`}
                        style={{ height: `${Math.max(3, Math.round((v / max) * 100))}%` }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-0.5 flex gap-1.5">
              {rows.map((r) => (
                <span
                  key={r.label}
                  className={`flex-1 text-center text-[10px] ${r.curent ? "font-semibold text-neutral-900" : r.viitor ? "text-neutral-400" : "text-neutral-500"}`}
                >
                  {r.short}
                </span>
              ))}
            </div>
          </figure>
        );
      })}
    </div>
  );
}

/** O întrebare despre piață: procentul de acum și, pe o bază destul de mare, schimbarea. */
function MarketGroup({ g, prevLabel }: { g: ReportSnapshot["market"][number]; prevLabel: string }) {
  const base = g.answered ?? 0;
  const comparabil = Boolean(g.prev && base >= MARKET_MIN_BASE && (g.prevAnswered ?? 0) >= MARKET_MIN_BASE);
  // Rapoartele vechi nu au baza: rămân la barele cu număr de firme.
  if (!base) {
    return (
      <div className="break-inside-avoid">
        <p className="mb-1.5 text-sm font-medium">{g.group}</p>
        <BarList rows={g.rows} limit={5} />
      </div>
    );
  }
  return (
    <div className="break-inside-avoid">
      <p className="mb-1.5 text-sm font-medium">
        {g.group}
        <span className="font-normal text-neutral-500">
          {" "}
          · din {base} {base === 1 ? "firmă" : "firme"}
          {g.prevAnswered ? ` (${g.prevAnswered} în ${prevLabel})` : ""}
        </span>
      </p>
      <ul className="space-y-1.5">
        {g.rows.map(([option, firms]) => {
          const now = firms / base;
          const before = comparabil ? (g.prev?.[option] ?? 0) / (g.prevAnswered as number) : null;
          const diff = before === null ? null : Math.round((now - before) * 100);
          return (
            <li key={option} className="flex items-center gap-3 text-sm" title={`${option}: ${firms} din ${base} firme`}>
              <span className="w-[34%] shrink-0 truncate text-neutral-700">{option}</span>
              <span className="h-3 flex-1 overflow-hidden rounded-sm bg-neutral-100">
                <span
                  className="block h-full rounded-e-[4px] bg-brand-600"
                  style={{ width: `${Math.max(2, Math.round(now * 100))}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right tabular-nums text-neutral-900">{Math.round(now * 100)}%</span>
              <span className="w-11 shrink-0 text-right text-xs tabular-nums text-neutral-600">
                {diff === null ? "" : diff === 0 ? "=" : `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)} pp`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** De ce pierdem: motivele pe număr și valoare, apoi ofertele, cu ce a spus clientul. */
function Losses({ losses, echipa }: { losses?: ReportSnapshot["losses"]; echipa: boolean }) {
  if (!losses) return <p className="text-sm text-neutral-500">Raport salvat înainte de această secțiune.</p>;
  if (!losses.count) return <p className="text-sm text-neutral-500">Nicio ofertă pierdută în perioadă.</p>;
  const max = Math.max(1, ...losses.byReason.map((r) => r.count));
  return (
    <>
      <p className="mb-2 text-sm">
        <b className="tabular-nums">{losses.count}</b> {losses.count === 1 ? "ofertă pierdută" : "oferte pierdute"} (respinse sau
        expirate), în valoare de <b className="tabular-nums">{formatMoney(losses.value)}</b>.
        {losses.unknown ? (
          <span className="text-neutral-600">
            {" "}
            {losses.unknown === 1 ? "Una nu are" : `${losses.unknown} nu au`} motivul notat; se notează pe pagina ofertei.
          </span>
        ) : null}
      </p>
      <ul className="mb-3 space-y-1 break-inside-avoid">
        {losses.byReason.map((r) => (
          <li key={r.label} className="flex items-center gap-3 text-sm" title={`${r.label}: ${r.count}, ${formatMoney(r.value)}`}>
            <span className="w-[38%] shrink-0 truncate text-neutral-700">{r.label}</span>
            <span className="h-3 flex-1 overflow-hidden rounded-sm bg-neutral-100">
              <span
                className={`block h-full rounded-e-[4px] ${r.label === lossReasonLabel(null) ? "bg-neutral-400" : "bg-brand-600"}`}
                style={{ width: `${Math.max(2, Math.round((r.count / max) * 100))}%` }}
              />
            </span>
            <span className="w-36 shrink-0 text-right text-xs text-neutral-600 tabular-nums">
              {r.count} · {formatMoney(r.value)}
            </span>
          </li>
        ))}
      </ul>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
            <th className="py-1.5 pr-2">Oferta</th>
            <th className="py-1.5 pr-2">Motivul</th>
            <th className="py-1.5 text-right">Valoare cu TVA</th>
          </tr>
        </thead>
        <tbody>
          {losses.rows.map((x) => (
            <tr key={x.number} className="border-b border-neutral-100 align-top">
              <td className="py-1.5 pr-2">
                {x.client}
                <span className="block text-xs text-neutral-500">
                  {x.number} · {x.status === "expired" ? "expirată" : "respinsă"}
                  {echipa ? ` · ${x.agent}` : ""}
                </span>
              </td>
              <td className="py-1.5 pr-2">
                {x.reason}
                {x.note ? <span className="block text-xs text-neutral-600">„{x.note}”</span> : null}
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatMoney(x.gross)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {losses.count > losses.rows.length ? (
        <p className="mt-1.5 text-xs text-neutral-500">Cele mai mari {losses.rows.length} din {losses.count}.</p>
      ) : null}
    </>
  );
}
