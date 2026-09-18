"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { Quote } from "@/lib/types";
import type { ActionState } from "@/lib/validation";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  clients: { id: string; name: string }[];
  quote?: Quote;
  defaultTerms?: string | null;
  submitLabel?: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const inDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export function QuoteForm({
  action,
  clients,
  quote,
  defaultTerms,
  submitLabel = "Salvează oferta",
}: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="client_id">
            Client *
          </label>
          <select
            id="client_id"
            name="client_id"
            required
            defaultValue={quote?.client_id ?? ""}
            className="input"
          >
            <option value="" disabled>
              Alege clientul
            </option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">
            Titlul ofertei
          </label>
          <input
            id="title"
            name="title"
            defaultValue={quote?.title ?? ""}
            placeholder="Furnizare beton — bloc rezidențial Nord"
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="issue_date">
            Data emiterii *
          </label>
          <input
            id="issue_date"
            name="issue_date"
            type="date"
            required
            defaultValue={quote?.issue_date ?? today()}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="valid_until">
            Valabilă până la
          </label>
          <input
            id="valid_until"
            name="valid_until"
            type="date"
            defaultValue={quote?.valid_until ?? inDays(30)}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="site_address">
            Adresa șantierului
          </label>
          <input
            id="site_address"
            name="site_address"
            defaultValue={quote?.site_address ?? ""}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="discount_pct">
            Discount pe ofertă (%)
          </label>
          <input
            id="discount_pct"
            name="discount_pct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={quote?.discount_pct ?? 0}
            className="input"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">
            Observații pentru client
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={quote?.notes ?? ""}
            className="input"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="terms">
            Condiții comerciale
          </label>
          <textarea
            id="terms"
            name="terms"
            rows={3}
            defaultValue={quote?.terms ?? defaultTerms ?? ""}
            placeholder="Plata în 15 zile de la livrare. Prețurile nu includ transportul."
            className="input"
          />
        </div>
      </div>

      <FormMessage state={state} />

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
