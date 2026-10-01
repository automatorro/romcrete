import Link from "next/link";

export type SegmentedItem = {
  label: string;
  href: string;
  active: boolean;
};

/**
 * Alegerile care se exclud între ele („Ale mele / Echipa”, „Zilnic / Săptămânal”):
 * un singur control lat, pe un rând, în care se vede dintr-o privire ce e ales.
 * Sunt linkuri, deci alegerea rămâne în adresă, ca la filtre.
 */
export function Segmented({ label, items, className = "" }: { label: string; items: SegmentedItem[]; className?: string }) {
  return (
    <nav aria-label={label} className={`segmented ${className}`}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "true" : undefined}
          className="segmented-item"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
