"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  /** Întrebarea de confirmare înainte de trimitere (util pentru ștergeri). */
  confirm?: string;
  /** Textul butonului care confirmă; implicit „Da, continuă”. */
  confirmLabel?: string;
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
  confirmLabel = "Da, continuă",
  form,
  formAction,
  name,
  value,
}: Props) {
  // `pending` este raportat doar pentru butoanele aflate în interiorul formularului.
  const { pending } = useFormStatus();
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);

  // O confirmare pentru ștergere are butonul roșu; restul, albastrul de brand.
  const danger = className.includes("danger");

  const accept = () => {
    confirmed.current = true;
    dialog.current?.close();
    // Al doilea clic trece de confirmare și păstrează tot ce poartă butonul:
    // formAction, name, value.
    button.current?.click();
    confirmed.current = false;
  };

  return (
    <>
      <button
        ref={button}
        type="submit"
        form={form}
        formAction={formAction}
        name={name}
        value={value}
        className={className}
        disabled={pending}
        onClick={(event) => {
          if (confirm && !confirmed.current) {
            event.preventDefault();
            dialog.current?.showModal();
          }
        }}
      >
        {pending ? pendingLabel : children}
      </button>

      {confirm ? (
        <dialog
          ref={dialog}
          className="m-auto w-[min(92vw,420px)] rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-900 shadow-xl backdrop:bg-neutral-900/40"
          onClick={(e) => {
            // Un clic pe fundalul din jur închide fereastra, ca „Renunță”.
            if (e.target === dialog.current) dialog.current?.close();
          }}
        >
          <p className="text-base font-semibold">{confirm}</p>
          <p className="mt-1 text-sm text-neutral-500">
            {danger ? "Acțiunea nu se poate anula din aplicație." : "Poți reveni oricând asupra ei."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => dialog.current?.close()}>
              Renunță
            </button>
            <button
              type="button"
              className={`btn btn-lg ${danger ? "btn-danger" : "btn-primary"}`}
              onClick={accept}
              autoFocus
            >
              {confirmLabel}
            </button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
