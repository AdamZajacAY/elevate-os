"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, labelOf } from "@/lib/domain";
import { readError } from "@/components/crm/Dialog";

/**
 * Zmiana statusu projektu wprost na liście.
 *
 * Status zmienia się często — projekt idzie w realizację, wisi na decyzji
 * klienta, kończy się. Wchodzenie na kartę projektu za każdym razem było
 * niepotrzebnym krokiem, tak samo jak przy zadaniach na tablicy.
 *
 * Zapis jest optymistyczny: wartość zmienia się od razu, a odmowa serwera
 * ją cofa. Odwrotna kolejność dawałaby wrażenie zawieszonego interfejsu.
 */
export function ProjectStatusSelect({
  projectId,
  status,
  canEdit,
}: {
  projectId: string;
  status: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canEdit) {
    return (
      <span className="text-[13px] text-ink-soft">{labelOf(PROJECT_STATUS_LABEL, status)}</span>
    );
  }

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setError(null);
    setPending(true);

    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });

    if (!res.ok) {
      setValue(previous);
      setError(await readError(res, "Nie udało się zmienić statusu."));
      setPending(false);
      return;
    }
    setPending(false);
    // Zamknięcie projektu zmienia rentowność i licznik aktywnych — odświeżamy widok.
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        aria-label="Status projektu"
        className={`rounded-lg border border-border bg-surface px-2 py-1 text-[12px] outline-none focus:border-accent disabled:opacity-50 ${
          value === "CLOSED" ? "text-muted" : "text-ink"
        }`}
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PROJECT_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {error && <span className="text-[10.5px] text-crit">{error}</span>}
    </span>
  );
}
