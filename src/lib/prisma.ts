import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Klient bazy. Postgres jest baza kanoniczna — takze lokalnie.
 *
 * Wczesniej projekt stal na SQLite i kusi, zeby zostawic go do developmentu.
 * Nie zostawiamy: `contains` w SQLite ignoruje wielkosc liter, w Postgresie nie,
 * wiec wyszukiwarka klientow zachowywalaby sie inaczej lokalnie niz na produkcji
 * — i to bez zadnego bledu, ktory by o tym powiedzial.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Brak DATABASE_URL — skopiuj .env.example do .env");

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      // Render wymaga TLS; lokalny Postgres zwykle go nie ma.
      ...(connectionString.includes("localhost") || connectionString.includes("127.0.0.1")
        ? {}
        : { ssl: { rejectUnauthorized: false } }),
    }),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
