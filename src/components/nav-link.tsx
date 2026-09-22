"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-50 text-brand-700"
          : "text-neutral-700 hover:bg-neutral-100"
      }`}
    >
      {children}
    </Link>
  );
}
