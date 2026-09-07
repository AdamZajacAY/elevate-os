import { withAuth, fail } from "@/server/api";
import { isAdmin } from "@/lib/rbac";
import { exportUserData, exportClientData, logGdprRequest } from "@/server/services/gdpr";
import { audit } from "@/server/services/audit";

/**
 * Prawo dostepu i przenoszenia (RODO art. 15 i 20).
 *
 * Kazdy moze pobrac wlasne dane bez pytania Administratora — to prawo podmiotu,
 * nie przywilej. Dane cudze i dane klientow wydaje wylacznie Administrator.
 */
export const GET = withAuth("dashboard", async (user, req) => {
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject") ?? "USER";
  const id = url.searchParams.get("id") ?? user.id;

  if (subject === "USER") {
    if (id !== user.id && !isAdmin(user.role)) {
      return fail(403, "Dane innego uzytkownika wydaje Administrator");
    }

    const data = await exportUserData(id);
    if (!data) return fail(404, "Konto nie istnieje");

    await logGdprRequest({
      kind: "EXPORT",
      subjectType: "USER",
      subjectId: id,
      subjectLabel: data.konto.email,
      requestedById: user.id,
    });
    await audit(user.id, "GDPR_EXPORT", "user", id);
    return jsonAttachment(data, `elevate-dane-konta-${id.slice(0, 8)}.json`);
  }

  if (subject === "CLIENT") {
    if (!isAdmin(user.role)) return fail(403, "Dane klienta wydaje Administrator");

    const data = await exportClientData(id);
    if (!data) return fail(404, "Klient nie istnieje");

    await logGdprRequest({
      kind: "EXPORT",
      subjectType: "CLIENT",
      subjectId: id,
      subjectLabel: data.klient.name,
      requestedById: user.id,
    });
    await audit(user.id, "GDPR_EXPORT", "client", id);
    return jsonAttachment(data, `elevate-dane-klienta-${id.slice(0, 8)}.json`);
  }

  return fail(422, "Nieznany rodzaj podmiotu");
});

/** Odpowiedz jako plik do pobrania — format nadajacy sie do odczytu maszynowego. */
function jsonAttachment(data: unknown, filename: string): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
