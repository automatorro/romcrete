import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chrome-ul care generează PDF-ul ofertei rulează ca pachet Node, nu împachetat.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // Binarul Chrome se citește de pe disc la rulare; trebuie copiat explicit lângă funcție.
  outputFileTracingIncludes: {
    "/print/oferta/**": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
