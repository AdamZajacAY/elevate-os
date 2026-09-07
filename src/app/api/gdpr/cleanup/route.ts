import { withAuth, ok, fail } from "@/server/api";
import { isAdmin } from "@/lib/rbac";
import { runRetentionCleanup } from "@/server/services/gdpr";
import { audit } from "@/server/services/audit";

/**
 * Sprzatanie retencyjne uruchamiane recznie przez Administratora.
 * Wersja dla harmonogramu (autoryzacja sekretem) jest pod /api/cron/cleanup.
 */
export const POST = withAuth("admin", async (user) => {
  if (!isAdmin(user.role)) return fail(403, "Sprzatanie prowadzi Administrator");

  const result = await runRetentionCleanup();
  await audit(user.id, "GDPR_CLEANUP", "retention", null, result);
  return ok(result);
});
