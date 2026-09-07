import "dotenv/config";
import { backupOnStartup } from "../src/server/services/backup";

/**
 * Kopia zapasowa "automatyczna przy starcie" (spec 10).
 *
 * Uruchamiana jako osobny proces przed startem serwera, a nie przez
 * `instrumentation.ts` Next.js — ten kompiluje się także dla środowiska edge,
 * które nie ma `node:fs` ani sterownika SQLite, co wywracało cały serwer.
 * Osobny proces nie dotyka bundlera i działa tak samo w dev i w produkcji.
 */
async function main() {
  try {
    const backup = await backupOnStartup();
    if (backup) {
      console.info(
        `[backup] kopia startowa: ${backup.name} (${Math.round(backup.sizeBytes / 1024)} kB)`,
      );
    } else {
      console.info("[backup] dzisiejsza kopia startowa już istnieje — pomijam");
    }
  } catch (err) {
    // Nieudana kopia nie może zablokować startu aplikacji.
    console.error("[backup] kopia startowa nieudana:", err instanceof Error ? err.message : err);
  }
  process.exit(0);
}

main();
