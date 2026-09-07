import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/domain";
import { canRead, type ModuleKey } from "@/lib/rbac";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  theme: string;
  defaultView: string;
  urgentDays: number;
};

/**
 * Uprawnienia czytane swiezo z bazy przy kazdym zadaniu — dezaktywacja konta
 * lub zmiana roli dziala natychmiast, bez czekania na wygasniecie tokenu (spec 06).
 * Zwraca null zamiast rzucac, zeby wolajacy zdecydowal o przekierowaniu vs 401.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      theme: true,
      defaultView: true,
      urgentDays: true,
    },
  });
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as Role,
    theme: user.theme,
    defaultView: user.defaultView,
    urgentDays: user.urgentDays,
  };
});

/** Wersja dla stron — przekierowuje na logowanie zamiast zwracac null. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Wersja dla stron modulowych — dodatkowo sprawdza dostep do modulu. */
export async function requireModule(module: ModuleKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canRead(user.role, module)) redirect("/dashboard?brak-dostepu=" + module);
  return user;
}
