import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Zakłada pierwsze konto administratora na świeżym wdrożeniu.
 *
 * Bez logowania Google jedyną drogą do środka jest hasło, a świeża baza jest
 * pusta — bez tego skryptu nie da się wejść do aplikacji, którą się właśnie
 * wdrożyło. Seed tego nie załatwia, bo wsypuje dane demonstracyjne, których
 * na produkcji nie chcemy.
 *
 * Uruchomienie (Render → Shell albo lokalnie):
 *   ADMIN_EMAIL=adam@adviseyou.pl ADMIN_PASSWORD='...' npm run db:bootstrap
 *
 * Skrypt jest idempotentny: istniejące konto dostaje rolę ADMIN i nowe hasło,
 * zamiast tworzyć duplikat.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME?.trim() || "Administrator";

  if (!email || !password) {
    console.error(
      "Wymagane zmienne: ADMIN_EMAIL i ADMIN_PASSWORD.\n" +
        "Przykład:  ADMIN_EMAIL=adam@adviseyou.pl ADMIN_PASSWORD='...' npm run db:bootstrap",
    );
    process.exit(1);
  }

  // Ten sam próg co w formularzu zakładania kont — nie robimy wyjątku dla
  // konta, które ma najszersze uprawnienia w systemie.
  if (password.length < 10) {
    console.error("Hasło musi mieć minimum 10 znaków.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", isActive: true, passwordHash, anonymizedAt: null },
    create: { email, fullName, role: "ADMIN", isActive: true, passwordHash },
    select: { id: true, email: true, fullName: true },
  });

  console.log(
    existing
      ? `Konto ${user.email} podniesione do roli Administrator, hasło zmienione.`
      : `Utworzono konto administratora: ${user.fullName} <${user.email}>`,
  );
  console.log("Zaloguj się i od razu zmień hasło w panelu.");

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Nie udało się utworzyć konta:", err instanceof Error ? err.message : err);
  await prisma.$disconnect();
  process.exit(1);
});
