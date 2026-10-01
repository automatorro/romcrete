import Link from "next/link";

export type FilterChip = {
  label: string;
  href: string;
  active: boolean;
  count?: number;
};

/**
 * Un rând de filtre, același peste tot: pe stare, pe perioadă, pe agent.
 * Sunt linkuri, deci filtrul ales rămâne în adresă și se poate trimite mai departe.
 *
 * `scroll`: pe telefon rândul nu se mai rupe pe mai multe linii, ci se trage cu
 * degetul; pe calculator, unde e loc, se așază normal.
 */
export function FilterChips({ label, items, scroll = false }: { label: string; items: FilterChip[]; scroll?: boolean }) {
  return (
    <nav aria-label={label} className={scroll ? "chip-row" : "flex flex-wrap gap-2"}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          className={`chip chip-s shrink-0 ${item.active ? "chip-on" : ""}`}
        >
          {item.label}
          {item.count !== undefined ? (
            <span className={`ml-1.5 tabular-nums ${item.active ? "opacity-80" : "text-neutral-500"}`}>
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
