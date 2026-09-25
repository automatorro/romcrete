"use client";

import { useState } from "react";

import { markQuoteEmailed } from "@/app/(app)/oferte/actions";

/**
 * Trimiterea ofertei prin Outlook-ul firmei, în doi pași: PDF-ul se descarcă,
 * apoi se deschide un email gata completat, la care PDF-ul se atașează de mână.
 * Un link „mailto:” nu poate atașa fișiere, deci pasul 1 nu se poate sări.
 */
export function SendByEmail({
  quoteId,
  number,
  clientName,
  clientEmail,
  orgName,
}: {
  quoteId: string;
  number: string;
  clientName: string | null;
  clientEmail: string | null;
  orgName: string;
}) {
  const [opening, setOpening] = useState(false);

  const subject = `Oferta ${number} – ${orgName}`;
  const body = [
    "Bună ziua,",
    "",
    `Vă trimit atașat oferta ${number}${clientName ? ` pentru ${clientName}` : ""}.`,
    "Pentru orice întrebare sau ajustare, vă stau la dispoziție.",
    "",
    "Cu stimă,",
  ].join("\n");
  const mailto = `mailto:${clientEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const open = async () => {
    setOpening(true);
    try {
      await markQuoteEmailed(quoteId);
    } finally {
      setOpening(false);
      window.location.href = mailto;
    }
  };

  return (
    <div className="space-y-2">
      {/* PDF-ul se generează pe server și se descarcă direct, gata de atașat. */}
      <a href={`/print/oferta/${quoteId}/pdf`} className="btn btn-secondary btn-lg w-full justify-start">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold">
          1
        </span>
        Descarcă PDF-ul
      </a>
      <button type="button" onClick={open} disabled={opening} className="btn btn-primary btn-lg w-full justify-start">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
          2
        </span>
        {opening ? "Se deschide…" : "Scrie emailul în Outlook"}
      </button>
      <p className="text-xs text-neutral-500">
        {clientEmail
          ? `Se deschide un email către ${clientEmail}, cu subiectul și textul completate. Atașează PDF-ul de la pasul 1.`
          : "Firma nu are email în fișă: completează destinatarul în Outlook și atașează PDF-ul de la pasul 1."}{" "}
        Trimiterea se notează în istoricul firmei, iar o ciornă trece în „Trimisă”.
      </p>
    </div>
  );
}
