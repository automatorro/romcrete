import Link from "next/link";

import { OfficeNav } from "@/app/(app)/office-nav";
import { Logo } from "@/components/logo";
import { SubmitButton } from "@/components/submit-button";
import { signOut } from "@/app/(auth)/actions";
import { requireOrg } from "@/lib/auth";

/** Depinde de sesiune: se randează la fiecare cerere, niciodată prerandat. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { organization, user } = await requireOrg();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="border-b border-neutral-200 bg-white lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
        <OfficeNav
          brand={
            <Link href="/oferte" className="flex items-center gap-2">
              <Logo />
            </Link>
          }
          footer={
            <div className="space-y-2 border-t border-neutral-200 pt-4">
              <p className="truncate text-sm font-medium text-neutral-900">{organization.name}</p>
              <p className="truncate text-xs text-neutral-500">{user.email}</p>
              <form action={signOut}>
                <SubmitButton className="btn btn-secondary w-full" pendingLabel="Se iese…">
                  Ieși din cont
                </SubmitButton>
              </form>
            </div>
          }
        />
      </aside>

      <main className="flex-1 px-4 py-8 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
