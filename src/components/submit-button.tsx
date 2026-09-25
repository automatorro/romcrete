"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  /** Mesaj de confirmare înainte de trimitere (util pentru ștergeri). */
  confirm?: string;
  /** Id-ul formularului, când butonul este în afara lui (ex. celule de tabel). */
  form?: string;
  /** Trimite același formular către alt Server Action. */
  formAction?: (formData: FormData) => void | Promise<void>;
  /** Butoane diferite ale aceluiași formular trimit valori diferite pe același nume. */
  name?: string;
  value?: string;
};

export function SubmitButton({
  children,
  pendingLabel = "Se salvează…",
  className = "btn btn-primary",
  confirm,
  form,
  formAction,
  name,
  value,
}: Props) {
  // `pending` este raportat doar pentru butoanele aflate în interiorul formularului.
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      form={form}
      formAction={formAction}
      name={name}
      value={value}
      className={className}
      disabled={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
