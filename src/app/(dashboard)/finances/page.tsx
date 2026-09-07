import { requireModule } from "@/server/session";
import {
  getProjectFinance,
  getClientFinance,
  getTeamLoad,
  getTimeliness,
  getPipelineValue,
} from "@/server/services/finance";
import { FinancesClient } from "@/components/finances/FinancesClient";

export const metadata = { title: "Finanse — ELEVATE OS" };
export const dynamic = "force-dynamic";

export default async function FinancesPage() {
  await requireModule("finances");

  const [projects, team, timeliness, pipeline] = await Promise.all([
    getProjectFinance(),
    getTeamLoad(),
    getTimeliness(),
    getPipelineValue(),
  ]);
  const clients = await getClientFinance(projects);

  return (
    <FinancesClient
      projects={projects}
      clients={clients}
      team={team}
      timeliness={timeliness}
      pipeline={pipeline}
    />
  );
}
