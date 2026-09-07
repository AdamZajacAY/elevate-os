"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { readError } from "@/components/crm/Dialog";
import { ALLOWED_DEFAULT_VIEWS } from "@/server/validators/schemas";

const THEMES = [
  ["system", "Jak system"],
  ["light", "Jasny"],
  ["dark", "Ciemny"],
] as const;

/** Etykiety widokow startowych. Lista dozwolonych sciezek zyje w `schemas.ts`
 *  (waliduje ja serwer) — tu dokladamy wylacznie nazwy do wyswietlenia. */
const VIEW_LABEL: Record<string, string> = {
  "/dashboard": "Pulpit",
  "/projects": "Projekty",
  "/tasks": "Zadania",
  "/gantt": "Harmonogram",
  "/notifications": "Powiadomienia",
  "/crm": "CRM",
  "/finances": "Finanse",
  "/experts": "Eksperci",
  "/improvements": "Panel Usprawnień",
};

/** Personalizacja wlasnych ustawien (spec 06) — motyw, widok startowy, prog pilnosci. */
export function PreferencesPanel({
  preferences,
}: {
  preferences: { theme: string; defaultView: string; urgentDays: number };
}) {
  const router = useRouter();
  const [theme, setTheme] = useState(preferences.theme);
  const [defaultView, setDefaultView] = useState(preferences.defaultView);
  const [urgentDays, setUrgentDays] = useState(preferences.urgentDays);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /** Motyw stosowany od razu na <html>, zeby zmiana byla widoczna przed zapisem. */
  function applyTheme(next: string) {
    setTheme(next);
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
  }

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, defaultView, urgentDays }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać ustawień."));
      setPending(false);
      return;
    }
    setSaved(true);
    setPending(false);
    router.refresh();
  }

  const field =
    "mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent";
  const label = "font-mono text-[10.5px] uppercase tracking-wider text-muted";

  return (
    <Card>
      <CardHeader title="Personalizacja" subtitle="Ustawienia widoczne tylko dla Ciebie" />
      <div className="space-y-4 p-5">
        <label className="block">
          <span className={label}>Motyw</span>
          <select value={theme} onChange={(e) => applyTheme(e.target.value)} className={field}>
            {THEMES.map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={label}>Widok startowy po zalogowaniu</span>
          <select
            value={defaultView}
            onChange={(e) => setDefaultView(e.target.value)}
            className={field}
          >
            {ALLOWED_DEFAULT_VIEWS.map((value) => (
              <option key={value} value={value}>
                {VIEW_LABEL[value] ?? value}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={label}>Próg pilności (dni do terminu)</span>
          <input
            type="number"
            min={1}
            max={30}
            value={urgentDays}
            onChange={(e) => setUrgentDays(Number(e.target.value))}
            className={field}
          />
          <span className="mt-1 block text-[12px] text-muted">
            Termin bliższy niż {urgentDays}{" "}
            {urgentDays === 1 ? "dzień" : "dni"} jest oznaczany jako pilny.
          </span>
        </label>

        {error && (
          <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
            {error}
          </p>
        )}
        {saved && (
          <p className="rounded-lg border border-good bg-good-soft px-3 py-2 text-[13px] text-good">
            Ustawienia zapisane.
          </p>
        )}

        <button
          onClick={save}
          disabled={pending}
          className="w-full rounded-lg bg-accent-deep px-4 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Zapisywanie…" : "Zapisz ustawienia"}
        </button>
      </div>
    </Card>
  );
}
