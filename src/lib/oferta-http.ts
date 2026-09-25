export const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/**
 * Răspunsul când oferta are produse fără poză: nu se generează nici PDF, nici
 * Word. Pagina spune ce lipsește; antetul `x-poze-lipsa` îl citește aplicația.
 */
export function missingPhotos(number: string, quoteId: string, missing: string[]) {
  const message = `Oferta ${number} nu se poate trimite: lipsește poza pentru ${missing.join(", ")}.`;
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">` +
      `<body style="font-family:system-ui;padding:24px;max-width:560px;margin:auto">` +
      `<h1 style="font-size:20px">Lipsesc poze</h1><p>${escapeHtml(message)}</p>` +
      `<p>Pune poza din pagina ofertei, la „Poze lipsă”, apoi încearcă din nou.</p>` +
      `<p><a href="/oferte/${quoteId}">Înapoi la ofertă</a></p></body>`,
    {
      status: 422,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-poze-lipsa": encodeURIComponent(missing.join(" | ")),
        "cache-control": "no-store",
      },
    },
  );
}

/** Numele fișierului ofertei, fără caractere pe care Windows sau telefonul nu le acceptă. */
export const offerFileName = (number: string, ext: "pdf" | "docx") =>
  `Oferta-${String(number).replace(/[^\w.-]+/g, "-")}.${ext}`;
