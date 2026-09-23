"use client";

import { useActionState } from "react";

import { updateDomainParams } from "@/app/(app)/setari/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export type DomainRow = {
  id: string;
  label: string;
  unit_label: string;
  /** Randamentul de piață, cel scris în catalogul de domenii. */
  base: number;
  /** Ce a pus firma în loc, dacă a pus ceva. */
  override: number | null;
  active: boolean;
};

/**
 * Domeniile în care lucrează clienții firmei.
 *
 * Randamentul mecanizat față de manual nu e același peste tot: la marcaje
 * rutiere mașina schimbă ordinul de mărime, la un atelier auto abia dublează.
 * Cifrele sunt ipoteze de piață, iar cine le vede infirmate pe teren le schimbă
 * de aici, fără deploy.
 */
export function DomeniiForm({ domains }: { domains: DomainRow[] }) {
  const [state, formAction] = useActionState(updateDomainParams, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-3">
        {domains.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-3 last:border-0">
            <label className="flex flex-1 items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={`activ_${d.id}`}
                defaultChecked={d.active}
                className="size-4"
              />
              <span>
                <span className="font-medium text-neutral-900">{d.label}</span>
                <span className="block text-xs text-neutral-500">se măsoară în {d.unit_label}</span>
              </span>
            </label>
            <input
              type="number"
              step="0.1"
              min="1"
              max="20"
              name={`rand_${d.id}`}
              defaultValue={d.override ?? ""}
              placeholder={`${d.base}×`}
              className="input w-32 text-right tabular-nums"
              aria-label={`Randament mecanizat pentru ${d.label}`}
            />
          </div>
        ))}
      </div>

      <p className="text-xs text-neutral-500">
        Câmpul gol înseamnă că se folosește randamentul de piață, scris ca sugestie în căsuță.
        Debifarea scoate domeniul din listele agenților, fără să șteargă firmele deja încadrate acolo.
      </p>

      <FormMessage state={state} />
      <SubmitButton>Salvează domeniile</SubmitButton>
    </form>
  );
}
