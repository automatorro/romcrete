"use client";

import { useActionState } from "react";

import { updateOptionValues } from "@/app/(app)/setari/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { QuestionOption } from "@/lib/teren";

type Group = { id: string; label: string; hint: string; options: QuestionOption[] };

/**
 * Pragurile numerice folosite în calcule. Sunt ipoteze despre piață, nu adevăruri:
 * manopera pe mp diferă de la o zonă la alta și de la an la an.
 */
export function PraguriForm({ groups }: { groups: Group[] }) {
  const [state, formAction] = useActionState(updateOptionValues, null);

  return (
    <form action={formAction} className="space-y-5">
      {groups.map((g) => (
        <fieldset key={g.id}>
          <legend className="text-sm font-medium text-neutral-900">{g.label}</legend>
          <p className="mb-2 text-xs text-neutral-500">{g.hint}</p>
          <div className="space-y-2">
            {g.options.map((o) => (
              <div key={o.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm text-neutral-700">{o.label}</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  name={`val_${g.id}_${o.id}`}
                  defaultValue={o.value ?? ""}
                  placeholder="nu intră în calcul"
                  className="input w-44 text-right tabular-nums"
                  aria-label={`Valoare pentru ${o.label}`}
                />
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <FormMessage state={state} />
      <SubmitButton>Salvează pragurile</SubmitButton>
    </form>
  );
}
