import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

/**
 * Transformă o pagină a aplicației în fișier PDF, „tipărind-o” cu un Chrome
 * fără fereastră. Folosește aceeași pagină de tipărire pe care o vede omul,
 * deci PDF-ul trimis e identic cu cel verificat.
 *
 * Pe server (Vercel) Chrome vine din @sparticuz/chromium; local se poate
 * folosi alt Chrome, dat în CHROMIUM_PATH.
 */
export async function renderPdf(url: string, cookies: { name: string; value: string }[]): Promise<Uint8Array> {
  const local = process.env.CHROMIUM_PATH;
  const browser = await puppeteer.launch({
    executablePath: local || (await chromium.executablePath()),
    args: local ? ["--no-sandbox", "--disable-dev-shm-usage"] : chromium.args,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    const { hostname } = new URL(url);
    // Pagina de tipărire cere autentificare: Chrome primește sesiunea celui care a cerut PDF-ul.
    if (cookies.length) {
      await browser.setCookie(...cookies.map((c) => ({ name: c.name, value: c.value, domain: hostname, path: "/" })));
    }
    await page.goto(url, { waitUntil: "networkidle0", timeout: 45_000 });
    // Pozele produselor vin din magazin; PDF-ul se face abia după ce s-au încărcat.
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((img) =>
          img.complete
            ? null
            : new Promise((resolve) => {
                // O poză care nu se încarcă nu blochează oferta: apare fără ea.
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              }),
        ),
      );
    });

    return await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }
}
