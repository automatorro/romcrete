import type { ActionState } from "@/lib/validation";

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.error && !state?.success) return null;

  const isError = Boolean(state.error);

  return (
    <p
      role={isError ? "alert" : "status"}
      className={isError ? "notice-error" : "notice-ok"}
    >
      {state.error ?? state.success}
    </p>
  );
}
