import { AppShell } from "@/components/shell/app-shell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { default: "Teren", template: "%s · Teren Romcrete" },
};

/** Terenul folosește același cadru ca biroul: meniu în stânga pe calculator, bara de jos pe telefon. */
export default function TerenLayout({ children }: LayoutProps<"/teren">) {
  return <AppShell>{children}</AppShell>;
}
