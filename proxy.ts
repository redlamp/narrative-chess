import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16.2 proxy (formerly middleware). Runs on every matched request.
 *
 * Two jobs:
 *  1. Refresh the Supabase session cookie via updateSession() so the user's
 *     auth state stays current across navigations.
 *  2. Gate /admin/:path* on the admin role. Non-admins get redirected to /
 *     before any rendering happens. The /admin page also re-checks at the
 *     server-component level — this is the cheap outer gate.
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const blocked = await checkAdminGate(request);
    if (blocked) return blocked;
  }
  return await updateSession(request);
}

async function checkAdminGate(
  request: NextRequest,
): Promise<NextResponse | null> {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.rpc("has_role", { target: "admin" });
  if (error || data !== true) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return null;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
