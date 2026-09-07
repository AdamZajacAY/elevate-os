"use client";

import type { ReactNode } from "react";

/** Wspolna powloka okna modalnego — jedno miejsce na zachowanie i wyglad. */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-[560px] overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-card"
      >
        <h2 className="font-display text-[19px] font-bold text-ink">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export const dialogField =
  "mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent";
export const dialogLabel = "font-mono text-[10.5px] uppercase tracking-wider text-muted";

/** Wyciaga czytelny komunikat z odpowiedzi bledu API (zod details albo error). */
export async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  if (Array.isArray(body.details)) {
    return body.details.map((d: { message: string }) => d.message).join(", ");
  }
  return body.error ?? fallback;
}
