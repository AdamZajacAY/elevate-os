import { requireModule } from "@/server/session";
import { getFinanceDashboard } from "@/server/services/finance";
import { FinancesClient } from "@/components/finances/FinancesClient";

export const metadata = { title: "Finanse — ELEVATE OS" };
export const dynamic = "force-dynamic";

export default async function FinancesPage() {
  const user = await requireModule("finances");
  const data = await getFinanceDashboard(user.role);

  return (
    <FinancesClient
      projects={data.projects}
      clients={data.clients}
      team={data.team}
      timeliness={data.timeliness}
      pipeline={data.pipeline}
      totals={data.totals}
    />
  );
}
