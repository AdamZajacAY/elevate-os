"use client";

import { useState } from "react";
import { DateField } from "@/components/ui/DateField";
import {
  BILLING_MODELS,
  BILLING_MODEL_LABEL,
  BILLING_PERIODS,
  BILLING_PERIOD_LABEL,
  PHASES,
  PHASE_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  SERVICE_TYPES,
  SERVICE_TYPE_LABEL,
} from "@/lib/domain";

export const projectField =
  "mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[14px] text-ink outline-none focus:border-accent";
export const projectLabel = "font-mono text-[10.5px] uppercase tracking-wider text-muted";

export type ProjectFormValues = {
  id: string;
  name: string;
  clientId: string;
  serviceType: string;
  ownerId: string | null;
  phase: string;
  status: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  contractValue: number | null;
  quotedValue: number | null;
  billingModel: string;
  billingPeriod: string | null;
  recurringAmount: number | null;
  billingStartDate: string | null;
  billingEndDate: string | null;
  noticePeriodDays: number | null;
};

/** Data z bazy do formatu, którego oczekuje pole daty. */
const asDate = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

/**
 * Pola karty projektu — wspólne dla zakładania i edycji.
 *
 * Wcześniej istniały tylko w formularzu zakładania. Przepisanie ich do osobnego
 * okna edycji dałoby dwa zestawy, które rozjeżdżają się przy pierwszej zmianie
 * — a pól jest tu kilkanaście, w tym cała sekcja rozliczenia.
 *
 * Komponent zwraca same pola; przyciski i wysyłkę obsługuje wołający, bo
 * inaczej wygląda to na stronie zakładania, a inaczej w oknie edycji.
 */
