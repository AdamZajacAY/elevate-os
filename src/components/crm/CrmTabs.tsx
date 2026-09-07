"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientList, type ClientRow } from "@/components/crm/ClientList";
import { CrmPipeline, type OpportunityRow } from "@/components/crm/CrmPipeline";

type Tab = "klienci" | "pipeline";

export function CrmTabs({
  clients,
  opportunities,
  owners,
  initialTab,
  canConvert,
  showMoney,
}: {
  clients: ClientRow[];
  opportunities: OpportunityRow[];
  owners: { id: string; fullName: string }[];
  initialTab: Tab;
  canConvert: boolean;
  showMoney: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);

  function switchTab(next: Tab) {
    setTab(next);
    // Zakladka w URL, zeby widok dalo sie odeslac linkiem.
    router.replace(`/crm?zakladka=${next}`, { scroll: false });
  }

  const openValue = opportunities
    .filter((o) => o.status === "OPEN")
    .reduce((sum, o) => sum + (o.value ?? 0), 0);

  return (
    <div className="space-y-5">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-wider text-accent">
          Relacje z klientami
        </p>
        <h1 className="mt-1 font-display text-[28px] font-black tracking-tight text-ink">CRM</h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          {clients.length} {clients.length === 1 ? "klient" : "klientów"} ·{" "}
          {opportunities.filter((o) => o.status === "OPEN").length} otwartych szans
          {showMoney && openValue > 0
            ? ` o wartości ${new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(openValue)}`
            : ""}
        </p>
      </header>

      <div className="flex rounded-lg border border-border bg-surface p-0.5 w-fit">
        {(["klienci", "pipeline"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`rounded-[6px] px-4 py-1.5 text-[13px] font-semibold capitalize transition-colors ${
              tab === t ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
            }`}
          >
            {t === "klienci" ? "Klienci" : "Pipeline"}
          </button>
        ))}
      </div>

      {tab === "klienci" ? (
        <ClientList clients={clients} />
      ) : (
        <CrmPipeline
          opportunities={opportunities}
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          owners={owners}
          canConvert={canConvert}
          showMoney={showMoney}
        />
      )}
    </div>
  );
}
