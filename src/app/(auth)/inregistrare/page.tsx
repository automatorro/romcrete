import Link from "next/link";

import { signUp } from "@/app/(auth)/actions";
import { CredentialsForm } from "@/app/(auth)/credentials-form";

export const metadata = { title: "Cont nou" };

export default function RegisterPage() {
  return (
    <div className="card space-y-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-concrete-900">Creează cont</h1>
        <p className="mt-1 text-sm text-concrete-500">
          După înregistrare îți configurezi datele firmei.
        </p>
      </div>

      <CredentialsForm
        action={signUp}
        submitLabel="Creează cont"
        pendingLabel="Se creează contul…"
        passwordHint="Minimum 8 caractere."
      />

      <p className="text-center text-sm text-concrete-500">
        Ai deja cont?{" "}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Intră în cont
        </Link>
      </p>
    </div>
  );
}
