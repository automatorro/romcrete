"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Iconițe simple, desenate cu linie: se recunosc din mers, fără să citești eticheta. */
const ICONS = {
  azi: (
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
  ),
  firme: (
    <>
      <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
      <path d="M14 10h5a1 1 0 0 1 1 1v10M3 21h18M8 8h2M8 12h2M8 16h2" />
    </>
  ),
  oferte: (
    <>
      <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  mai: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

const TABS = [
  { href: "/teren", label: "Azi", icon: "azi", match: (p: string) => p === "/teren" },
  {
    href: "/teren/firme",
    label: "Firme",
    icon: "firme",
    match: (p: string) => p.startsWith("/teren/firme") || p.startsWith("/teren/firma"),
  },
  { href: "/teren/oferte", label: "Oferte", icon: "oferte", match: (p: string) => p.startsWith("/teren/oferte") },
  {
    href: "/teren/mai-mult",
    label: "Mai mult",
    icon: "mai",
    match: (p: string) =>
      p.startsWith("/teren/mai-mult") || p.startsWith("/teren/catalog") || p.startsWith("/teren/ghid"),
  },
] as const;

/**
 * Navigația de teren, la degetul mare. „＋ Vizită” e acțiunea de fiecare zi,
 * deci stă la mijloc, mai mare și plină.
 */
export function TerenNav() {
  const pathname = usePathname();
  const tab = (t: (typeof TABS)[number]) => (
    <Link
      key={t.href}
      href={t.href}
      className="teren-nav-item"
      aria-current={t.match(pathname) ? "page" : undefined}
    >
      <Icon name={t.icon} />
      {t.label}
    </Link>
  );

  return (
    <nav className="teren-nav" aria-label="Navigare teren">
      <div className="flex w-full max-w-[760px] items-stretch">
        {tab(TABS[0])}
        {tab(TABS[1])}
        <Link
          href="/teren/vizita/noua"
          className="teren-nav-main"
          aria-current={pathname.startsWith("/teren/vizita") ? "page" : undefined}
        >
          <span className="teren-nav-plus" aria-hidden>
            ＋
          </span>
          Vizită
        </Link>
        {tab(TABS[2])}
        {tab(TABS[3])}
      </div>
    </nav>
  );
}
