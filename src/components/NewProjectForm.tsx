"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ProjectFields,
  collectProjectPayload,
} from "@/components/projects/ProjectFields";

type Option = { id: string; name?: string; fullName?: string };

export function NewProjectForm({
  clients,
  owners,
  defaultOwnerId,
  showFinancials,
}: {
  clients: Option[];
  owners: Option[];
  defaultOwnerId: string;
  showFinancials: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const payload = collectProjectPayload(new FormData(e.currentTarget), showFinancials);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = Array.isArray(body.details)
        ? body.details.map((d: { message: string }) => d.message).join(", ")
        : null;
      setError(detail ?? body.error ?? "Nie udało się zapisać projektu.");
      setPending(false);
      return;
    }

    const project = await res.json();
    router.push(`/projects/${project.id}`);
    router.refresh();
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-2xl border border-warn bg-warn-soft px-5 py-4 text-[13.5px] text-warn">
        Nie ma jeszcze żadnego klienta. Projekt dziedziczy klienta z CRM — dodaj klienta, zanim
        założysz projekt.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <ProjectFields
        clients={clients as { id: string; name: string }[]}
        owners={owners as { id: string; fullName: string }[]}
        showFinancials={showFinancials}
        project={
          // Domyślny opiekun to osoba zakładająca projekt.
          { ownerId: defaultOwnerId } as never
        }
      />

      {error && (
        <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Zapisywanie…" : "Załóż projekt"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}
