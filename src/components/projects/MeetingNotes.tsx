"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, dialogField, dialogLabel, readError } from "@/components/crm/Dialog";
import { PRIORITIES, PRIORITY_LABEL } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { DateField } from "@/components/ui/DateField";

export type NoteItem = {
  id: string;
  content: string;
  taskId: string | null;
  taskCode: string | null;
};

export type Note = {
  id: string;
  title: string;
  meetingDate: string;
  content: string | null;
  attendees: string | null;
  authorName: string;
  items: NoteItem[];
};

/**
 * Notatki ze spotkan (spec 03). Punkt notatki zamienia sie na zadanie jednym
 * dzialaniem — bez opuszczania widoku notatki.
 */
export function MeetingNotes({
  notes,
  projectId,
  clientId,
  teamMembers,
  projects,
}: {
  notes: Note[];
  projectId?: string;
  clientId?: string;
  teamMembers: { id: string; fullName: string }[];
  projects?: { id: string; code: string; name: string }[];
}) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [converting, setConverting] = useState<NoteItem | null>(null);

  const openItems = notes.flatMap((n) => n.items).filter((i) => !i.taskId).length;

  return (
    <Card>
      <CardHeader
        title="Notatki ze spotkań"
        subtitle={
          notes.length === 0
            ? "Brak notatek"
            : `${notes.length} ${notes.length === 1 ? "notatka" : "notatek"} · ${openItems} punktów bez zadania`
        }
        action={
          <button onClick={() => setNewOpen(true)} className="text-[12.5px] font-semibold text-accent">
            + Nowa notatka
          </button>
        }
      />
      <div className="p-3">
        {notes.length === 0 ? (
          <EmptyState
            title="Brak notatek"
            hint="Zapisz ustalenia ze spotkania — każdy punkt zamienisz w zadanie jednym kliknięciem."
          />
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-xl border border-border bg-surface-2 px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-[13.5px] font-semibold text-ink">
                    {note.title}
                  </p>
                  <span className="shrink-0 font-mono text-[10.5px] text-muted">
                    {formatDate(note.meetingDate)}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[10.5px] text-muted">
                  {note.authorName}
                  {note.attendees ? ` · uczestnicy: ${note.attendees}` : ""}
                </p>

                {note.content && (
                  <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] text-ink-soft">
                    {note.content}
                  </p>
                )}

                {note.items.length > 0 && (
                  <ul className="mt-2.5 space-y-1">
                    {note.items.map((item) => (
                      <li key={item.id} className="flex items-start gap-2.5">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span className="min-w-0 flex-1 text-[12.5px] text-ink-soft">
                          {item.content}
                        </span>
                        {item.taskId ? (
                          <Link href={`/tasks/${item.taskId}`} className="shrink-0">
                            <Pill tone="good">{item.taskCode}</Pill>
                          </Link>
                        ) : (
                          <button
                            onClick={() => setConverting(item)}
                            className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[10.5px] font-bold text-accent hover:opacity-80"
                          >
                            → zadanie
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {newOpen && (
        <NewNoteDialog
          projectId={projectId}
          clientId={clientId}
          onClose={() => setNewOpen(false)}
          onCreated={() => {
            setNewOpen(false);
            router.refresh();
          }}
        />
      )}

      {converting && (
        <ConvertItemDialog
          item={converting}
          teamMembers={teamMembers}
          projects={projects}
          needsProject={!projectId}
          onClose={() => setConverting(null)}
          onConverted={() => {
            setConverting(null);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

function NewNoteDialog({
  projectId,
  clientId,
  onClose,
  onCreated,
}: {
  projectId?: string;
  clientId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    // Kazda linia pola "punkty" to osobny punkt do odhaczenia albo konwersji.
    const items = String(form.get("items") ?? "")
      .split("\n")
      .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
      .filter((line) => line !== "");

    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(form.get("title") ?? "").trim(),
        meetingDate: String(form.get("meetingDate") ?? ""),
        projectId: projectId ?? null,
        clientId: clientId ?? null,
        content: String(form.get("content") ?? "").trim(),
        attendees: String(form.get("attendees") ?? "").trim(),
        items,
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać notatki."));
      setPending(false);
      return;
    }
    onCreated();
  }

  return (
    <Dialog title="Notatka ze spotkania" onClose={onClose}>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Tytuł</span>
            <input name="title" required minLength={3} className={dialogField} />
          </label>
          <label className="block">
            <span className={dialogLabel}>Data spotkania</span>
            <DateField
              
              name="meetingDate"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={dialogField}
            />
          </label>
        </div>

        <label className="block">
          <span className={dialogLabel}>Uczestnicy</span>
          <input name="attendees" placeholder="kto był na spotkaniu" className={dialogField} />
        </label>

        <label className="block">
          <span className={dialogLabel}>Przebieg</span>
          <textarea name="content" rows={4} className={dialogField} />
        </label>

        <label className="block">
          <span className={dialogLabel}>Punkty do wykonania — jeden na linię</span>
          <textarea
            name="items"
            rows={5}
            placeholder={"Przygotować zestawienie kosztów\nUstalić termin warsztatu\nWysłać ofertę na moduł B"}
            className={dialogField}
          />
          <span className="mt-1 block text-[12px] text-muted">
            Każdy punkt zamienisz później w zadanie jednym kliknięciem.
          </span>
        </label>

        {error && (
          <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Zapisywanie…" : "Zapisz notatkę"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            Anuluj
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function ConvertItemDialog({
  item,
  teamMembers,
  projects,
  needsProject,
  onClose,
  onConverted,
}: {
  item: NoteItem;
  teamMembers: { id: string; fullName: string }[];
  projects?: { id: string; code: string; name: string }[];
  needsProject: boolean;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/notes/items/${item.id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assigneeId: String(form.get("assigneeId") ?? "") || null,
        dueDate: String(form.get("dueDate") ?? "") || null,
        priority: String(form.get("priority") ?? "MEDIUM"),
        projectId: String(form.get("projectId") ?? "") || null,
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się utworzyć zadania."));
      setPending(false);
      return;
    }
    onConverted();
  }

  return (
    <Dialog title="Punkt notatki → zadanie" onClose={onClose}>
      <div className="mt-4 rounded-xl border border-border bg-surface-2 px-4 py-3">
        <p className="text-[13px] text-ink">{item.content}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        {needsProject && projects && (
          <label className="block">
            <span className={dialogLabel}>Projekt</span>
            <select name="projectId" required className={dialogField} defaultValue="">
              <option value="" disabled>
                Wybierz projekt…
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={dialogLabel}>Osoba odpowiedzialna</span>
            <select name="assigneeId" className={dialogField} defaultValue="">
              <option value="">nieprzypisane</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>Priorytet</span>
            <select name="priority" className={dialogField} defaultValue="MEDIUM">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={dialogLabel}>Termin</span>
            <DateField  name="dueDate" className={dialogField} />
          </label>
        </div>

        {error && (
          <p className="rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Tworzenie…" : "Utwórz zadanie"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-5 py-2.5 text-[14px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            Anuluj
          </button>
        </div>
      </form>
    </Dialog>
  );
}
