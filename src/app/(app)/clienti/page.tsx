import Link from "next/link";

import { createClientRecord, importClientsFromFile } from "@/app/(app)/clienti/actions";
import { ClientForm } from "@/app/(app)/clienti/client-form";
import { ImportForm } from "@/app/(app)/clienti/import-form";
import { DataList } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
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
    const cols = ["name", "cui", "reg_com", "contact_person", "email", "phone", "city"];
    query = query.or(cols.map((col) => `${col}.ilike.%${search}%`).join(","));
  }

  const { data, error } = await query;
  const clients = (data ?? []) as Client[];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clienți"
        description="Datele de aici se preiau automat pe ofertă."
        actions={
          <form className="flex w-full gap-2 sm:w-auto">
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder="Caută după nume, CUI, persoană sau oraș"
              aria-label="Caută clienți"
              className="input min-w-0 flex-1 sm:w-72"
            />
            <button type="submit" className="btn btn-secondary">
              Caută
            </button>
          </form>
        }
      />

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium text-brand-700">
          + Adaugă client
        </summary>
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <ClientForm action={createClientRecord} submitLabel="Adaugă client" resetOnSuccess />
        </div>
      </details>

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium text-brand-700">
          Importă clienți din Excel
        </summary>
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <ImportForm action={importClientsFromFile} />
        </div>
      </details>

      {error ? (
        <p role="alert" className="notice-error">
          {error.message}
        </p>
      ) : null}

      {clients.length === 0 ? (
        <EmptyState
          title={search ? "Niciun client găsit" : "Niciun client încă"}
          description={
            search
              ? "Încearcă alt termen de căutare."
              : "Adaugă primul client sau importă-i pe toți dintr-un fișier Excel."
          }
        />
      ) : (
        <DataList
          rows={clients}
          rowKey={(c) => c.id}
          minWidth={640}
          title={(c) => (
            <Link href={`/clienti/${c.id}`} className="text-brand-700 hover:underline">
              {c.name}
            </Link>
          )}
          columns={[
            {
              header: "Denumire",
              hideOnMobile: true,
              cell: (c) => (
                <Link href={`/clienti/${c.id}`} className="font-medium hover:underline">
                  {c.name}
                </Link>
              ),
            },
            { header: "CUI", className: "text-neutral-500", cell: (c) => c.cui ?? "—" },
            { header: "Localitate", className: "text-neutral-500", cell: (c) => c.city ?? "—" },
            {
              header: "Contact",
              className: "text-neutral-500",
              cell: (c) => [c.contact_person, c.phone, c.email].filter(Boolean).join(" · ") || "—",
            },
          ]}
          actions={(c) => (
            <Link href={`/clienti/${c.id}`} className="btn btn-secondary btn-sm">
              Fișa clientului
            </Link>
          )}
        />
      )}
    </div>
  );
}
