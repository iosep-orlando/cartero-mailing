import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/jwt";

// proxy.ts (el middleware de Next.js 16): antes de cada página decide por la
// sesión. Sin base de datos, para que sea rápido; las rutas de la API
// vuelven a comprobar, y además confirman en la base que el usuario sigue
// siendo miembro de la organización (lib/auth.ts).
//
//   /dashboard/…   sesión con organización elegida
//   /onboarding    sesión (para crear la primera organización)
//   /login         sin sesión (con sesión, al panel)
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const jwt = request.cookies.get(SESSION_COOKIE)?.value;
  const session = jwt ? await verifySession(jwt) : null;

  const redirect = (to: string) => {
    const response = NextResponse.redirect(new URL(to, request.url));
    if (jwt && !session) response.cookies.delete(SESSION_COOKIE); // vencida o alterada
    return response;
  };

  if (pathname === "/login") return session ? redirect(session.tid ? "/dashboard" : "/onboarding") : NextResponse.next();
  if (!session) {
    return redirect(pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname + search)}`);
  }
  if ((pathname === "/" || pathname.startsWith("/dashboard")) && !session.tid) return redirect("/onboarding");
  if (pathname === "/") return redirect("/dashboard");
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/onboarding", "/dashboard/:path*"],
};
