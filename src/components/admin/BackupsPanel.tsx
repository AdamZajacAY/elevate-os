"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { readError } from "@/components/crm/Dialog";
import { formatDate } from "@/lib/format";

type Backup = { name: string; sizeBytes: number; createdAt: string };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Kopie zapasowe (spec 10) — ręczne na żądanie, lista ostatnich dziesięciu. */
export function BackupsPanel({ initial }: { initial: Backup[] }) {
  const [backups, setBackups] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function createBackup() {
    setPending(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/admin/backups", { method: "POST" });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się utworzyć kopii."));
      setPending(false);
      return;
    }

    // Kopia wraca jako plik — na Renderze dysk jest efemeryczny, więc jedyną
    // trwałą formą jest pobranie jej na dysk użytkownika.
    const blob = await res.blob();
    const name =
      res.headers.get("content-disposition")?.match(/filename="(.+?)"/)?.[1] ??
      "elevate-kopia.json";
    const persisted = res.headers.get("x-backup-persisted") === "true";

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    setMessage(
      `Kopia pobrana: ${name} (${formatSize(blob.size)})` +
        (persisted ? " — zapisana także na serwerze." : " — serwer jej nie przechowuje."),
    );

    const list = await fetch("/api/admin/backups");
    if (list.ok) setBackups(((await list.json()) as { backups: Backup[] }).backups);
    setPending(false);
  }

  return (
    <Card>
      <CardHeader
        title="Kopie zapasowe"
        subtitle="Kopia robiona przy żywej bazie — trzymamy dziesięć ostatnich"
        action={
          <button
            onClick={createBackup}
            disabled={pending}
            className="rounded-lg bg-accent-deep px-3.5 py-1.5 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Tworzenie…" : "Utwórz kopię"}
          </button>
        }
      />
      <div className="p-3">
        {error && (
          <p className="mb-2 rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
            {error}
          </p>
        )}
        {message && (
          <p className="mb-2 rounded-lg border border-good bg-good-soft px-3 py-2 text-[12.5px] text-good">
            {message}
          </p>
        )}

        {backups.length === 0 ? (
          <EmptyState
            title="Brak kopii"
            hint="Pierwsza kopia powstanie po kliknięciu „Utwórz kopię”."
          />
        ) : (
          <ul className="space-y-1">
            {backups.map((b) => (
              <li
                key={b.name}
                className="flex items-center gap-3 rounded-xl px-2.5 py-1.5 hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-soft">
                  {b.name}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted">
                  {formatSize(b.sizeBytes)}
                </span>
                <span className="w-[96px] shrink-0 text-right font-mono text-[11px] text-muted">
                  {formatDate(b.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 px-2.5 text-[12px] text-muted">
          Kopia to zrzut logiczny wszystkich tabel w JSON — pobierasz go na swój dysk.
          Na serwerze zostaje tylko wtedy, gdy ustawiono <code className="font-mono text-[11px]">BACKUP_DIR</code>{" "}
          na trwały wolumen. To uzupełnienie kopii zarządzanych przez hosting, nie ich zamiennik.
        </p>
      </div>
    </Card>
  );
}
