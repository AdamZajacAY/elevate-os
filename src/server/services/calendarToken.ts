import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Token subskrypcji kalendarza. Aplikacja kalendarza (Google, Outlook, Apple)
 * nie ma ciasteczka sesji, więc feed autoryzuje się sekretem w adresie.
 *
 * Token jest losowy (32 bajty), przypisany do jednego konta i **odwoływalny** —
 * wygenerowanie nowego natychmiast unieważnia poprzedni adres subskrypcji.
 */

export async function ensureCalendarToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarToken: true },
  });
  if (user?.calendarToken) return user.calendarToken;
  return rotateCalendarToken(userId);
}

export async function rotateCalendarToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.user.update({ where: { id: userId }, data: { calendarToken: token } });
  return token;
}

/** Zwraca konto właściciela tokenu — tylko aktywne, bo dezaktywacja ma działać od razu. */
export async function userByCalendarToken(token: string) {
  if (!token || token.length !== 64) return null;
  const user = await prisma.user.findUnique({
    where: { calendarToken: token },
    select: { id: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return user;
}
