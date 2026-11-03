"use client";

import { useState } from "react";

import { logContactFromList } from "@/app/teren/actions";
import { SubmitButton } from "@/components/submit-button";
import { shortDay } from "@/lib/agenda";
import { HISTORY_LABELS } from "@/lib/istoric";

const CONTACT_KINDS = ["telefon", "email", "whatsapp"] as const;

export function ContactFromListForm({
  day,
  clients,
}: {
  day: string;
  clients: { id: string; name: string; city: string | null }[];
}) {
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  return (
    <form
      action={async (formData) => {
        const result = await logContactFromList(formData);
        setNotice(
          result.ok
            ? { text: "Contactarea a fost salvată în istoricul firmei.", error: false }
            : { text: result.error, error: true },
        );
      }}
      className="card mb-2 space-y-3 p-3"
    >
      <input type="hidden" name="date" value={day} />
      {clients.length ? (
        <>
          <div>
            <label htmlFor={`firma-${day}`} className="label">
              Firma
            </label>
            <select id={`firma-${day}`} name="client_id" required className="input" defaultValue="">
              <option value="" disabled>
                Alege firma
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                  {client.city ? ` · ${client.city}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Felul contactului">
            {CONTACT_KINDS.map((kind, index) => (
              <label
                key={kind}
                className="chip justify-center rounded-xl has-checked:border-brand-600 has-checked:bg-brand-600 has-checked:text-white"
              >
                <input type="radio" name="kind" value={kind} defaultChecked={index === 0} className="sr-only" />
                {HISTORY_LABELS[kind]}
              </label>
            ))}
          </div>
          <textarea name="body" rows={2} placeholder="Ce s-a discutat (opțional)" className="input" />
          <SubmitButton className="btn btn-ok btn-lg w-full" pendingLabel="Se salvează…">
            Salvează pe {shortDay(day)}
          </SubmitButton>
          <p className="text-xs text-neutral-500">
            Firma nouă? Trece întâi o vizită sau adaug-o din „＋ Vizită”, apoi notează contactul.
          </p>
        </>
      ) : (
        <p className="text-sm text-neutral-500">
          Încă nicio firmă. Adaugă firma din „＋ Vizită”, apoi notează contactul.
        </p>
      )}
      {notice ? (
        <p role={notice.error ? "alert" : "status"} className={notice.error ? "text-sm text-red-700" : "text-sm text-green-700"}>
          {notice.text}
        </p>
      ) : null}
    </form>
  );
}
