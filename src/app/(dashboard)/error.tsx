"use client";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-[560px] py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-wider text-crit">Błąd</p>
      <h1 className="mt-2 font-display text-[24px] font-black text-ink">
        Nie udało się wczytać widoku
      </h1>
      <p className="mt-2 text-[13.5px] text-ink-soft">
        Spróbuj ponownie. Jeśli błąd się powtarza, zgłoś go administratorowi.
      </p>
      <button
        onClick={reset}
        className="mt-5 rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90"
      >
        Spróbuj ponownie
      </button>
    </div>
  );
}
