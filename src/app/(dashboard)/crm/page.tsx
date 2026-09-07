import { prisma } from "@/lib/prisma";
import { requireModule } from "@/server/session";
import { canSeeFinancials } from "@/lib/rbac";
import { CrmTabs } from "@/components/crm/CrmTabs";

export const metadata = { title: "CRM — ELEVATE OS" };
export const dynamic = "force-dynamic";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ zakladka?: string }>;
}) {
  const user = await requireModule("crm");
  const { zakladka } = await searchParams;

  const [clients, opportunities, owners] = await Promise.all([
    prisma.client.findMany({
      include: { _count: { select: { contacts: true, projects: true, opportunities: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.opportunity.findMany({
      include: {
        client: { select: { id: true, name: true, segment: true } },
        owner: { select: { id: true, fullName: true } },
      },
      orderBy: [{ expectedCloseDate: "asc" }],
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const showMoney = canSeeFinancials(user.role);

  return (
    <CrmTabs
      initialTab={zakladka === "pipeline" ? "pipeline" : "klienci"}
      canConvert={user.role !== "CONSULTANT"}
      showMoney={showMoney}
      owners={owners}
      clients={clients.map((c) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        segment: c.segment,
        status: c.status,
        city: c.city,
        nip: c.nip,
        lastContactAt: c.lastContactAt ? c.lastContactAt.toISOString() : null,
        contacts: c._count.contacts,
        projects: c._count.projects,
        opportunities: c._count.opportunities,
      }))}
      opportunities={opportunities.map((o) => ({
        id: o.id,
        title: o.title,
        stage: o.stage,
        status: o.status,
        serviceType: o.serviceType,
        value: showMoney ? o.value : null,
        probability: o.probability,
        expectedCloseDate: o.expectedCloseDate ? o.expectedCloseDate.toISOString() : null,
        convertedProjectId: o.convertedProjectId,
        winFactors: o.winFactors,
        lossFactors: o.lossFactors,
        decisionNote: o.decisionNote,
        clientId: o.client.id,
        clientName: o.client.name,
        ownerName: o.owner?.fullName ?? null,
      }))}
    />
  );
}
