import { withAuth, ok } from "@/server/api";
import { getFinanceDashboard } from "@/server/services/finance";
import { audit } from "@/server/services/audit";

/** Raport executive generowany na zadanie z zywego stanu danych (spec 04). */
export const GET = withAuth("finances", async (user) => {
  const report = await getFinanceDashboard(user.role);
  await audit(user.id, "EXPORT", "executiveReport", null, {
    activeProjects: report.totals.activeProjects,
  });
  return ok(report);
});
