import { redirect } from "next/navigation";

import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { requireUser } from "@/lib/auth";

/** Depinde de sesiune: se randează la fiecare cerere, niciodată prerandat. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Configurare firmă" };

export default async function OnboardingPage() {
  const context = await requireUser();
  if (context.membership) redirect("/oferte");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="card space-y-6 p-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Datele firmei</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Apar pe fiecare ofertă pe care o trimiți. Le poți modifica oricând din Setări.
          </p>
        </div>

        <OnboardingForm />
      </div>
    </div>
  );
}
