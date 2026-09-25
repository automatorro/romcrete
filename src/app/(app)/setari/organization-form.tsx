"use client";

import { useActionState } from "react";

import { updateOrganization } from "@/app/(app)/setari/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { Organization } from "@/lib/types";

const FIELDS: { name: keyof Organization; label: string; placeholder?: string; wide?: boolean }[] = [
  { name: "name", label: "Denumirea firmei *", wide: true },
  { name: "cui", label: "CUI", placeholder: "RO12345678" },
  { name: "reg_com", label: "Nr. Reg. Com.", placeholder: "J12/345/2020" },
  { name: "address", label: "Adresă", wide: true },
  { name: "city", label: "Localitate" },
  { name: "county", label: "Județ" },
  { name: "phone", label: "Telefon" },
  { name: "email", label: "Email" },
  { name: "iban", label: "IBAN" },
  { name: "bank", label: "Bancă" },
];

export function OrganizationForm({ organization }: { organization: Organization }) {
  const [state, formAction] = useActionState(updateOrganization, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
            <label className="label" htmlFor={field.name}>
              {field.label}
            </label>
            <input
              id={field.name}
              name={field.name}
              required={field.name === "name"}
              placeholder={field.placeholder}
              defaultValue={(organization[field.name] as string | null) ?? ""}
              className="input"
            />
          </div>
        ))}

        <div>
          <label className="label" htmlFor="vat_rate">
            Cotă TVA implicită (%)
          </label>
          <input
            id="vat_rate"
            name="vat_rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={organization.vat_rate}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="target_visits_per_day">
            Țintă vizite pe zi
          </label>
          <input
            id="target_visits_per_day"
            name="target_visits_per_day"
            type="number"
            step="1"
            min="0"
            defaultValue={organization.target_visits_per_day}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="target_quotes_per_month">
            Țintă oferte pe lună
          </label>
          <input
            id="target_quotes_per_month"
            name="target_quotes_per_month"
            type="number"
            step="1"
            min="0"
            defaultValue={organization.target_quotes_per_month}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="recontact_days_warm">
            Reluare firmă caldă (zile)
          </label>
          <input
            id="recontact_days_warm"
            name="recontact_days_warm"
            type="number"
            step="1"
            min="1"
            defaultValue={organization.recontact_days_warm}
            className="input"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Caldă = vrea ofertă, e gata de cumpărare, sau e în „Urmărește acum”.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="recontact_days_cold">
            Reluare firmă rece (zile)
          </label>
          <input
            id="recontact_days_cold"
            name="recontact_days_cold"
            type="number"
            step="1"
            min="1"
            defaultValue={organization.recontact_days_cold}
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="productivity_factor">
            Randament mecanizat — valoare de rezervă
          </label>
          <input
            id="productivity_factor"
            name="productivity_factor"
            type="number"
            step="0.1"
            min="1.1"
            max="10"
            defaultValue={organization.productivity_factor}
            className="input"
          />
          <p className="mt-1 text-xs text-neutral-500">
            De câte ori se aplică mai mult material cu pompa. Calculul folosește randamentul
            domeniului firmei vizitate — cel de mai jos; asta e valoarea folosită doar dacă
            firma n-a fost încadrată în niciun domeniu.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="working_days_per_month">
            Zile lucrate pe lună
          </label>
          <input
            id="working_days_per_month"
            name="working_days_per_month"
            type="number"
            step="1"
            min="1"
            max="31"
            defaultValue={organization.working_days_per_month}
            className="input"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="join_domains">
            Domenii de email cu acces
          </label>
          <input
            id="join_domains"
            name="join_domains"
            defaultValue={(organization.join_domains ?? []).join(", ")}
            placeholder="romcrete.ro"
            className="input"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Cine își face cont cu o adresă de pe aceste domenii intră automat ca agent, fără
            invitație. Restul primesc refuz. Lista goală înseamnă că nimeni nu se mai poate
            înscrie singur.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="websites">
            Site-uri (în subsolul ofertei)
          </label>
          <input
            id="websites"
            name="websites"
            defaultValue={organization.websites ?? ""}
            placeholder="www.romcrete-echipamente.ro   www.shop.romcrete.ro"
            className="input"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label" htmlFor="quote_terms">
            Condiții și termene de plată standard
          </label>
          <textarea
            id="quote_terms"
            name="quote_terms"
            rows={5}
            defaultValue={organization.quote_terms ?? ""}
            placeholder={"Disponibilitate: pe stoc, livrare în 48–72h de la plata avansului\nGaranție echipamente: 24 luni\nPlată: 80% înainte de livrare, 20% în maxim 30 de zile\nModalitate de plată: Ordin de plată (OP)\nLivrare: Gratuită pe teritoriul României"}
            className="input"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Câte una pe rând, de forma „Garanție echipamente: 24 luni”. Se pun pe prima ofertă a unui client nou;
            ofertele următoare ale clientului preiau condițiile din ultima lui ofertă.
          </p>
        </div>
      </div>

      <FormMessage state={state} />

      <SubmitButton className="btn btn-ok">Salvează datele firmei</SubmitButton>
    </form>
  );
}
