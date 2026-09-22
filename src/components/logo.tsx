/**
 * Sigla Romcrete, servită de pe magazin.
 *
 * Se încarcă din shop.romcrete.ro pentru că fișierul nu se află în proiect.
 * Dacă vrei aplicația independentă de magazin — și oferta tipărită sigură
 * chiar când shop-ul e indisponibil — pune logo.svg în `public/` și schimbă
 * LOGO_SRC în "/logo.svg". Restul aplicației nu se atinge.
 */
export const LOGO_SRC = "https://shop.romcrete.ro/public/img/logo.svg";

export function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    // next/image nu aduce nimic pentru un SVG servit de pe alt domeniu.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={LOGO_SRC} alt="Romcrete" className={className} />
  );
}
