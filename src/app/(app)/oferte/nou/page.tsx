import Link from "next/link";

import { createQuote } from "@/app/(app)/oferte/actions";
import { QuoteForm } from "@/app/(app)/oferte/quote-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Ofertă nouă" };

export default async function NewQuotePage() {
  const { orgId } = await requireOrg();

  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name");

  const clients = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/oferte", label: "Toate ofertele" }}
        title="Ofertă nouă"
        description="Numărul ofertei se generează automat la salvare. Produsele le adaugi la pasul următor."
      />

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
            submitLabel="Creează oferta"
          />
        </div>
      )}
    </div>
  );
}
