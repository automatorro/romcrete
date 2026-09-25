"use client";

import { useActionState } from "react";

import { saveOfferProfile } from "@/components/cont/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

/** Numele, telefonul și emailul de pe ofertele agentului. */
export function OfferProfileForm({
  fullName,
  phone,
  email,
  loginEmail,
}: {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  loginEmail: string | null;
}) {
  const [state, action] = useActionState(saveOfferProfile, null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="full_name">
          Numele pe ofertă *
        </label>
        <input id="full_name" name="full_name" required defaultValue={fullName ?? ""} placeholder="dl. Radu Lupan" className="input min-h-11" />
      </div>
      <div>
        <label className="label" htmlFor="phone">
          Telefon
        </label>
        <input id="phone" name="phone" type="tel" defaultValue={phone ?? ""} placeholder="0722 318 371" className="input min-h-11" />
      </div>
      <div>
        <label className="label" htmlFor="contact_email">
          Email
        </label>
        <input
          id="contact_email"
          name="contact_email"
          type="email"
          defaultValue={email ?? ""}
          placeholder={loginEmail ?? "nume@romcrete.ro"}
          className="input min-h-11"
        />
        <p className="mt-1 text-xs text-neutral-500">Gol: apare adresa cu care intri în aplicație.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-ok min-h-11">Salvează datele mele</SubmitButton>
    </form>
  );
}
