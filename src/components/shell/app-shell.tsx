import Link from "next/link";

import { signOut } from "@/app/(auth)/actions";
import { TerenNav } from "@/app/teren/nav";
import { Logo } from "@/components/logo";
import { SideNav } from "@/components/shell/side-nav";
import { SubmitButton } from "@/components/submit-button";
import { requireOrg } from "@/lib/auth";

/**
 * Cadrul comun al aplicației, pentru teren și pentru birou.
 *
 * Pe calculator: meniul în stânga și pagina pe toată lățimea rămasă.
 * Pe telefon: sus doar sigla și firma, jos bara de teren (Azi · Firme · ＋Vizită
 * · Oferte · Mai mult), la degetul mare; paginile de birou sunt în „Mai mult”.
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const { organization, user, role } = await requireOrg();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden border-r border-neutral-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:gap-6 lg:overflow-y-auto lg:p-4">
        <Link href="/teren" className="flex items-center gap-2 px-1 pt-1">
          <Logo className="h-9 w-auto" />
        </Link>
        <SideNav management={role !== "agent"} />
        <div className="mt-auto space-y-2 border-t border-neutral-200 pt-4">
          <p className="truncate text-sm font-medium text-neutral-900">{organization.name}</p>
          <p className="truncate text-xs text-neutral-500">{user.email}</p>
          <form action={signOut}>
            <SubmitButton className="btn btn-secondary w-full" pendingLabel="Se iese…">
              Ieși din cont
            </SubmitButton>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Pe telefon: sigla și firma, fără meniu sus; navigarea e jos. */}
        <header className="flex items-center gap-3 px-3.5 pt-3 lg:hidden">
          <Link href="/teren" aria-label="Azi">
            <Logo className="h-7 w-auto" />
          </Link>
          <span className="truncate text-sm text-neutral-500">{organization.name}</span>
        </header>
        <main className="px-3.5 pt-3 pb-28 lg:px-8 lg:pt-8 lg:pb-12">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <div className="lg:hidden">
        <TerenNav />
      </div>
    </div>
  );
}
