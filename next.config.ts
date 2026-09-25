import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chrome-ul care generează PDF-ul ofertei rulează ca pachet Node, nu împachetat.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "sharp"],
  // Binarul Chrome se citește de pe disc la rulare; trebuie copiat explicit lângă funcție.
  outputFileTracingIncludes: {
    "/print/oferta/**": ["./node_modules/@sparticuz/chromium/bin/**", "./public/oferta/**"],
  },
  // Pozele de produs se încarcă micșorate (sub ~1 MB în base64); limita implicită de 1 MB e prea strâmtă.
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
