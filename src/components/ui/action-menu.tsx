"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

/**
 * Meniul „⋯” al unui rând sau al unei pagini: acțiunile rare sau periculoase
 * stau aici, nu împrăștiate pe ecran. Conținutul sunt linkuri sau formulare cu
 * clasa `menu-item`; ștergerile poartă și `menu-item-danger`.
 */
export function ActionMenu({
  label = "Mai multe acțiuni",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Meniul stă pe ecran, nu în tabel: la derulare s-ar dezlipi de buton, deci se închide.
    const hide = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          if (open) return setOpen(false);
          // Poziție fixă pe ecran, ca tabelele cu derulare orizontală să nu taie meniul;
          // în jumătatea de jos a ecranului se deschide în sus.
          const r = e.currentTarget.getBoundingClientRect();
          const right = window.innerWidth - r.right;
          setPlace(
            r.bottom > window.innerHeight * 0.6
              ? { right, bottom: window.innerHeight - r.top + 4 }
              : { right, top: r.bottom + 4 },
          );
          setOpen(true);
        }}
        className="btn btn-secondary min-h-10 min-w-10 px-2 text-lg leading-none"
      >
        ⋯
      </button>
      {open ? (
        <div
          id={id}
          role="menu"
          style={place}
          className="fixed z-40 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
