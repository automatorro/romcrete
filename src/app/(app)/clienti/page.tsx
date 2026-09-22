import Link from "next/link";

import { createClientRecord } from "@/app/(app)/clienti/actions";
import { ClientForm } from "@/app/(app)/clienti/client-form";
import { EmptyState } from "@/components/empty-state";
import { requireOrg } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

export const metadata = { title: "Clienți" };

export default async function ClientsPage(props: PageProps<"/clienti">) {
  const { orgId } = await requireOrg();
  const { q } = await props.searchParams;
  const search = typeof q === "string" ? q.trim() : "";

  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (search) {
    query = query.or(`name.ilike.%${search}%,cui.ilike.%${search}%,city.ilike.%${search}%`);
  }

  const { data, error } = await query;
  const clients = (data ?? []) as Client[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Clienți</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Datele de aici se preiau automat pe ofertă.
          </p>
        </div>

        <form className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Caută după nume, CUI sau oraș"
            className="input w-64"
          />
          <button type="submit" className="btn btn-secondary">
            Caută
          </button>
        </form>
      </header>

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium text-brand-700">
          + Adaugă client
        </summary>
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <ClientForm action={createClientRecord} submitLabel="Adaugă client" resetOnSuccess />
        </div>
      </details>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error.message}
        </p>
      ) : null}

      {clients.length === 0 ? (
        <EmptyState
          title={search ? "Niciun client găsit" : "Niciun client încă"}
          description={
            search
              ? "Încearcă alt termen de căutare."
              : "Adaugă primul client ca să poți emite oferte pe numele lui."
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                <th className="table-head">Denumire</th>
                <th className="table-head">CUI</th>
                <th className="table-head">Contact</th>
                <th className="table-head">Localitate</th>
                <th className="table-head" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-neutral-50">
                  <td className="table-cell font-medium">{client.name}</td>
                  <td className="table-cell text-neutral-500">{client.cui ?? "—"}</td>
                  <td className="table-cell text-neutral-500">
                    {[client.contact_person, client.phone].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="table-cell text-neutral-500">{client.city ?? "—"}</td>
                  <td className="table-cell text-right">
                    <Link
                      href={`/clienti/${client.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      Editează
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
