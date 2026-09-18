import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Romcrete — Ofertare și devize",
    template: "%s · Romcrete",
  },
  description:
    "Aplicație de ofertare și devize pentru firme de betoane și construcții: catalog de produse, oferte numerotate automat și export PDF.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