export function ProjectFields({
  project,
  clients,
  owners,
  showFinancials,
  onBillingModelChange,
}: {
  project?: ProjectFormValues;
  clients: { id: string; name: string }[];
  owners: { id: string; fullName: string }[];
  showFinancials: boolean;
  onBillingModelChange?: (model: string) => void;
}) {
  const [billingModel, setBillingModel] = useState(project?.billingModel ?? "JEDNORAZOWY");
  // Brak daty końca przy abonamencie oznacza czas nieokreślony.
  const [openEnded, setOpenEnded] = useState(
    project?.billingModel === "ABONAMENT" && !project?.billingEndDate,
  );

  function pickModel(next: string) {
    setBillingModel(next);
    onBillingModelChange?.(next);
  }

  return (
    <>
      <label className="block">
        <span className={projectLabel}>Nazwa projektu</span>
        <input
          name="name"
          required
          minLength={3}
          defaultValue={project?.name ?? ""}
          className={projectField}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={projectLabel}>Klient</span>
          <select
            name="clientId"
            required
            className={projectField}
            defaultValue={project?.clientId ?? ""}
          >
            <option value="" disabled>
              Wybierz klienta…
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={projectLabel}>Typ usługi</span>
          <select
            name="serviceType"
            required
            className={projectField}
            defaultValue={project?.serviceType ?? SERVICE_TYPES[0]}
          >
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>
                {SERVICE_TYPE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={projectLabel}>Opiekun projektu</span>
          <select name="ownerId" className={projectField} defaultValue={project?.ownerId ?? ""}>
            <option value="">nieprzypisany</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.fullName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={projectLabel}>Faza Elevate</span>
          <select name="phase" className={projectField} defaultValue={project?.phase ?? "EXPLORE"}>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {PHASE_LABEL[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={projectLabel}>Status</span>
          <select name="status" className={projectField} defaultValue={project?.status ?? "ACTIVE"}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <div />

        <label className="block">
          <span className={projectLabel}>Start</span>
          <DateField name="startDate" defaultValue={asDate(project?.startDate)} className={projectField} />
        </label>

        <label className="block">
          <span className={projectLabel}>Planowany koniec</span>
          <DateField name="endDate" defaultValue={asDate(project?.endDate)} className={projectField} />
        </label>
      </div>

      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-2 font-mono text-[10.5px] uppercase tracking-wider text-accent">
          Rozliczenie
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={projectLabel}>Model</span>
            <select
              name="billingModel"
              value={billingModel}
              onChange={(e) => pickModel(e.target.value)}
              className={projectField}
            >
              {BILLING_MODELS.map((m) => (
                <option key={m} value={m}>
                  {BILLING_MODEL_LABEL[m]}
                </option>
              ))}
            </select>
          </label>

          {billingModel === "ABONAMENT" && (
            <label className="block">
              <span className={projectLabel}>Okres rozliczeniowy</span>
              <select
                name="billingPeriod"
                className={projectField}
                defaultValue={project?.billingPeriod ?? "MIESIECZNY"}
              >
                {BILLING_PERIODS.map((b) => (
                  <option key={b} value={b}>
                    {BILLING_PERIOD_LABEL[b]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {billingModel === "ABONAMENT" && (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {showFinancials && (
                <label className="block">
                  <span className={projectLabel}>Kwota za okres (PLN)</span>
                  <input
                    name="recurringAmount"
                    inputMode="decimal"
                    defaultValue={project?.recurringAmount ?? ""}
                    className={projectField}
                  />
                </label>
              )}
              <label className="block">
                <span className={projectLabel}>Start rozliczeń</span>
                <DateField
                  name="billingStartDate"
                  defaultValue={asDate(project?.billingStartDate)}
                  className={projectField}
                />
              </label>
            </div>

            <label className="mt-4 flex items-center gap-2.5">
              <input
                type="checkbox"
                name="openEnded"
                checked={openEnded}
                onChange={(e) => setOpenEnded(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent-deep)]"
              />
              <span className="text-[13px] text-ink-soft">
                Czas nieokreślony — umowa trwa do wypowiedzenia
              </span>
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {!openEnded && (
                <label className="block">
                  <span className={projectLabel}>Koniec rozliczeń</span>
                  <DateField
                    name="billingEndDate"
                    defaultValue={asDate(project?.billingEndDate)}
                    className={projectField}
                  />
                </label>
              )}
              <label className="block">
                <span className={projectLabel}>Okres wypowiedzenia (dni)</span>
                <input
                  name="noticePeriodDays"
                  type="number"
                  min={0}
                  max={365}
                  defaultValue={project?.noticePeriodDays ?? ""}
                  className={projectField}
                />
              </label>
            </div>

            <p className="mt-3 text-[12px] text-muted">
              Przychód abonamentu liczy się z okresów, które minęły — nie z wartości umowy.
              Przy czasie nieokreślonym wartość umowy zostaw pustą.
            </p>
          </>
        )}
      </fieldset>

      {showFinancials && (
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-2 font-mono text-[10.5px] uppercase tracking-wider text-accent">
            Finanse
          </legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={projectLabel}>Wycena (PLN)</span>
              <input
                name="quotedValue"
                inputMode="decimal"
                defaultValue={project?.quotedValue ?? ""}
                className={projectField}
              />
            </label>
            <label className="block">
              <span className={projectLabel}>Wartość umowy (PLN)</span>
              <input
                name="contractValue"
                inputMode="decimal"
                defaultValue={project?.contractValue ?? ""}
                className={projectField}
              />
            </label>
            <label className="block">
              <span className={projectLabel}>Budżet kosztowy (PLN)</span>
              <input
                name="budget"
                inputMode="decimal"
                defaultValue={project?.budget ?? ""}
                className={projectField}
              />
            </label>
          </div>
        </fieldset>
      )}

      <label className="block">
        <span className={projectLabel}>Opis / zakres</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={project?.description ?? ""}
          className={projectField}
        />
      </label>
    </>
  );
}

/**
 * Zbiera pola formularza do ciała żądania. Wspólne dla zakładania i edycji,
 * żeby jedna zmiana pola nie wymagała poprawki w dwóch miejscach.
 */
export function collectProjectPayload(form: FormData, showFinancials: boolean) {
  const text = (k: string) => String(form.get(k) ?? "").trim();
  const num = (k: string) => {
    const raw = text(k);
    return raw === "" ? null : Number(raw.replace(",", "."));
  };

  const billingModel = text("billingModel") || "JEDNORAZOWY";
  const isRecurring = billingModel === "ABONAMENT";
  const openEnded = form.get("openEnded") === "on";

  return {
    name: text("name"),
    clientId: text("clientId"),
    serviceType: text("serviceType"),
    ownerId: text("ownerId") || null,
    phase: text("phase"),
    status: text("status"),
    description: text("description"),
    startDate: text("startDate") || null,
    endDate: text("endDate") || null,
    billingModel,
    billingPeriod: isRecurring ? text("billingPeriod") || "MIESIECZNY" : null,
    billingStartDate: isRecurring ? text("billingStartDate") || null : null,
    billingEndDate: isRecurring && !openEnded ? text("billingEndDate") || null : null,
    noticePeriodDays: isRecurring ? num("noticePeriodDays") : null,
    ...(showFinancials
      ? {
          budget: num("budget"),
          contractValue: num("contractValue"),
          quotedValue: num("quotedValue"),
          recurringAmount: isRecurring ? num("recurringAmount") : null,
        }
      : {}),
  };
}
