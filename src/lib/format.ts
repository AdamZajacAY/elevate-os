/** Formatowanie wspolne dla calego interfejsu — polskie konwencje. */

export function formatMoney(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(new Date(value));
}

/** Ile dni do terminu; wartosc ujemna = po terminie. */
export function daysUntil(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const target = new Date(value);
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(value)} h`;
}

/**
 * Czy praca zamknieta w terminie.
 *
 * Termin pochodzi z pola daty, wiec jest zapisany o polnocy (`2026-09-06T00:00`),
 * a `completedAt` to znacznik chwili zamkniecia (`2026-09-06T09:00`). Naiwne
 * `completedAt <= dueDate` liczylo wiec kazde zadanie zamkniete w dniu terminu
 * jako spoznione — a to najczestszy przypadek. Porownujemy do konca dnia terminu.
 */
export function isOnTime(completedAt: Date, dueDate: Date): boolean {
  const endOfDueDay = new Date(dueDate);
  endOfDueDay.setHours(23, 59, 59, 999);
  return completedAt <= endOfDueDay;
}

/** Poczatek dnia — dolna granica okien czasowych liczonych w dniach. */
export function startOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
