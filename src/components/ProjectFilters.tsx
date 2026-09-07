"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PHASES, PHASE_LABEL, PROJECT_STATUSES, PROJECT_STATUS_LABEL } from "@/lib/domain";

/** Filtry listy projektow trzymane w URL — widok da sie odeslac linkiem. */
export function ProjectFilters({ status, phase }: { status?: string; phase?: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/projects?${next.toString()}`);
  }

  const selectClass =
    "rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] text-ink outline-none focus:border-accent";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <select
        value={status ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        className={selectClass}
      >
        <option value="">Wszystkie statusy</option>
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PROJECT_STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <select
        value={phase ?? ""}
        onChange={(e) => setParam("faza", e.target.value)}
        className={selectClass}
      >
        <option value="">Wszystkie fazy</option>
        {PHASES.map((p) => (
          <option key={p} value={p}>
            {PHASE_LABEL[p]}
          </option>
        ))}
      </select>

      {(status || phase) && (
        <button
          onClick={() => router.push("/projects")}
          className="text-[12.5px] font-semibold text-accent"
        >
          Wyczyść
        </button>
      )}
    </div>
  );
}
