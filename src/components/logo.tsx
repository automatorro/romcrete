/**
 * Sigla Romcrete, din proiect (`public/oferta/sigla.png`): se vede și când
 * magazinul nu răspunde, și e aceeași pe ofertă și în aplicație.
 */
export const LOGO_SRC = "/oferta/sigla.png";

export function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LOGO_SRC} alt="Romcrete" className={className} />
  );
}
