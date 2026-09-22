import { OrganizationForm } from "@/app/(app)/setari/organization-form";
import { requireOrg } from "@/lib/auth";

export const metadata = { title: "Setări firmă" };

export default async function SettingsPage() {
  const { organization, role } = await requireOrg();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Setări firmă</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Datele apar în antetul fiecărei oferte tipărite. Rolul tău: {role}.
        </p>
      </header>

      <div className="card p-6">
        <OrganizationForm organization={organization} />
      </div>
    </div>
  );
}
