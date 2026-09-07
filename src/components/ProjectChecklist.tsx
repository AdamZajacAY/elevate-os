"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PHASES, PHASE_LABEL } from "@/lib/domain";

type Item = {
  id: string;
  label: string;
  phase: string;
  isDone: boolean;
};

export function ProjectChecklist({ items }: { items: Item[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Stan lokalny, zeby odhaczenie bylo natychmiastowe; serwer potwierdza w tle.
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(items.map((i) => [i.id, i.isDone])),
  );

  useEffect(() => {
    setState(Object.fromEntries(items.map((i) => [i.id, i.isDone])));
  }, [items]);

  async function toggle(id: string, next: boolean) {
    setState((prev) => ({ ...prev, [id]: next }));
    const res = await fetch(`/api/checklist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone: next }),
    });
    if (!res.ok) {
      setState((prev) => ({ ...prev, [id]: !next })); // cofnij przy odmowie serwera
      return;
    }
    startTransition(() => router.refresh());
  }

  const done = items.filter((i) => state[i.id]).length;

  return (
    <Card>
      <CardHeader
        title="Checklista"
        subtitle={
          items.length === 0
            ? "Brak szablonu dla tego typu usługi"
            : `${done} z ${items.length} odhaczonych`
        }
      />
      <div className="p-3">
        {items.length === 0 ? (
          <EmptyState
            title="Checklista pusta"
            hint="Szablon dla tego typu usługi nie został jeszcze zdefiniowany."
          />
        ) : (
          PHASES.map((phase) => {
            const group = items.filter((i) => i.phase === phase);
            if (group.length === 0) return null;
            return (
              <div key={phase} className="mb-3 last:mb-0">
                <p className="mx-2.5 mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                  {PHASE_LABEL[phase]}
                </p>
                <ul>
                  {group.map((item) => (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-surface-2">
                        <input
                          type="checkbox"
                          checked={state[item.id] ?? false}
                          onChange={(e) => toggle(item.id, e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-deep)]"
                        />
                        <span
                          className={`text-[13px] ${
                            state[item.id] ? "text-muted line-through" : "text-ink-soft"
                          }`}
                        >
                          {item.label}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
