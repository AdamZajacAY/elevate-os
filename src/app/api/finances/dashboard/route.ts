import { withAuth, ok } from "@/server/api";
import { getFinanceDashboard } from "@/server/services/finance";

/**
 * Modul `finances` jest dostepny wylacznie dla ADMIN i PARTNER (rbac.ts),
 * wiec dane finansowe nie wymagaja tu dodatkowej redakcji.
 */
export const GET = withAuth("finances", async (user) => {
  return ok(await getFinanceDashboard(user.role));
});
