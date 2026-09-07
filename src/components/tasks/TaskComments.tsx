"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { readError } from "@/components/crm/Dialog";
import { formatDate } from "@/lib/format";

type Comment = {
  id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

type Member = { id: string; fullName: string };

/**
 * Komentarze z @wzmiankami (spec 03). Wzmianka jest zapisywana jako id uzytkownika,
 * nie jako tekst — zmiana nazwiska nie zrywa powiazania. W trescci zostaje
 * "@Imie Nazwisko", a lista id idzie osobnym polem.
 */
export function TaskComments({
  taskId,
  comments,
  teamMembers,
  currentUserId,
  isAdmin,
}: {
  taskId: string;
  comments: Comment[];
  teamMembers: Member[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [mentioned, setMentioned] = useState<Member[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function addMention(member: Member) {
    if (!mentioned.some((m) => m.id === member.id)) {
      setMentioned((prev) => [...prev, member]);
    }
    setBody((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}@${member.fullName} `);
    setPickerOpen(false);
    textareaRef.current?.focus();
  }

  function removeMention(id: string) {
    setMentioned((prev) => prev.filter((m) => m.id !== id));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim() === "") return;
    setPending(true);
    setError(null);

    // Wzmianka liczy sie tylko wtedy, gdy jej nazwisko nadal jest w tresci —
    // skasowanie "@Jan Kowalski" z tekstu cofa powiadomienie.
    const stillMentioned = mentioned.filter((m) => body.includes(`@${m.fullName}`));

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId,
        body: body.trim(),
        mentions: stillMentioned.map((m) => m.id),
      }),
    });

    if (!res.ok) {
      setError(await readError(res, "Nie udało się zapisać komentarza."));
      setPending(false);
      return;
    }

    setBody("");
    setMentioned([]);
    setPending(false);
    router.refresh();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(await readError(res, "Nie udało się usunąć komentarza."));
      return;
    }
    router.refresh();
  }

  /** Podswietlenie wzmianek w wyswietlanej tresci. */
  function renderBody(text: string) {
    const names = teamMembers.map((m) => m.fullName).sort((a, b) => b.length - a.length);
    if (names.length === 0) return text;
    const pattern = new RegExp(`@(${names.map(escapeRegExp).join("|")})`, "g");
    const parts = text.split(pattern);

    return parts.map((part, index) =>
      names.includes(part) ? (
        <span key={index} className="rounded bg-accent-soft px-1 font-semibold text-accent">
          @{part}
        </span>
      ) : (
        <span key={index}>{part}</span>
      ),
    );
  }

  return (
    <Card>
      <CardHeader
        title="Komentarze"
        subtitle={`${comments.length} ${comments.length === 1 ? "wpis" : "wpisów"} — użyj @, żeby kogoś powiadomić`}
      />

      <div className="p-3">
        {comments.length === 0 ? (
          <EmptyState title="Brak komentarzy" hint="Zacznij rozmowę o tym zadaniu." />
        ) : (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-ink">{c.authorName}</span>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[10.5px] text-muted">
                      {formatDate(c.createdAt)}
                    </span>
                    {(isAdmin || c.authorId === currentUserId) && (
                      <button
                        onClick={() => remove(c.id)}
                        className="text-[11px] text-muted hover:text-crit"
                      >
                        usuń
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-soft">
                  {renderBody(c.body)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-border p-4">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Napisz komentarz…"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13.5px] text-ink outline-none focus:border-accent"
        />

        {mentioned.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Powiadomię:
            </span>
            {mentioned.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => removeMention(m.id)}
                title="Usuń wzmiankę"
                className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent hover:opacity-70"
              >
                @{m.fullName} ×
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="mt-2 rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
            {error}
          </p>
        )}

        <div className="relative mt-3 flex items-center gap-2.5">
          <button
            type="submit"
            disabled={pending || body.trim() === ""}
            className="rounded-lg bg-accent-deep px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Wysyłanie…" : "Dodaj komentarz"}
          </button>

          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="rounded-lg border border-border px-3 py-2 text-[13.5px] font-semibold text-ink-soft hover:bg-surface-2"
          >
            @ Wspomnij
          </button>

          {pickerOpen && (
            <div className="absolute bottom-full left-0 z-10 mb-2 max-h-[220px] w-[240px] overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-card">
              {teamMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => addMention(m)}
                  className="block w-full rounded-lg px-3 py-1.5 text-left text-[13px] text-ink-soft hover:bg-surface-2 hover:text-ink"
                >
                  {m.fullName}
                </button>
              ))}
            </div>
          )}
        </div>
      </form>
    </Card>
  );
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
