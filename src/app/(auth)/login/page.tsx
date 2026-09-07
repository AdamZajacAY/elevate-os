import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { googleEnabled } from "@/lib/auth";

export const metadata = { title: "Logowanie — ELEVATE OS" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-5 py-12">
      <div className="w-full max-w-[400px]">
        <p className="font-mono text-[11px] font-bold tracking-[0.18em] text-accent">
          ADVISE YOU <span className="text-ink">· Smart Advise. Real Impact.</span>
        </p>
        <h1 className="mt-5 font-display text-[34px] font-black leading-tight tracking-tight text-ink">
          ELEVATE OS
        </h1>
        <p className="mt-1.5 text-[13.5px] text-ink-soft">
          Projekty, finanse operacyjne i relacje z klientami w jednym modelu danych.
        </p>

        <Suspense>
          <LoginForm googleEnabled={googleEnabled} />
        </Suspense>
      </div>
    </main>
  );
}
