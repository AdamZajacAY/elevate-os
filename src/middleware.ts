import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * Middleware sprawdza wylacznie obecnosc sesji (edge, bez dostepu do bazy).
 * Rola i status konta czytane sa swiezo z bazy w `requireUser()` — dezaktywacja
 * konta dziala natychmiast, bez czekania na wygasniecie tokenu (spec 06).
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  if (pathname === "/login") {
    if (isLoggedIn) return Response.redirect(new URL("/dashboard", req.nextUrl));
    return;
  }
  if (!isLoggedIn) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  // Trzy trasy sa poza sesja celowo, bo autoryzuja sie same:
  //  - `api/calendar`  — kalendarz zewnetrzny, token w adresie,
  //  - `api/cron`      — scheduler, naglowek z sekretem,
  //  - `api/google/calendar/callback` — powrot ze zgody Google, podpisany `state`.
  // Powrot z domeny Google przychodzi bez gwarancji ciasteczka sesji, a middleware
  // odsylal go na /login, przez co trasa nigdy nie wykonywala wlasnej obslugi
  // (ani weryfikacji `state`, ani komunikatu o odmowie zgody).
  matcher: [
    "/((?!api/auth|api/calendar|api/cron|api/google/calendar/callback|_next/static|_next/image|favicon.ico|.*\\.svg$).*)",
  ],
};
