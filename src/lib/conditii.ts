import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Condițiile de plată pentru o ofertă nouă: fiecare client are condițiile lui,
 * deci se preiau din ultima lui ofertă; o firmă fără oferte primește
 * condițiile standard din Setări.
 */
export async function termsForClient(db: Db, clientId: string | null, fallback: string | null) {
  if (!clientId) return fallback;
  const { data } = await db
    .from("quotes")
    .select("terms")
    .eq("client_id", clientId)
    .not("terms", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.terms as string | null | undefined) ?? fallback;
}
