import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Szyfrowanie sekretow przechowywanych w bazie (RODO art. 32 — bezpieczenstwo
 * przetwarzania).
 *
 * Dotyczy tokenow OAuth Google: kopia bazy albo wyciek pliku `dev.db` nie moze
 * oddac napastnikowi dostepu do kalendarzy uzytkownikow. Klucz wyprowadzamy
 * z `AUTH_SECRET` przez HKDF z odrebna etykieta — nie wprowadzamy kolejnej
 * zmiennej srodowiskowej, ktora ktos zapomni ustawic, a jednoczesnie klucz
 * szyfrujacy nie jest tym samym bajtem co sekret sesji.
 *
 * AES-256-GCM daje szyfrowanie i uwierzytelnienie naraz — podmiana ciphertextu
 * w bazie konczy sie bledem deszyfrowania, nie cichym zwroceniem smieci.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX = "enc:v1:";

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET jest wymagany do szyfrowania sekretow");
  // Sol stala i jawna: nie chroni przed niczym, czego nie chroni sam sekret,
  // a losowa wymagalaby przechowywania jej obok szyfrogramu.
  return Buffer.from(hkdfSync("sha256", secret, "elevate-os-at-rest", "google-oauth", 32));
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Odszyfrowuje wartosc. Tekst bez prefiksu jest zwracany bez zmian — dzieki temu
 * wdrozenie, ktore mialo juz zapisane tokeny sprzed wprowadzenia szyfrowania,
 * dziala dalej i szyfruje je przy najblizszym zapisie.
 */
export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) return value;

  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const encrypted = raw.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Czy wartosc jest juz zaszyfrowana — uzywane przy migracji istniejacych danych. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
