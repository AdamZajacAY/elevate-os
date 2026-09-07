import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h3 className="font-display text-[15.5px] font-bold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Kafelek liczbowy — uzywany na dashboardzie i karcie projektu. */
export function StatTile({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  // ReactNode, a nie string — kafelek z polem zredagowanym podaje <RedactedValue />,
  // wiec bez tego trzy widoki przepisywaly caly kafelek recznie.
  value: ReactNode;
  hint?: ReactNode;
  tone?: "ink" | "good" | "warn" | "crit" | "accent";
}) {
  const toneClass = {
    ink: "text-ink",
    good: "text-good",
    warn: "text-warn",
    crit: "text-crit",
    accent: "text-accent",
  }[tone];

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1.5 font-display text-2xl font-bold tabular-nums ${toneClass}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[12px] text-muted">{hint}</div>}
    </div>
  );
}

/** Placeholder dla pola finansowego zredagowanego wg roli (spec 04). */
export function RedactedValue() {
  return (
    <span
      className="font-mono text-[12.5px] text-muted"
      title="Pole finansowe niedostępne dla Twojej roli"
    >
      ——
    </span>
  );
}
