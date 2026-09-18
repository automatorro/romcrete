"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/validation";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel: string;
  redirectTo?: string;
  passwordHint?: string;
};

export function CredentialsForm({
  action,
  submitLabel,
  pendingLabel,
  redirectTo,
  passwordHint,
}: Props) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}

      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="nume@firma.ro"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Parolă
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={submitLabel === "Creează cont" ? "new-password" : "current-password"}
          className="input"
          placeholder="••••••••"
        />
        {passwordHint ? <p className="mt-1 text-xs text-concrete-500">{passwordHint}</p> : null}
      </div>

      <FormMessage state={state} />

      <SubmitButton className="btn btn-primary w-full" pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
