import { BarList, Funnel } from "@/app/(app)/raport/charts";
import { Logo } from "@/components/logo";
import { StatusBadge } from "@/components/status-badge";
import type { Kpi, ReportSection, ReportSnapshot } from "@/lib/raport-perioada";
import { ALL_SECTIONS, SECTION_LABELS } from "@/lib/raport-perioada";
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
            {pct}% din ținta de {intFmt.format(k.target)} până azi
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
  author,
}: {
  data: ReportSnapshot;
  title: string;
  summary?: string | null;
  sections: ReportSection[];
  sectionNotes?: Partial<Record<ReportSection, string>>;
  author?: string | null;
}) {
  const filters = [data.filters.agent ?? "Toți agenții", data.filters.domain ?? "Toate domeniile"].join(" · ");
  // Numerotarea urmează ordinea fixă a secțiunilor, doar pentru cele alese.
  const shown = ALL_SECTIONS.filter((id) => sections.includes(id));
  const at = (id: ReportSection) => ({ id, index: shown.indexOf(id) + 1, note: sectionNotes[id] });

  const maxVizite = Math.max(1, ...data.evolution.map((e) => e.vizite));
  const maxOferte = Math.max(1, ...data.evolution.map((e) => e.oferte));

  return (
    <article className="text-[13px] leading-snug text-neutral-900">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
        <div>
          <Logo className="mb-2 h-8 w-auto" />
          <p className="font-semibold">{data.orgName}</p>
        </div>
        <div className="sm:text-right print:text-right">
          <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">Raport {data.typeLabel}</p>
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

      <Section {...at("kpi")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.kpis.map((k) => (
            <KpiTile key={k.key} k={k} prevLabel={data.prevLabel} />
          ))}
        </div>
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

      <Section {...at("evolutie")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
              <th className="py-1.5 pr-2">Perioada</th>
              <th className="py-1.5 pr-2">Vizite</th>
              <th className="py-1.5 pr-2">Oferte</th>
              <th className="hidden py-1.5 text-right sm:table-cell print:table-cell">Valoare</th>
            </tr>
          </thead>
          <tbody>
            {data.evolution.map((e) => (
              <tr key={e.label} className="border-b border-neutral-100">
                <td className="py-1.5 pr-2 whitespace-nowrap">{e.label}</td>
                <td className="w-[35%] py-1.5 pr-2">
                  <Bar value={e.vizite} max={maxVizite} />
                </td>
                <td className="w-[30%] py-1.5 pr-2">
                  <Bar value={e.oferte} max={maxOferte} light />
                </td>
                <td className="hidden py-1.5 text-right tabular-nums sm:table-cell print:table-cell">
                  {formatMoney(e.valoare)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <div className="grid gap-4 sm:grid-cols-2">
            {data.market.map((g) => (
              <div key={g.group} className="break-inside-avoid">
                <p className="mb-1.5 text-sm font-medium">{g.group}</p>
                <BarList rows={g.rows} limit={5} />
              </div>
            ))}
          </div>
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
        {data.orgName} · Raport {data.typeLabel} · {data.label} · Comparațiile sunt față de {data.prevLabel}.
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

function Bar({ value, max, light }: { value: number; max: number; light?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="block h-2.5 flex-1 overflow-hidden rounded-sm bg-neutral-100">
        <span
          className={`block h-full rounded-e-sm ${light ? "bg-brand-300" : "bg-brand-600"}`}
          style={{ width: `${Math.round((value / max) * 100)}%` }}
        />
      </span>
      <span className="w-7 text-right tabular-nums">{value}</span>
    </span>
  );
}
