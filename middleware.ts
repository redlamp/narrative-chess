import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Edge middleware. Currently only gates /admin behind the admin role.
 *
 * The page itself re-checks via hasRole() — middleware here is the cheap
 * outer gate so non-admins don't even start rendering the page. Both
 * checks pass through public.has_role() RPC so the storage shape stays
 * swappable.
 *
 * If/when more routes need server-side auth gates, expand the matcher
 * + role checks here. Keep the body small — runs on every request to
 * matched paths.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Misconfigured runtime — bounce to home, don't expose /admin.
    return NextResponse.redirect(new URL("/", request.url));
  }

  const supabase = createServerClient(url, anonKey, {
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
  });

  const { data, error } = await supabase.rpc("has_role", { target: "admin" });
  if (error || data !== true) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
