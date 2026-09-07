import { withAuth, ok, fail } from "@/server/api";
import { scanForNotifications } from "@/server/services/notifications";
import { isAdmin } from "@/lib/rbac";
import { audit } from "@/server/services/audit";

/**
 * Skan proaktywny — docelowo wolany przez harmonogram (cron/scheduler).
 * Do czasu wdrozenia schedulera uruchamialny recznie z panelu administracyjnego.
 */
export const POST = withAuth("dashboard", async (user) => {
  if (!isAdmin(user.role)) return fail(403, "Skan uruchamia Administrator");

  const result = await scanForNotifications();
  await audit(user.id, "SCAN", "notification", null, result);
  return ok(result);
});
