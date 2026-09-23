import { redirect } from "next/navigation";

import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Depinde de sesiune: se randează la fiecare cerere, niciodată prerandat. */
export const dynamic = "force-dynamic";

export const metadata = { title: "Configurare firmă" };

export default async function OnboardingPage() {
  const context = await requireUser();
  if (context.membership) redirect("/teren");

  // Agentul cu email de firmă intră singur, fără invitație și fără aprobare.
  const supabase = await createClient();
  const { data: joined } = await supabase.rpc("join_org_by_domain");
  if (joined) redirect("/teren");

  // Nu a putut intra: ori nu există încă nicio firmă — și atunci o creează el —
  // ori emailul lui nu e pe lista domeniilor permise.
  const { count } = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true });

  if ((count ?? 0) > 0) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-12">
        <div className="card space-y-3 p-6">
          <h1 className="text-xl font-semibold">Contul tău nu are acces</h1>
          <p className="text-sm text-neutral-700">
            Te-ai înregistrat cu <b>{context.user.email}</b>, iar acest domeniu nu e pe lista
            celor care pot intra în firmă.
          </p>
          <p className="text-sm text-neutral-500">
            Dacă ești agent Romcrete, fă-ți contul cu adresa de serviciu. Dacă folosești deja
            adresa corectă, cere administratorului să adauge domeniul în Setări.
          </p>
        </div>
      </div>
    );
  }

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
