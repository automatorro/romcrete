import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionContext } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";

/** Depinde de sesiune: se randează la fiecare cerere, niciodată prerandat. */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (supabaseConfigured) {
    const context = await getSessionContext();
    if (context) redirect(context.membership ? "/oferte" : "/onboarding");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
          Ofertare și devize
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl">
          Romcrete
        </h1>
        <p className="text-lg text-neutral-700">
          Catalog de produse și servicii, oferte numerotate automat, calcul de TVA și discounturi,
          export PDF pentru client. Construit pentru firme de betoane și construcții.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {[
          ["Catalog", "Prețuri, unități de măsură și cote TVA într-un singur loc."],
          ["Oferte", "Serie și număr generate automat, pe an și pe firmă."],
          ["PDF", "Document gata de trimis, cu datele firmei și ale clientului."],
        ].map(([title, description]) => (
          <li key={title} className="card p-4">
            <p className="font-medium text-neutral-900">{title}</p>
            <p className="mt-1 text-sm text-neutral-500">{description}</p>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3">
        <Link href="/login" className="btn btn-primary">
          Intră în cont
        </Link>
        <Link href="/inregistrare" className="btn btn-secondary">
          Creează cont
        </Link>
      </div>

      {supabaseConfigured ? null : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Supabase nu este configurat. Copiază <code>.env.example</code> în <code>.env.local</code>{" "}
          și completează datele proiectului.
        </p>
      )}
    </div>
  );
}
