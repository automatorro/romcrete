import { AppShell } from "@/components/shell/app-shell";

/** Depinde de sesiune: se randează la fiecare cerere, niciodată prerandat. */
export const dynamic = "force-dynamic";

/** Biroul folosește același cadru ca terenul: meniu în stânga pe calculator, bara de jos pe telefon. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
