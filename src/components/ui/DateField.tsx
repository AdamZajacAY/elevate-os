"use client";

import { useRef } from "react";

/**
 * Pole daty z działającym kalendarzem.
 *
 * Natywny `<input type="date">` ma dwa problemy, przez które wygląda na zepsuty:
 *  1. ikona kalendarza jest czarną grafiką przeglądarki — w ciemnym motywie
 *     staje się niewidoczna (patrz `globals.css`, filtr na
 *     `::-webkit-calendar-picker-indicator`),
 *  2. kalendarz otwiera się wyłącznie po trafieniu w tę kilkupikselową ikonę;
 *     kliknięcie w pole tylko ustawia kursor na segmencie dnia/miesiąca.
 *
 * `showPicker()` otwiera natywny kalendarz z dowolnego miejsca pola. Zostajemy
 * przy natywnym, bo daje za darmo obsługę klawiatury, czytników ekranu,
 * lokalizacji dat i klawiaturę numeryczną na telefonie — własny komponent
 * musiałby to wszystko odtworzyć.
 */
export function DateField({
  name,
  defaultValue,
  value,
  onChange,
  required,
  className,
  id,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = ref.current;
    if (!el) return;
    try {
      // Nieobsługiwane w części przeglądarek — wtedy zostaje zachowanie natywne.
      el.showPicker?.();
    } catch {
      // showPicker() rzuca, gdy wywołanie nie pochodzi z gestu użytkownika.
    }
  }

  return (
    <input
      ref={ref}
      id={id}
      type="date"
      name={name}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      required={required}
      onClick={openPicker}
      onFocus={openPicker}
      className={`cursor-pointer ${className ?? ""}`}
    />
  );
}
