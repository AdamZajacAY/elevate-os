"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientDialog, type ClientFormValues } from "@/components/crm/ClientDialog";

/** Przycisk edycji na karcie klienta — strona jest serwerowa, okno musi być klienckie. */
export function EditClientButton({ client }: { client: ClientFormValues }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-surface-2"
      >
        Edytuj
      </button>

      {open && (
        <ClientDialog
          client={client}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
