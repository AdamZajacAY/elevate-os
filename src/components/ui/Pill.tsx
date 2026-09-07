import type { ReactNode } from "react";

type Tone = "accent" | "good" | "warn" | "crit" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  accent: "bg-accent-soft text-accent",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  crit: "bg-crit-soft text-crit",
  neutral: "bg-surface-2 text-muted",
};

export function Pill({
  tone = "neutral",
  dot = false,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${TONE_CLASS[tone]}`}
    >
      {dot && <span className="h-[7px] w-[7px] rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Mapowanie statusu RAG na ton — jedno miejsce, zeby kolory nie rozjechaly sie po widokach. */
export function ragTone(rag: string): Tone {
  if (rag === "GREEN") return "good";
  if (rag === "AMBER") return "warn";
  if (rag === "RED") return "crit";
  return "neutral";
}

/** Kolor tla paska RAG — ta sama paleta co `ragTone`, w formie klasy tla. */
export const RAG_BG: Record<string, string> = {
  GREEN: "bg-good",
  AMBER: "bg-warn",
  RED: "bg-crit",
};

export function priorityTone(priority: string): Tone {
  if (priority === "CRITICAL") return "crit";
  if (priority === "HIGH") return "warn";
  if (priority === "MEDIUM") return "accent";
  return "neutral";
}
