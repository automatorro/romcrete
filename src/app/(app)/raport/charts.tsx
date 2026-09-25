/**
 * Piesele de vizualizare ale raportului. Sunt componente de server: niciun
 * kilobait de JavaScript pentru un grafic care nu se schimbă după randare.
 *
 * Regula pe care o respectă toate: textul poartă culori de text, nu culoarea
 * seriei. Culoarea stă în marcaj, identitatea în eticheta de lângă el.
 */

/** Bare orizontale pentru mărimi comparabile: o singură nuanță, valoarea lângă bară. */
export function BarList({
  rows,
  limit = 6,
  empty = "Încă nu sunt date.",
}: {
  rows: [string, number][];
  limit?: number;
  empty?: string;
}) {
  const shown = rows.slice(0, limit);
  if (!shown.length) return <p className="text-sm text-neutral-500">{empty}</p>;

  const max = Math.max(...shown.map((r) => r[1]));

  return (
    <ul className="space-y-1.5">
      {shown.map(([label, value]) => (
        <li key={label} className="flex items-center gap-3 text-sm" title={`${label}: ${value}`}>
          <span className="w-[45%] shrink-0 truncate text-neutral-700">{label}</span>
          <span className="h-3.5 flex-1 overflow-hidden rounded-sm bg-neutral-100">
            <span
              className="block h-full rounded-e-sm bg-brand-600"
              style={{ width: `${Math.max(2, Math.round((value / max) * 100))}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right tabular-nums text-neutral-500">{value}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Cum lucrează piața: o scală ordonată de la manual la mecanizat, cu mixt la
 * mijloc. Formă divergentă, nu categorială — ordinea are înțeles, iar culori
 * diferite ar ascunde-o. Polii sunt cald/rece, mijlocul e gri neutru.
 */
const DIVERGING: [string, string, string][] = [
  ["manual", "Manual", "#b45309"],
  ["mixt", "Mixt", "#8a8a8a"],
  ["mecanizat", "Mecanizat", "#0033ab"],
];

export function WorkModeShare({ counts }: { counts: Record<string, number> }) {
  const total = DIVERGING.reduce((n, [id]) => n + (counts[id] ?? 0), 0);

  if (!total) {
    return <p className="text-sm text-neutral-500">Încă nu s-a notat cum lucrează nicio firmă.</p>;
  }

  return (
    <div>
      <div className="flex h-6 gap-0.5 overflow-hidden rounded-md">
        {DIVERGING.map(([id, label, color]) => {
          const n = counts[id] ?? 0;
          if (!n) return null;
          return (
            <span
              key={id}
              title={`${label}: ${n} din ${total}`}
              style={{ width: `${(n / total) * 100}%`, backgroundColor: color }}
            />
          );
        })}
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {DIVERGING.map(([id, label, color]) => {
          const n = counts[id] ?? 0;
          return (
            <li key={id} className="flex items-center gap-1.5 text-neutral-700">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              {label}
              <span className="tabular-nums text-neutral-500">
                {n} · {Math.round((n / total) * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Pâlnia: trei mărimi pe aceeași scală, cu rata de trecere scrisă între ele. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const rate = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label}>
            <div className="flex items-baseline gap-2 text-sm">
              <span className="text-neutral-700">{s.label}</span>
              <span className="flex-1" />
              <span className="text-lg font-semibold tabular-nums">{s.value}</span>
              {rate !== null ? (
                <span className="w-14 text-right text-xs text-neutral-500">{rate}% trec</span>
              ) : (
                <span className="w-14" />
              )}
            </div>
            <span className="mt-0.5 block h-3.5 overflow-hidden rounded-sm bg-neutral-100">
              <span
                className="block h-full rounded-e-sm bg-brand-600"
                style={{ width: `${Math.max(2, Math.round((s.value / max) * 100))}%` }}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
