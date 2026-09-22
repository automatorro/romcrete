import Link from "next/link";

import { Logo } from "@/components/logo";
import { requireOrg } from "@/lib/auth";
import { TerenNav } from "@/app/teren/nav";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { default: "Teren", template: "%s · Teren Romcrete" },
};

/**
 * Interfața de teren: o coloană îngustă, gândită pentru telefon ținut într-o
 * mână. Navigația stă jos, la degetul mare, iar conținutul are spațiu sub el
 * ca ultimul rând să nu ajungă sub bara de navigație.
 */
export default async function TerenLayout({ children }: LayoutProps<"/teren">) {
  const { organization, role } = await requireOrg();

  return (
    <>
      <div className="mx-auto max-w-[760px] px-3.5 pt-3 pb-28">
        <div className="mb-3 flex items-center gap-3">
          <Logo className="h-7 w-auto" />
          <span className="truncate text-sm text-neutral-500">{organization.name}</span>
          <span className="flex-1" />
          {role === "agent" ? null : (
            <Link href="/oferte" className="text-sm font-medium text-brand-700 hover:underline">
              Birou →
            </Link>
          )}
        </div>
        {children}
      </div>
      <TerenNav />
    </>
  );
}
