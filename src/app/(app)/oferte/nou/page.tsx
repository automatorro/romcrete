import Link from "next/link";

import { createQuote } from "@/app/(app)/oferte/actions";
import { QuoteForm } from "@/app/(app)/oferte/quote-form";
import { EmptyState } from "@/components/empty-state";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Ofertă nouă" };

export default async function NewQuotePage() {
  const { orgId, organization } = await requireOrg();

  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name");

  const clients = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/oferte" className="text-sm text-brand-700 hover:underline">
          ← Toate ofertele
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-concrete-900">Ofertă nouă</h1>
        <p className="mt-1 text-sm text-concrete-500">
          Numărul ofertei se generează automat la salvare. Produsele le adaugi la pasul următor.
        </p>
      </div>

      {clients.length === 0 ? (
        <EmptyState
          title="Ai nevoie de un client"
          description="O ofertă se emite pe numele unui client. Adaugă primul client și revino aici."
          action={
            <Link href="/clienti" className="btn btn-primary">
              Adaugă client
            </Link>
          }
        />
      ) : (
        <div className="card p-6">
          <QuoteForm
            action={createQuote}
            clients={clients}
            defaultTerms={organization.quote_terms}
            submitLabel="Creează oferta"
          />
        </div>
      )}
    </div>
  );
}
