import type { ActionState } from "@/lib/validation";

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.error && !state?.success) return null;

  const isError = Boolean(state.error);

  return (
    <p
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
      }
    >
      {state.error ?? state.success}
    </p>
  );
}
