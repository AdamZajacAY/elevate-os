"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, readError } from "@/components/crm/Dialog";
import {
  ProjectFields,
  collectProjectPayload,
  type ProjectFormValues,
} from "@/components/projects/ProjectFields";
import { PROJECT_STATUS_LABEL, labelOf } from "@/lib/domain";

/**
 * Edycja i zamknięcie projektu. Do tej pory karta projektu była tylko do
 * odczytu — pomyłki przy zakładaniu nie dało się naprawić, a projekt nie miał
 * jak przejść w stan zamknięty i przestać liczyć się w rentowności.
 */
export function EditProjectButton({
  project,
  clients,
  owners,
  showFinancials,
  canDelete,
}: {
  project: ProjectFormValues;
  clients: { id: string; name: string }[];
  owners: { id: string; fullName: string }[];
  showFinancials: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collectProjectPayload(new FormData(e.currentTarget), showFinancials)),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać projektu."));
      setPending(false);
      return;
    }
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  /** Zamknięcie to zwykła zmiana statusu — osobny przycisk, bo to częsta operacja. */
  async function closeProject() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" }),
    });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się zamknąć projektu."));
      setPending(false);
      return;
    }
    setPending(false);
    router.refresh();
  }

  async function remove() {
    setPending(true);
    const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się usunąć projektu."));
      setPending(false);
      setConfirmDelete(false);
      return;
    }
    router.push("/projects");
    router.refresh();
  }

  const isClosed = project.status === "CLOSED";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        {!isClosed && (
          <button
            onClick={closeProject}
            disabled={pending}
            className="rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-surface-2 disabled:opacity-50"
          >
            Zamknij projekt
          </button>
        )}
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-surface-2"
        >
          Edytuj
        </button>
      </div>

      {error && !open && (
        <p className="mt-2 rounded-lg border border-crit bg-crit-soft px-3 py-1.5 text-[12.5px] text-crit">
          {error}
        </p>
      )}

      {open && (
        <Dialog title={`Edycja: ${project.name}`} onClose={() => setOpen(false)}>
          <form onSubmit={save} className="mt-5 space-y-5">
            <ProjectFields
              project={project}
              clients={clients}
              owners={owners}
              showFinancials={showFinancials}
            />

            {error && (
              <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Zapisywanie…" : "Zapisz zmiany"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
              >
                Anuluj
              </button>

              {canDelete && (
                <span className="ml-auto">
                  {confirmDelete ? (
                    <button
                      type="button"
                      onClick={remove}
                      disabled={pending}
                      className="rounded-lg bg-crit px-4 py-2.5 text-[13px] font-bold text-white hover:opacity-90"
                    >
                      Potwierdzam usunięcie
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="rounded-lg px-4 py-2.5 text-[13px] font-semibold text-muted hover:text-crit"
                    >
                      Usuń projekt…
                    </button>
                  )}
                </span>
              )}
            </div>

            {confirmDelete && (
              <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
                Usunięcie skasuje też zadania, etapy, ryzyka, kamienie milowe i wpisy czasu tego
                projektu. Zamknięcie ({labelOf(PROJECT_STATUS_LABEL, "CLOSED")}) zachowuje historię
                i wyłącza projekt z rentowności — zwykle o to chodzi.
              </p>
            )}
          </form>
        </Dialog>
      )}
    </>
  );
}
