"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/teren", label: "Azi" },
  { href: "/teren/firme", label: "Firme" },
  { href: "/teren/vizita/noua", label: "＋ Vizită" },
  { href: "/teren/catalog", label: "Catalog" },
  { href: "/teren/ghid", label: "Ghid" },
];

export function TerenNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/teren"
      ? pathname === "/teren"
      : href === "/teren/firme"
        ? pathname.startsWith("/teren/firme") || pathname.startsWith("/teren/firma")
        : pathname.startsWith(href);

  return (
    <nav className="teren-nav">
      <div className="flex w-full max-w-[760px]">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="teren-nav-item"
            aria-current={isActive(t.href) ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
