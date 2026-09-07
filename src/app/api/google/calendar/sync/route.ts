import { withAuth, ok, fail } from "@/server/api";
import { syncToGoogleCalendar, recordSyncError } from "@/server/services/googleCalendar";
import { googleCalendarConfigured } from "@/server/services/googleOAuth";
import { audit } from "@/server/services/audit";

/** Synchronizacja na żądanie — użytkownik synchronizuje wyłącznie własny kalendarz. */
export const POST = withAuth("dashboard", async (user) => {
  if (!googleCalendarConfigured()) {
    return fail(503, "Integracja Google nie jest skonfigurowana na tym wdrożeniu");
  }

  try {
    const result = await syncToGoogleCalendar(user.id, user.role);
    await audit(user.id, "SYNC", "googleCalendar", user.id, result);
    return ok(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nieznany błąd synchronizacji";
    await recordSyncError(user.id, message);
    return fail(502, message);
  }
});
