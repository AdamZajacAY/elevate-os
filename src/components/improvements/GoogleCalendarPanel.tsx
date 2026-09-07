"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { readError } from "@/components/crm/Dialog";
import { formatDate } from "@/lib/format";

type Link = {
  googleEmail: string;
  calendarId: string | null;
  lastSyncAt: string | null;
  lastSyncCount: number;
  lastSyncError: string | null;
  createdAt: string;
};

/** Komunikaty po powrocie z ekranu zgody Google. */
const RETURN_MESSAGE: Record<string, { text: string; tone: "good" | "warn" | "crit" }> = {
  polaczono: { text: "Konto Google połączone. Uruchom pierwszą synchronizację.", tone: "good" },
  odmowa: { text: "Zgoda nie została udzielona — integracja pozostaje wyłączona.", tone: "warn" },
  "brak-refresh": {
    text: "Google nie zwróciło tokenu odświeżania. Odłącz aplikację w ustawieniach konta Google i spróbuj ponownie.",
    tone: "crit",
  },
  "stan-nieprawidlowy": {
    text: "Sesja zgody wygasła albo została naruszona. Spróbuj połączyć ponownie.",
    tone: "crit",
  },
  nieskonfigurowane: {
    text: "To wdrożenie nie ma kluczy Google — administrator musi je uzupełnić.",
    tone: "warn",
  },
  blad: { text: "Połączenie nie powiodło się. Spróbuj ponownie.", tone: "crit" },
};

/**
 * Integracja z Google Calendar (spec 09). Wydarzenia idą wyłącznie z ELEVATE OS
 * do Google — zmiany zrobione w Google zostaną nadpisane przy kolejnej synchronizacji.
 */
export function GoogleCalendarPanel() {
  const params = useSearchParams();
  const returnCode = params.get("google");

  const [configured, setConfigured] = useState<boolean | null>(null);
  const [link, setLink] = useState<Link | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function loadStatus() {
    const res = await fetch("/api/google/calendar/status");
    if (!res.ok) return;
    const data = (await res.json()) as { configured: boolean; link: Link | null };
    setConfigured(data.configured);
    setLink(data.link);
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function sync() {
    setPending(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/google/calendar/sync", { method: "POST" });
    if (!res.ok) {
      setError(await readError(res, "Synchronizacja nie powiodła się."));
      setPending(false);
      await loadStatus();
      return;
    }
    const r = (await res.json()) as { created: number; updated: number; total: number };
    setMessage(
      `Zsynchronizowano ${r.total} wydarzeń — nowych ${r.created}, zaktualizowanych ${r.updated}.`,
    );
    setPending(false);
    await loadStatus();
  }

  async function disconnect() {
    setPending(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/google/calendar/disconnect", { method: "POST" });
    if (!res.ok) {
      setError(await readError(res, "Rozłączenie nie powiodło się."));
      setPending(false);
      return;
    }
    setLink(null);
    setMessage("Konto Google rozłączone. Kalendarz „ELEVATE OS” zostaje w Twoim koncie Google.");
    setPending(false);
  }

  const returned = returnCode ? RETURN_MESSAGE[returnCode] : null;

  return (
    <Card>
      <CardHeader
        title="Google Calendar"
        subtitle="Kamienie milowe, spotkania i terminy w Twoim kalendarzu Google"
        action={
          link ? (
            <Pill tone="good" dot>
              połączone
            </Pill>
          ) : undefined
        }
      />
      <div className="space-y-3 p-5">
        {returned && (
          <p
            className={`rounded-lg border px-3 py-2 text-[12.5px] ${
              returned.tone === "good"
                ? "border-good bg-good-soft text-good"
                : returned.tone === "warn"
                  ? "border-warn bg-warn-soft text-warn"
                  : "border-crit bg-crit-soft text-crit"
            }`}
          >
            {returned.text}
          </p>
        )}

        {configured === false && (
          <p className="rounded-lg border border-warn bg-warn-soft px-3 py-2 text-[12.5px] text-warn">
            Integracja nie jest skonfigurowana na tym wdrożeniu. Administrator musi uzupełnić
            <code className="mx-1 font-mono text-[11px]">AUTH_GOOGLE_ID</code> i
            <code className="mx-1 font-mono text-[11px]">AUTH_GOOGLE_SECRET</code>.
          </p>
        )}

        {link ? (
          <>
            <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-3">
              <p className="text-[13px] text-ink">
                Konto: <span className="font-semibold">{link.googleEmail}</span>
              </p>
              <p className="mt-0.5 text-[12px] text-muted">
                {link.lastSyncAt
                  ? `Ostatnia synchronizacja ${formatDate(link.lastSyncAt)} — ${link.lastSyncCount} wydarzeń`
                  : "Jeszcze nie synchronizowano"}
              </p>
              {link.lastSyncError && (
                <p className="mt-1.5 text-[12px] text-crit">{link.lastSyncError}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={sync}
                disabled={pending}
                className="rounded-lg bg-accent-deep px-4 py-2 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Synchronizowanie…" : "Synchronizuj teraz"}
              </button>
              <button
                onClick={disconnect}
                disabled={pending}
                className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-muted hover:bg-surface-2 hover:text-crit disabled:opacity-50"
              >
                Rozłącz
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px] text-ink-soft">
              Po połączeniu ELEVATE OS założy w Twoim koncie osobny kalendarz „ELEVATE OS”
              i będzie do niego wypychał kamienie milowe, spotkania i terminy projektów —
              tylko te, które widzisz w swojej roli.
            </p>
            <a
              href="/api/google/calendar/connect"
              className={`inline-block rounded-lg px-4 py-2 text-[13px] font-bold text-white ${
                configured === false
                  ? "pointer-events-none bg-muted opacity-50"
                  : "bg-accent-deep hover:opacity-90"
              }`}
            >
              Połącz konto Google
            </a>
          </>
        )}

        {message && (
          <p className="rounded-lg border border-good bg-good-soft px-3 py-2 text-[12.5px] text-good">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
            {error}
          </p>
        )}

        <p className="text-[12px] text-muted">
          Synchronizacja jest jednokierunkowa — zmiany zrobione w Google zostaną nadpisane przy
          kolejnym uruchomieniu. Alternatywnie możesz zasubskrybować feed iCal z zakładki Platforma.
        </p>
      </div>
    </Card>
  );
}
