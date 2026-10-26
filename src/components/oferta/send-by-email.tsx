"use client";

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

  const markSent = () => {
    void markQuoteEmailed(quoteId).catch(() => {});
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
      <a href={mailto} onClick={markSent} className="btn btn-primary btn-lg w-full justify-start">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
          2
        </span>
        Deschide Outlook
      </a>
      <p className="text-xs text-neutral-500">
        {clientEmail
          ? `Se deschide aplicația de email implicită a dispozitivului. Setează Outlook ca aplicație implicită pentru email ca să se deschidă direct acolo. Emailul către ${clientEmail} are subiectul și textul completate.`
          : "Firma nu are email în fișă: completează destinatarul în Outlook după deschidere. Setează Outlook ca aplicație implicită pentru email."}{" "}
        Atașează PDF-ul descărcat la pasul 1; pe telefon îl găsești în Descărcări și îl alegi din agrafa emailului.{" "}
        Trimiterea se notează în istoricul firmei, iar o ciornă trece în „Trimisă”.
      </p>
    </div>
  );
}
