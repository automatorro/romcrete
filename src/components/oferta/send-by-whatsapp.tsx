"use client";

import { useState } from "react";

import { markQuoteWhatsApp } from "@/app/(app)/oferte/actions";

type State = "idle" | "preparing" | "ready" | "error" | "sent";

/**
 * Trimiterea ofertei pe WhatsApp, cu PDF-ul atașat. În doi timpi, pentru că
 * telefonul (mai ales iPhone-ul) deschide meniul de partajare doar imediat după
 * o apăsare, iar PDF-ul durează câteva secunde să se genereze:
 *   1. „Pregătește PDF-ul” îl generează pe server;
 *   2. „Deschide WhatsApp” deschide partajarea: alegi WhatsApp, apoi clientul.
 * Unde partajarea cu fișier nu există (unele calculatoare), PDF-ul se descarcă
 * și se deschide WhatsApp, ca fișierul să fie atașat de mână.
 */
export function SendByWhatsApp({
  quoteId,
  number,
  clientName,
  orgName,
}: {
  quoteId: string;
  number: string;
  clientName: string | null;
  orgName: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [fallback, setFallback] = useState(false);
  const [missing, setMissing] = useState("");

  const text = `Bună ziua, vă trimit oferta ${number}${clientName ? ` pentru ${clientName}` : ""}. Pentru orice întrebare, vă stau la dispoziție.\n${orgName}`;

  const prepare = async () => {
    setState("preparing");
    setMissing("");
    try {
      const res = await fetch(`/print/oferta/${quoteId}/pdf`);
      // Fără poze oferta nu pleacă: serverul spune ce produse n-au poză.
      if (res.status === 422) {
        setMissing(decodeURIComponent(res.headers.get("x-poze-lipsa") ?? "").split(" | ").join(", "));
        setState("error");
        return;
      }
      // Cu sesiunea expirată serverul întoarce pagina de login, nu un PDF: nu o trimitem clientului.
      if (!res.ok || !res.headers.get("content-type")?.includes("application/pdf")) {
        throw new Error(String(res.status));
      }
      const blob = await res.blob();
      setFile(new File([blob], `Oferta-${number.replace(/[^\w.-]+/g, "-")}.pdf`, { type: "application/pdf" }));
      setState("ready");
    } catch {
      setState("error");
    }
  };

  const send = async () => {
    if (!file) return;
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text, title: `Oferta ${number}` });
        await markQuoteWhatsApp(quoteId);
        setState("sent");
        return;
      } catch (e) {
        // Agentul a închis meniul de partajare: nu s-a trimis nimic, nu notăm nimic.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }

    // Rezerva: PDF-ul se descarcă, WhatsApp se deschide cu mesajul scris, iar fișierul se atașează de mână.
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    setFallback(true);
    await markQuoteWhatsApp(quoteId);
    setState("sent");
  };

  return (
    <div className="space-y-2">
      {state === "idle" || state === "preparing" || state === "error" ? (
        <button
          type="button"
          onClick={prepare}
          disabled={state === "preparing"}
          className="btn btn-secondary btn-lg w-full justify-start"
        >
          <WhatsAppIcon />
          {state === "preparing" ? "Se pregătește PDF-ul… (câteva secunde)" : "Trimite pe WhatsApp"}
        </button>
      ) : (
        <button type="button" onClick={send} className="btn btn-ok btn-lg w-full justify-start">
          <WhatsAppIcon />
          {state === "sent" ? "Trimite din nou pe WhatsApp" : "Deschide WhatsApp"}
        </button>
      )}

      <p className="text-xs text-neutral-500" role={state === "error" ? "alert" : undefined}>
        {state === "error"
          ? missing
            ? `Oferta nu pleacă fără poze: lipsește poza pentru ${missing}. Pune-o mai sus, la „Poze lipsă”.`
            : "PDF-ul nu s-a putut pregăti. Verifică semnalul (sau reintră în cont) și încearcă din nou."
          : state === "ready"
            ? "PDF-ul e gata. Apasă mai sus, alege WhatsApp, apoi clientul din lista ta; oferta e deja atașată."
            : state === "sent"
              ? fallback
                ? "PDF-ul s-a descărcat și s-a deschis WhatsApp: alege clientul și atașează fișierul descărcat. Trimiterea e notată în istoric."
                : "Trimisă. Trimiterea e notată în istoricul firmei, iar o ciornă a trecut în „Trimisă”."
              : "Se pregătește PDF-ul ofertei, apoi se deschide WhatsApp cu el atașat, iar tu alegi clientul."}
      </p>
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="currentColor">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.2-.3-.3-.5-.4Z" />
    </svg>
  );
}
