import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getCurrentUser, type CurrentUser } from "@/server/session";
import { canRead, type ModuleKey } from "@/lib/rbac";

/** Standardowe odpowiedzi bledu — jeden ksztalt dla calego API. */
export function fail(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Opakowanie trasy API: swieza autoryzacja + kontrola dostepu do modulu.
 * Handler dostaje zweryfikowanego uzytkownika, nigdy surowej sesji.
 */
export function withAuth<T>(
  module: ModuleKey,
  handler: (user: CurrentUser, req: Request, ctx: T) => Promise<Response>,
) {
  return async (req: Request, ctx: T): Promise<Response> => {
    const user = await getCurrentUser();
    if (!user) return fail(401, "Wymagane logowanie");
    if (!canRead(user.role, module)) return fail(403, "Brak uprawnien do modulu");
    try {
      return await handler(user, req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        return fail(422, "Nieprawidlowe dane", err.issues);
      }
      console.error(`[API ${module}]`, err);
      return fail(500, "Blad serwera");
    }
  };
}

/** Parsuje i waliduje cialo zadania; blad walidacji lapie `withAuth`. */
export async function parseBody<S extends ZodType>(req: Request, schema: S) {
  const json = await req.json().catch(() => ({}));
  return schema.parse(json) as S["_output"];
}
