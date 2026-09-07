"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { readError } from "@/components/crm/Dialog";

/** Rejestracja godziny — jedyne zrodlo kosztu rzeczywistego na dashboardzie (spec 02). */
export function TimeLogger({ taskId, projectId }: { taskId: string; projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const form = e.currentTarget;
    const data = new FormData(form);
    const hours = Number(String(data.get("hours") ?? "").replace(",", "."));

    const res = await fetch("/api/timelogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        projectId,
        hours,
        workDate: String(data.get("workDate") ?? ""),
        note: String(data.get("note") ?? ""),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać godzin."));
      setPending(false);
      return;
    }

    form.reset();
    setSaved(true);
    setPending(false);
    router.refresh();
  }

  const field =
    "mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent";
  const label = "font-mono text-[10.5px] uppercase tracking-wider text-muted";

  return (
    <Card>
      <CardHeader title="Zarejestruj czas" subtitle="Godziny zasilają rentowność projektu" />
      <form onSubmit={onSubmit} className="space-y-3.5 p-5">
        <div className="grid grid-cols-2 gap-3.5">
          <label className="block">
            <span className={label}>Godziny</span>
            <input name="hours" required inputMode="decimal" placeholder="np. 3,5" className={field} />
          </label>
          <label className="block">
            <span className={label}>Data</span>
            <input
              type="date"
              name="workDate"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={field}
            />
          </label>
        </div>

        <label className="block">
          <span className={label}>Notatka</span>
          <input name="note" placeholder="czego dotyczyła praca" className={field} />
        </label>

        {error && (
          <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
            {error}
          </p>
        )}
        {saved && (
          <p className="rounded-lg border border-good bg-good-soft px-3 py-2 text-[12.5px] text-good">
            Wpis zapisany.
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-accent-deep px-4 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Zapisywanie…" : "Zapisz godziny"}
        </button>
      </form>
    </Card>
  );
}
