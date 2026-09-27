"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  /** Alte adrese care țin de aceeași pagină (varianta de teren a unei pagini de birou). */
  also?: string[];
  exact?: boolean;
};

type Group = { title: string; items: Item[] };

/** Agentul vede paginile de teren; fiecare lucru apare o singură dată. */
const AGENT: Group[] = [
  {
    title: "Teren",
    items: [
      { href: "/teren", label: "Azi · agenda", exact: true },
      { href: "/teren/firme", label: "Firme", also: ["/teren/firma"] },
    ],
  },
  {
    title: "Vânzări",
    items: [
      { href: "/teren/oferte", label: "Oferte", also: ["/teren/oferta"] },
      { href: "/teren/catalog", label: "Catalog" },
      { href: "/teren/rapoarte", label: "Rapoartele mele" },
    ],
  },
  {
    title: "Cont",
    items: [
      { href: "/teren/cont", label: "Datele mele pe ofertă" },
      { href: "/teren/ghid", label: "Ghid" },
    ],
  },
];

/**
 * Conducerea vede tot, dar fiecare lucru o singură dată: paginile care au și
 * variantă de teren (oferte, firme, catalog, rapoarte) duc la varianta de birou.
 */
const MANAGEMENT: Group[] = [
  {
    title: "Activitate",
    items: [
      { href: "/teren", label: "Azi · agenda", exact: true },
      { href: "/rapoarte", label: "Rapoarte", also: ["/teren/rapoarte"] },
      { href: "/raport", label: "Analiza pieței" },
    ],
  },
  {
    title: "Vânzări",
    items: [
      { href: "/oferte", label: "Oferte", also: ["/teren/oferte", "/teren/oferta"] },
      { href: "/clienti", label: "Clienți", also: ["/teren/firme", "/teren/firma"] },
    ],
  },
  {
    title: "Configurare",
    items: [
      { href: "/catalog", label: "Catalog", also: ["/teren/catalog"] },
      { href: "/setari", label: "Setări firmă", also: ["/teren/cont"] },
      { href: "/teren/ghid", label: "Ghid" },
    ],
  },
];

const within = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * Meniul din stânga, pe calculator. Pagina deschisă e marcată cu albastrul
 * Romcrete; „＋ Vizită nouă”, acțiunea de fiecare zi, stă deasupra.
 */
export function SideNav({ management }: { management: boolean }) {
  const pathname = usePathname();
  const groups = management ? MANAGEMENT : AGENT;
  const isActive = (item: Item) =>
    item.exact ? pathname === item.href : [item.href, ...(item.also ?? [])].some((h) => within(pathname, h));

  return (
    <nav aria-label="Meniul aplicației" className="space-y-5">
      <Link
        href="/teren/vizita/noua"
        aria-current={within(pathname, "/teren/vizita") ? "page" : undefined}
        className="btn btn-primary w-full"
      >
        ＋ Vizită nouă
      </Link>
      {groups.map((group) => (
        <div key={group.title}>
          <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{group.title}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${
                    active ? "bg-brand-700 text-white" : "text-neutral-700 hover:bg-brand-50 hover:text-brand-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
