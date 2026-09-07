import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 text-center">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-accent">404</p>
        <h1 className="mt-2 font-display text-[26px] font-black text-ink">Nie znaleziono strony</h1>
        <Link
          href="/dashboard"
          className="mt-5 inline-block rounded-lg bg-accent-deep px-5 py-2.5 text-[14px] font-bold text-white hover:opacity-90"
        >
          Wróć na pulpit
        </Link>
      </div>
    </main>
  );
}
