"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  // Bez jawnego celu ladujemy w korzeniu, ktory przekierowuje na widok startowy uzytkownika.
  const callbackUrl = params.get("callbackUrl") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const res = await signIn("credentials", { email, password, redirect: false });

    if (res?.error) {
      // Komunikat celowo nie rozroznia zlego hasla od nieistniejacego konta
      // ani od blokady — inaczej byłby wyrocznią, czy dany e-mail istnieje.
      setError("Nieprawidłowy e-mail lub hasło, albo konto jest zablokowane.");
      setPending(false);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-7 rounded-2xl border border-border bg-surface p-6 shadow-card"
    >
      <label className="block">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">E-mail</span>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
        />
      </label>

      <label className="mt-4 block">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">Hasło</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
        />
      </label>

      {error && (
        <p className="mt-4 rounded-lg border border-crit bg-crit-soft px-3 py-2 text-[13px] text-crit">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full rounded-lg bg-accent-deep px-4 py-2.5 text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Logowanie…" : "Zaloguj się"}
      </button>

      {googleEnabled && (
        <>
          <div className="my-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted">albo</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-[14px] font-semibold text-ink hover:bg-surface-2"
          >
            Zaloguj przez Google
          </button>

          <p className="mt-2.5 text-center text-[11.5px] text-muted">
            Zalogujesz się tylko na konto, które już istnieje w systemie.
          </p>
        </>
      )}
    </form>
  );
}
