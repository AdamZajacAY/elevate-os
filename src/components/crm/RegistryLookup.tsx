"use client";

import { useState } from "react";
import { lookupByNip, lookupByKrs, type RegistryResult } from "@/lib/registry";

/**
 * Pobranie danych rejestrowych jednym klikniecim (spec 05).
 * Wynik nie zapisuje sie sam — wypelnia pola formularza, ktore uzytkownik
 * moze poprawic przed zapisem.
 */
export function RegistryLookup({ onResult }: { onResult: (data: RegistryResult) => void }) {
  const [mode, setMode] = useState<"nip" | "krs">("nip");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function lookup() {
    setPending(true);
    setError(null);
    try {
      const data = mode === "nip" ? await lookupByNip(value) : await lookupByKrs(value);
      onResult(data);
    } catch (e) {
      // Blad sieci z zablokowanego CSP wyglada jak TypeError bez tresci —
      // komunikat musi byc czytelny mimo to.
      setError(e instanceof Error && e.message ? e.message : "Nie udało się połączyć z rejestrem");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3.5">
      <p className="font-mono text-[10.5px] uppercase tracking-wider text-accent">
        Pobierz z rejestru
      </p>
      <p className="mt-0.5 text-[12px] text-muted">
        Dane z wykazu MF (po NIP) albo z KRS. Zapytanie idzie wprost z Twojej przeglądarki.
      </p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <div className="flex rounded-lg border border-border bg-surface p-0.5">
          {(["nip", "krs"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-[6px] px-2.5 py-1 text-[11.5px] font-bold uppercase transition-colors ${
                mode === m ? "bg-accent-soft text-accent" : "text-muted hover:text-ink"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter w polu wewnatrz formularza wyslalby caly formularz.
            if (e.key === "Enter") {
              e.preventDefault();
              lookup();
            }
          }}
          inputMode="numeric"
          placeholder={mode === "nip" ? "10 cyfr NIP" : "numer KRS"}
          className="min-w-[140px] flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
        />

        <button
          type="button"
          onClick={lookup}
          disabled={pending || value.trim() === ""}
          className="rounded-lg bg-accent-deep px-3.5 py-1.5 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Pobieranie…" : "Pobierz"}
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] text-crit">{error}</p>}
    </div>
  );
}
