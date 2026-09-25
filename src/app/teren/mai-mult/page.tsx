import Link from "next/link";

import { signOut } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireOrg } from "@/lib/auth";

export const metadata = { title: "Mai mult" };

type Item = { href: string; label: string; hint: string };

/** Tot ce nu încape în bara de jos: unelte de consultat, biroul și contul. */
export default async function MaiMultPage() {
  const { organization, user, role } = await requireOrg();
  const conducere = role !== "agent";

  const unelte: Item[] = [
    { href: "/teren/catalog", label: "Catalog", hint: "Pompe și accesorii, cu prețuri fără TVA" },
    { href: "/teren/rapoarte", label: "Rapoartele mele", hint: "Zilnic și săptămânal, de trimis prin Outlook" },
    { href: "/teren/cont", label: "Datele mele pe ofertă", hint: "Nume, telefon, email și semnătură" },
    { href: "/teren/ghid", label: "Ghid", hint: "Cum se face o vizită bună" },
  ];
  const birou: Item[] = [
    { href: "/oferte", label: "Oferte (birou)", hint: "Liste complete, editare, PDF" },
    { href: "/rapoarte", label: "Rapoarte (birou)", hint: "Rapoartele echipei, pe perioade" },
    { href: "/raport", label: "Analiza pieței", hint: "Obiecții, blocaje, modele discutate" },
    { href: "/clienti", label: "Clienți", hint: "Toate firmele, cu istoricul lor" },
    { href: "/setari", label: "Setări firmă", hint: "Date firmă, ținte, praguri" },
  ];

  return (
    <div>
      <PageHeader title="Mai mult" description={[organization.name, user.email].filter(Boolean).join(" · ")} />

      <Group title="Unelte" items={unelte} />
      {conducere ? <Group title="Birou" items={birou} /> : null}

      <form action={signOut} className="mt-6">
        <SubmitButton className="btn btn-secondary btn-lg w-full" pendingLabel="Se iese…">
          Ieși din cont
        </SubmitButton>
      </form>
    </div>
  );
}

function Group({ title, items }: { title: string; items: Item[] }) {
  return (
    <section className="mt-4">
      <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{title}</h2>
      <ul className="card divide-y divide-neutral-200">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="flex min-h-14 items-center gap-3 px-3.5 py-2.5 active:bg-neutral-50">
              <span className="flex-1">
                <span className="block font-medium">{i.label}</span>
                <span className="block text-xs text-neutral-500">{i.hint}</span>
              </span>
              <span aria-hidden className="text-neutral-500">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
