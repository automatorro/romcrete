import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteClientRecord, updateClientRecord } from "@/app/(app)/clienti/actions";
import { ClientForm } from "@/app/(app)/clienti/client-form";
import { ClientHistory } from "@/components/client-history";
import { SubmitButton } from "@/components/submit-button";
import { todayRo } from "@/lib/agenda";
import { requireOrg } from "@/lib/auth";
import { findDomain, getAllDomains } from "@/lib/domenii";
import { getClientHistory } from "@/lib/istoric-firma";
import { getQuestionCatalogue } from "@/lib/questions";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

export const metadata = { title: "Editare client" };

export default async function ClientPage(props: PageProps<"/clienti/[id]">) {
  const { id } = await props.params;
  const { eroare } = await props.searchParams;
  const { orgId, user, role } = await requireOrg();

  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();

  if (!data) notFound();
  const client = data as Client;

  const domain = findDomain(await getAllDomains(orgId), client.domain ?? null);
  const history = await getClientHistory(
    client.id,
    orgId,
    await getQuestionCatalogue(orgId, domain),
    { userId: user.id, isAdmin: role !== "agent" },
    { visitHref: (v) => `/teren/vizita/${v}`, quoteHref: (q) => `/oferte/${q}` },
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clienti" className="text-sm text-brand-700 hover:underline">
          ← Toți clienții
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
          {client.name}
        </h1>
      </div>

      {typeof eroare === "string" && eroare ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {eroare}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card p-6">
          <ClientForm action={updateClientRecord.bind(null, client.id)} client={client} />
        </div>

        <section>
          <h2 className="mb-2 text-base font-semibold text-neutral-900">Istoric</h2>
          <ClientHistory clientId={client.id} items={history} today={todayRo()} />
        </section>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-neutral-500">
          Un client cu oferte emise nu poate fi șters, ca să nu se piardă istoricul.
        </p>
        <form action={deleteClientRecord}>
          <input type="hidden" name="id" value={client.id} />
          <SubmitButton
            className="btn btn-danger"
            pendingLabel="Se șterge…"
            confirm={`Ștergi clientul „${client.name}”?`}
          >
            Șterge clientul
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
