import { withAuth, ok } from "@/server/api";
import {
  getProjectFinance,
  getClientFinance,
  getTeamLoad,
  getTimeliness,
  getPipelineValue,
} from "@/server/services/finance";

/**
 * Modul `finances` jest dostepny wylacznie dla ADMIN i PARTNER (rbac.ts),
 * wiec dane finansowe nie wymagaja tu dodatkowej redakcji — konsultant nie
 * dojdzie do tej trasy.
 */
export const GET = withAuth("finances", async () => {
  const [projects, team, timeliness, pipeline] = await Promise.all([
    getProjectFinance(),
    getTeamLoad(),
    getTimeliness(),
    getPipelineValue(),
  ]);
  const clients = await getClientFinance(projects);

  return ok({ projects, clients, team, timeliness, pipeline });
});
