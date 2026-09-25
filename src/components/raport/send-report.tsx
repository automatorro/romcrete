"use client";

import { useState } from "react";

import { markReportSent } from "@/app/(app)/rapoarte/actions";

/**
 * Trimiterea raportului prin Outlook-ul firmei: PDF-ul se descarcă, apoi se
 * deschide un email completat către destinatarii salvați. PDF-ul se atașează
 * de mână, pentru că un link „mailto:” nu poate atașa fișiere.
 */
export function SendReport({
  id,
  recipients,
  subject,
  body,
}: {
  id: string;
  recipients: string[];
  subject: string;
  body: string;
}) {
  const [opening, setOpening] = useState(false);
  const mailto = `mailto:${recipients.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const open = async () => {
    setOpening(true);
    try {
      await markReportSent(id);
    } finally {
      setOpening(false);
      window.location.href = mailto;
    }
  };

  return (
    <div className="space-y-2">
      <a href={`/print/raport/${id}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-lg w-full justify-start">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold">1</span>
        Descarcă PDF-ul
      </a>
      <button type="button" onClick={open} disabled={opening} className="btn btn-primary btn-lg w-full justify-start">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">2</span>
        {opening ? "Se deschide…" : "Scrie emailul în Outlook"}
      </button>
      <p className="text-xs text-neutral-500">
        {recipients.length
          ? `Către ${recipients.join(", ")}. `
          : "Nu ai destinatari salvați: îi completezi în Outlook sau mai sus, la „Destinatari”. "}
        Emailul are rezumatul și indicatorii în text; atașează PDF-ul de la pasul 1. Salvează raportul înainte, ca
        textul să fie cel final.
      </p>
    </div>
  );
}
