import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { supabaseKey, supabaseUrl } from "@/lib/env";

/**
 * Client Supabase pentru Server Components, Server Actions și Route Handlers.
 * Se creează câte unul per cerere — nu îl păstra în afara handler-ului.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Apel dintr-un Server Component: cookie-urile nu pot fi scrise aici.
          // Reîmprospătarea sesiunii se face în proxy.ts, deci se poate ignora.
        }
      },
    },
  });
}
