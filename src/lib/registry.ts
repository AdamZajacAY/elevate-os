/**
 * Pobranie danych rejestrowych klienta (spec 05/09).
 *
 * Zapytania ida wprost z przegladarki do rejestrow panstwowych — serwer ELEVATE
 * nie posredniczy, wiec NIP klienta nie przechodzi przez nasz backend. Domeny sa
 * na bialej liscie CSP w next.config.ts; kazda inna zostanie zablokowana.
 */

export type RegistryResult = {
  name: string;
  nip: string | null;
  regon: string | null;
  krs: string | null;
  address: string | null;
  city: string | null;
};

/** Wyciaga miasto z jednolinijkowego adresu w formacie "ul. X, 00-000 MIASTO". */
function cityFromAddress(address: string | null): string | null {
  if (!address) return null;
  const match = address.match(/\d{2}-\d{3}\s+(.+?)(?:,|$)/);
  return match ? match[1].trim() : null;
}

/**
 * Wykaz podatnikow VAT Ministerstwa Finansow — jedyne zrodlo, ktore po NIP
 * oddaje komplet: nazwe, REGON, KRS i adres.
 */
export async function lookupByNip(nip: string): Promise<RegistryResult> {
  const clean = nip.replace(/[\s-]/g, "");
  if (!/^\d{10}$/.test(clean)) throw new Error("NIP musi mieć 10 cyfr");

  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(`https://wl-api.mf.gov.pl/api/search/nip/${clean}?date=${today}`);

  if (res.status === 400) throw new Error("Rejestr odrzucił ten NIP jako nieprawidłowy");
  if (!res.ok) throw new Error(`Rejestr niedostępny (HTTP ${res.status})`);

  const json = (await res.json()) as {
    result?: {
      subject?: {
        name?: string;
        nip?: string;
        regon?: string;
        krs?: string;
        workingAddress?: string;
        residenceAddress?: string;
      } | null;
    };
  };

  const subject = json.result?.subject;
  if (!subject) throw new Error("Nie znaleziono podmiotu o tym NIP w wykazie MF");

  const address = subject.workingAddress ?? subject.residenceAddress ?? null;
  return {
    name: subject.name ?? "",
    nip: subject.nip ?? clean,
    regon: subject.regon ?? null,
    krs: subject.krs ?? null,
    address,
    city: cityFromAddress(address),
  };
}

/** Krajowy Rejestr Sadowy — po numerze KRS, z rejestru przedsiebiorcow (P). */
export async function lookupByKrs(krs: string): Promise<RegistryResult> {
  const clean = krs.replace(/[\s-]/g, "");
  if (!/^\d{1,10}$/.test(clean)) throw new Error("Numer KRS to maksymalnie 10 cyfr");

  const padded = clean.padStart(10, "0");
  const res = await fetch(`https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/${padded}?rejestr=P&format=json`);

  if (res.status === 404) throw new Error("Nie znaleziono podmiotu o tym numerze KRS");
  if (!res.ok) throw new Error(`Rejestr KRS niedostępny (HTTP ${res.status})`);

  const json = (await res.json()) as {
    odpis?: {
      dane?: {
        dzial1?: {
          danePodmiotu?: { nazwa?: string; identyfikatory?: { nip?: string; regon?: string } };
          siedzibaIAdres?: {
            siedziba?: { miejscowosc?: string };
            adres?: { ulica?: string; nrDomu?: string; kodPocztowy?: string; miejscowosc?: string };
          };
        };
      };
    };
  };

  const dzial1 = json.odpis?.dane?.dzial1;
  const podmiot = dzial1?.danePodmiotu;
  if (!podmiot?.nazwa) throw new Error("Rejestr KRS nie zwrócił danych podmiotu");

  const adres = dzial1?.siedzibaIAdres?.adres;
  const address = adres
    ? [
        [adres.ulica, adres.nrDomu].filter(Boolean).join(" "),
        [adres.kodPocztowy, adres.miejscowosc].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  return {
    name: podmiot.nazwa,
    nip: podmiot.identyfikatory?.nip ?? null,
    regon: podmiot.identyfikatory?.regon ?? null,
    krs: padded,
    address,
    city: adres?.miejscowosc ?? dzial1?.siedzibaIAdres?.siedziba?.miejscowosc ?? null,
  };
}
