"use client";

import { useState } from "react";

import { NavLink } from "@/components/nav-link";

const GROUPS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Activitate",
    links: [
      { href: "/teren", label: "Teren · agenda" },
      { href: "/raport", label: "Raport de teren" },
    ],
  },
  {
    title: "Vânzări",
    links: [
      { href: "/oferte", label: "Oferte" },
      { href: "/clienti", label: "Clienți" },
    ],
  },
  {
    title: "Configurare",
    links: [
      { href: "/catalog", label: "Catalog" },
      { href: "/setari", label: "Setări firmă" },
    ],
  },
];

/**
 * Meniul biroului, pe grupuri. Pe calculator stă deschis în lateral; pe
 * telefon se strânge sub un buton „Meniu”, ca să nu împingă pagina în jos.
 */
export function OfficeNav({ brand, footer }: { brand: React.ReactNode; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-4 lg:sticky lg:top-0 lg:h-screen lg:gap-6">
      <div className="flex items-center gap-2">
        <div className="flex-1">{brand}</div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="meniu-birou"
          className="btn btn-secondary lg:hidden"
        >
          {open ? "Închide" : "Meniu"}
        </button>
      </div>

      <div id="meniu-birou" className={`${open ? "flex" : "hidden"} flex-1 flex-col gap-5 lg:flex`}>
        <nav
          aria-label="Meniul biroului"
          className="space-y-4"
          // Pe telefon, alegerea unei pagini închide meniul.
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{g.title}</p>
              <div className="flex flex-col gap-0.5">
                {g.links.map((l) => (
                  <NavLink key={l.href} href={l.href}>
                    {l.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto">{footer}</div>
      </div>
    </div>
  );
}
