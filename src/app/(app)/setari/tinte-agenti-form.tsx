"use client";

import { useActionState } from "react";

import { updateAgentTargets } from "@/app/(app)/setari/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export type AgentTarget = {
  user_id: string;
  full_name: string | null;
  role: string;
  target_visits_per_day: number | null;
  target_quotes_per_month: number | null;
};

/** Ținte personale. Gol = se folosește ținta firmei, deci nu trebuie completat nimic. */
export function TinteAgentiForm({ agents }: { agents: AgentTarget[] }) {
  const [state, formAction] = useActionState(updateAgentTargets, null);

  if (agents.length === 0) {
    return <p className="text-sm text-neutral-500">Încă niciun coleg în firmă.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="py-2">Persoană</th>
              <th className="py-2 text-right">Vizite / zi</th>
              <th className="py-2 text-right">Oferte / lună</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.user_id} className="border-b border-neutral-100 last:border-0">
                <td className="py-2">
                  {a.full_name ?? "Fără nume"}
                  <span className="ml-2 text-xs text-neutral-500">{a.role}</span>
                </td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name={`vizite_${a.user_id}`}
                    defaultValue={a.target_visits_per_day ?? ""}
                    placeholder="ca firma"
                    className="input w-28 text-right tabular-nums"
                    aria-label={`Vizite pe zi pentru ${a.full_name ?? "agent"}`}
                  />
                </td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name={`oferte_${a.user_id}`}
                    defaultValue={a.target_quotes_per_month ?? ""}
                    placeholder="ca firma"
                    className="input w-28 text-right tabular-nums"
                    aria-label={`Oferte pe lună pentru ${a.full_name ?? "agent"}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormMessage state={state} />
      <SubmitButton>Salvează țintele</SubmitButton>
    </form>
  );
}
