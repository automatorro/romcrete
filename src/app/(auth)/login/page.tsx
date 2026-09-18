import Link from "next/link";

import { signIn } from "@/app/(auth)/actions";
import { CredentialsForm } from "@/app/(auth)/credentials-form";

export const metadata = { title: "Autentificare" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { redirectTo } = await props.searchParams;

  return (
    <div className="card space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-concrete-900">Intră în cont</h1>
        <p className="mt-1 text-sm text-concrete-500">
          Continuă cu ofertele firmei tale.
        </p>
      </div>

      <CredentialsForm
        action={signIn}
        submitLabel="Intră în cont"
        pendingLabel="Se verifică…"
        redirectTo={typeof redirectTo === "string" ? redirectTo : undefined}
      />

      <p className="text-center text-sm text-concrete-500">
        Nu ai cont?{" "}
        <Link href="/inregistrare" className="font-medium text-brand-700 hover:underline">
          Creează unul
        </Link>
      </p>
    </div>
  );
}
