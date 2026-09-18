import Link from "next/link";

import { NavLink } from "@/components/nav-link";
import { SubmitButton } from "@/components/submit-button";
import { signOut } from "@/app/(auth)/actions";
import { requireOrg } from "@/lib/auth";

/** Depinde de sesiune: se randează la fiecare cerere, niciodată prerandat. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { organization, user } = await requireOrg();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-concrete-200 bg-white lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex flex-col gap-6 p-4 lg:sticky lg:top-0 lg:h-screen">
          <Link href="/oferte" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              R
            </span>
            <span className="text-lg font-semibold tracking-tight">Romcrete</span>
          </Link>

          <nav className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap">
            <NavLink href="/oferte">Oferte</NavLink>
            <NavLink href="/clienti">Clienți</NavLink>
            <NavLink href="/catalog">Catalog</NavLink>
            <NavLink href="/setari">Setări firmă</NavLink>
          </nav>

          <div className="mt-auto space-y-2 border-t border-concrete-200 pt-4">
            <p className="truncate text-sm font-medium text-concrete-900">{organization.name}</p>
            <p className="truncate text-xs text-concrete-500">{user.email}</p>
            <form action={signOut}>
              <SubmitButton className="btn btn-secondary w-full" pendingLabel="Se iese…">
                Ieși din cont
              </SubmitButton>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 px-4 py-8 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
