"use client";

import { useActionState } from "react";

import { setNewsletterPrefs } from "@/app/(app)/newsletter/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

const OPTIONS = [
  { value: "", label: "Automat", hint: "emailul, dacă îl are" },
  { value: "email", label: "Email", hint: "" },
  { value: "whatsapp", label: "WhatsApp", hint: "" },
] as const;

/** În fișa firmei: pe ce canal vrea newsletterele și dacă a cerut să nu le mai primească. */
export function NewsletterPrefs({
  clientId,
  channel,
  optOut,
}: {
  clientId: string;
  channel: "email" | "whatsapp" | null;
  optOut: boolean;
}) {
  const [state, action] = useActionState(setNewsletterPrefs.bind(null, clientId), null);

  return (
    <form action={action} className="space-y-3">
      <fieldset>
        <legend className="label">Newslettere și anunțuri pe</legend>
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className="chip flex-col justify-center rounded-xl text-center has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:text-white"
            >
              <input
                type="radio"
                name="preferred_channel"
                value={o.value}
                defaultChecked={(channel ?? "") === o.value}
                className="sr-only"
              />
              <span>{o.label}</span>
              {o.hint ? <span className="text-[11px] opacity-80">{o.hint}</span> : null}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="newsletter_opt_out" defaultChecked={optOut} className="h-5 w-5" />
        A cerut să nu mai primească newslettere
      </label>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-secondary btn-sm">Salvează preferința</SubmitButton>
    </form>
  );
}
