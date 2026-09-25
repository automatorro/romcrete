import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { supabaseConfigured, supabaseKey, supabaseUrl } from "@/lib/env";

/** Rute accesibile fără autentificare. */
const PUBLIC_PATHS = ["/", "/login", "/inregistrare", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)),
  );
}

/**
 * În Next.js 16 middleware-ul se numește proxy. Rolul lui aici este dublu:
 * reîmprospătează sesiunea Supabase (altfel expiră token-ul în Server Components)
 * și blochează rutele private pentru vizitatorii neautentificați.
 */
export async function proxy(request: NextRequest) {
  if (!supabaseConfigured) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Apelul trebuie făcut înainte de a genera răspunsul, ca token-ul reîmprospătat
  // să apuce să fie scris în cookie-uri.
  // getClaims reîmprospătează sesiunea când a expirat și verifică semnătura
  // token-ului local, fără să întrebe serverul de autentificare la fiecare click.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/inregistrare")) {
    return NextResponse.redirect(new URL("/oferte", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
