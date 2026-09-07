# ELEVATE OS

Platforma pracy projektowej, finansów operacyjnych i relacji z klientami zespołu doradczego
**AdviseYou**. Zbudowana wokół metody **Explore → Engineer → Execute → Elevate**.

Wdrożenie prowadzone wg specyfikacji funkcjonalnej v1.0 (artefakt `ELEVATE OS`).
Stan bieżący: **cały zakres specyfikacji wdrożony** — pięć faz roadmapy plus integracje
i wymagania operacyjne z sekcji 09 i 10 (kalendarz, poczta, Google OAuth, kopie zapasowe,
harmonogram skanu powiadomień).

---

## Uruchomienie lokalne

Wymagany **Postgres** — także lokalnie. SQLite nie jest już wspierany: `contains` ignoruje
w nim wielkość liter, w Postgresie nie, więc wyszukiwarka klientów zachowywałaby się inaczej
lokalnie niż na produkcji, i to bez żadnego błędu, który by o tym powiedział.

```bash
brew install postgresql@16 && brew services start postgresql@16
createdb elevate_os

cp .env.example .env      # ustaw DATABASE_URL na swojego użytkownika systemowego
npm install
npm run db:deploy         # zastosowanie migracji
npm run db:seed           # dane demonstracyjne AdviseYou
npm run dev               # http://localhost:3002
```

> **Uwaga o ścieżce.** Katalog projektu zawiera dwukropek (`TODO:CRM_AY`), który npm traktuje
> jako separator `PATH` — dlatego skrypty w `package.json` wołają binaria wprost przez `node`
> (`node ./node_modules/next/dist/bin/next dev`), a nie przez `node_modules/.bin`. `npx` w tym
> katalogu **nie zadziała**. Zmiana nazwy katalogu na `TODO-CRM_AY` usunęłaby ten wyjątek.

`npm run dev` robi najpierw kopię zapasową bazy (raz na dobę), potem startuje serwer.
Samą kopię wywołasz przez `npm run backup`.

---

## Wdrożenie na Render

Konfiguracja jest w [`render.yaml`](render.yaml) — blueprint tworzy usługę web i bazę Postgres.

**Co robi Render sam:** podstawia `DATABASE_URL`, generuje `AUTH_SECRET` i `CRON_SECRET`,
ustawia `AUTH_URL` na publiczny adres usługi. Przy każdym wdrożeniu `npm run start` najpierw
dokłada migracje (`prisma migrate deploy`), potem podnosi serwer.

**Co musisz zrobić sam:** utworzyć pierwsze konto administratora — świeża baza jest pusta,
a logowanie hasłem wymaga istniejącego konta. W Render → **Shell**:

```bash
ADMIN_EMAIL=adam@adviseyou.pl ADMIN_PASSWORD='dlugie-haslo-min-10-znakow' \
  ADMIN_NAME='Adam Zając' npm run db:bootstrap
```

Skrypt jest idempotentny — na istniejącym koncie podnosi rolę do Administratora i ustawia
nowe hasło, zamiast tworzyć duplikat. Po zalogowaniu zmień hasło i zakładaj kolejne konta
z panelu administracyjnego.

Zmiennych `AUTH_SECRET`, `CRON_SECRET`, `DATABASE_URL` i `AUTH_URL` nie ustawiasz —
Render robi to sam (patrz `render.yaml`).

### Ograniczenia planu darmowego

| Rzecz | Plan free | Co z tym zrobić |
|---|---|---|
| Baza Postgres | kasowana po 30 dniach, **bez kopii zapasowych** | plan `starter` przed wprowadzeniem prawdziwych danych |
| Usługa web | usypia po 15 min bezczynności, zimny start ~30 s | plan `starter` |
| Zadania cron | niedostępne | do tego czasu Administrator uruchamia skan i sprzątanie z panelu |
| Dysk | efemeryczny — znika przy wdrożeniu | kopie zapasowe pobierasz na swój dysk (tak działa panel) |

### Kopie zapasowe po migracji

Na SQLite robiliśmy `VACUUM INTO`. Na Postgresie kopia to **zrzut logiczny wszystkich tabel
w JSON**, robiony przez Prismę — bez zależności od `pg_dump`, którego obraz Rendera nie ma.
Administrator pobiera go na swój dysk. To uzupełnienie kopii zarządzanych przez Render,
nie ich zamiennik.

---

### Konta demonstracyjne

| E-mail | Rola | Hasło |
|---|---|---|
| `admin@adviseyou.pl` | Administrator | `Admin2026!` |
| `partner@adviseyou.pl` | Partner / Zarząd | `Haslo2026!` |
| `konsultant@adviseyou.pl` | Konsultant | `Haslo2026!` |
| `konsultant2@adviseyou.pl` | Konsultant | `Haslo2026!` |

Zaloguj się jako partner i jako konsultant obok siebie — różnica w widoczności pól finansowych
i zakresie projektów jest natychmiast widoczna.

---

## Stos

Next.js 15 (App Router) · React 19 · Prisma 7 · SQLite · NextAuth v5 · Tailwind 4 · Zod 4.

Baza rozwojowa to SQLite. Przejście na Supabase/Postgres wymaga trzech zmian:
`provider` w `prisma/schema.prisma`, adaptera w [`src/lib/prisma.ts`](src/lib/prisma.ts)
(`@prisma/adapter-pg`) i `DATABASE_URL`. Schemat jest pisany kompatybilnie — bez enumów
Prismy, bez typów specyficznych dla SQLite.

---

## Co jest wdrożone

### Model danych (spec 08)
25 modeli w [`prisma/schema.prisma`](prisma/schema.prisma), z polskimi nazwami tabel przez `@@map`.
Pokrywa wszystkie encje ze specyfikacji: CRM, praca projektowa, zespół, status i ryzyko,
współpraca, konfiguracja. Encje faz 2–4 istnieją w bazie, ale nie mają jeszcze ekranów.

### Uprawnienia i redakcja finansowa (spec 04, 06)
- **[`src/lib/rbac.ts`](src/lib/rbac.ts)** — dostęp do modułów, prawo zapisu, zawężanie
  widoczności projektów (`projectScopeWhere`).
- **[`src/lib/redact.ts`](src/lib/redact.ts)** — pola finansowe zerowane **na granicy odpowiedzi
  serwera**, nie ukrywane w komponencie. Konsultant nie dostaje tych wartości nawet
  w surowej odpowiedzi API.
- **[`src/server/session.ts`](src/server/session.ts)** — uprawnienia czytane świeżo z bazy przy
  każdym żądaniu, więc dezaktywacja konta działa natychmiast, bez czekania na wygaśnięcie tokenu.

Zweryfikowane na działającym serwerze: partner widzi 4 projekty z kwotami, konsultant — 3 projekty
z `contractValue: null`; próba założenia projektu przez konsultanta kończy się `403`.

### Praca projektowa (spec 03)
- Lista projektów z filtrami w URL, karta projektu, formularz zakładania.
- **Checklista instancjonowana automatycznie** z szablonu typu usługi w chwili założenia projektu
  ([`src/server/services/checklist.ts`](src/server/services/checklist.ts)) — sześć szablonów
  w seedzie, 38 pozycji łącznie.
- Zadania w trzech widokach: **Kanban**, **Lista**, **Moje zadania**, ze zmianą statusu wprost
  na tablicy (optymistyczną, z cofnięciem przy odmowie serwera).
- **Harmonogram wieloprojektowy** (Gantt) — etapy wszystkich widocznych projektów na wspólnej osi,
  z linią dnia dzisiejszego i kamieniami milowymi jako rombami.
- Rejestr ryzyk i kamieni milowych na karcie projektu.

### Status RAG (spec 03)
Liczony automatycznie, nie ustawiany ręcznie ([`src/server/services/rag.ts`](src/server/services/rag.ts)):

| Status | Warunek |
|---|---|
| **RED** | projekt po terminie końcowym · zadanie przeterminowane > 7 dni · otwarte ryzyko wysoki wpływ + wysokie prawdopodobieństwo |
| **AMBER** | jakiekolwiek zadanie lub kamień milowy po terminie · otwarte ryzyko wysokiego wpływu |
| **GREEN** | pozostałe |

Przeliczany po każdej zmianie zadania, terminu projektu i ryzyka.

### CRM (spec 05) — Faza 2
- Kartoteka klientów z segmentem, statusem współpracy i przypomnieniem o kliencie bez kontaktu
  ponad 30 dni.
- Kontakty z poziomem decyzyjnym; kontakt główny jest jeden — ustawienie nowego zdejmuje flagę
  z poprzedniego w tej samej transakcji.
- **Pipeline na fazach Elevate**, nie na generycznym lead/opportunity/won: Lead → Oferta ·
  Explore · Engineer/Execute · Elevate (stała opieka).
- **Konwersja szansy w projekt** ([`convert/route.ts`](src/app/api/opportunities/[id]/convert/route.ts)) —
  projekt dziedziczy klienta i wycenę, etap pipeline'u przekłada się na fazę projektu, klient
  awansuje z PROSPEKT na AKTYWNY, checklista powstaje sama. Kontakty **nie** są kopiowane:
  wiszą przy kliencie, a projekt na niego wskazuje — kopia zrobiłaby drugie źródło prawdy.
  Ponowna konwersja tej samej szansy kończy się `409`.
- Karta klienta z pełną historią współpracy: kontakty, szanse, wszystkie projekty w czasie.

### Dashboard finansowy (spec 04) — Faza 3
[`src/server/services/finance.ts`](src/server/services/finance.ts):
- **Rentowność** per projekt i per klient: wartość umowy vs. koszt pracy (godziny × stawka
  zamrożona w `TimeLog.rateSnapshot`) plus wartości umów podwykonawców. Projekt bez wartości
  umowy ma marżę `null`, nie zero — nieznane to nie to samo co zerowe.
- **Obciążenie zespołu**: zdolność = FTE × 8 h × dni robocze w oknie 30 dni; wykorzystanie
  liczone z rzeczywistych wpisów czasu.
- **Terminowość** zadań i kamieni milowych, osobno pozycje po terminie.
- **Pipeline wartości** ważony prawdopodobieństwem — prognoza, nie lista życzeń.
- **Raport executive** na żądanie z żywego stanu danych, eksport CSV (średnik + BOM, żeby
  Excel w polskiej lokalizacji otworzył go poprawnie) i wydruk do PDF.

### Biblioteka ekspertów (spec 03) — Faza 3
Kartoteka podwykonawców niezależna od projektów, z przypisaniami (zakres, wartość umowy, okres).
Koszt podwykonawcy wchodzi wprost do rentowności projektu. Ekspert z historią przypisań jest
dezaktywowany, nie usuwany — inaczej zamknięte projekty straciłyby składnik kosztu.

### Panel Usprawnień (spec 06) — Faza 4
Zgłaszanie pomysłów ze statusem rozpatrzenia (nowy / w analizie / wdrożony / odrzucony);
skrzynka wszystkich zgłoszeń widoczna dla Administratora, autor widzi swoje. Personalizacja:
motyw, widok startowy po zalogowaniu (wejście w `/` kieruje na wybrany widok) i próg dni,
po którym termin staje się pilny.

### Integracje rejestrowe (spec 09) — Faza 4
[`src/lib/registry.ts`](src/lib/registry.ts) — pobranie danych firmy po NIP z wykazu podatników
VAT Ministerstwa Finansów albo po numerze KRS. **Zapytanie idzie wprost z przeglądarki**, więc
NIP klienta nie przechodzi przez nasz backend; domeny są na białej liście CSP, każda inna jest
blokowana. Wynik wypełnia pola formularza, nie zapisuje się sam.

### Administracja (spec 06) — Faza 4
Konta i role, słowniki konfiguracyjne, dziennik audytu. **Ostatnie aktywne konto administracyjne
jest chronione** przed degradacją i dezaktywacją (`409`), także przed usunięciem samego siebie.
Konto z historią pracy jest dezaktywowane zamiast usuwane.

### Powiadomienia, notatki i komentarze (spec 03/05) — Faza 5
[`src/server/services/notifications.ts`](src/server/services/notifications.ts) — dwa źródła
powiadomień:
- **zdarzeniowe** — wzmianka w komentarzu, przypisanie zadania; tworzone przy zapisie,
- **proaktywne** — `scanForNotifications()` wykrywa zbliżające się terminy, opóźnienia,
  kamienie milowe i klientów bez kontaktu. Próg „zbliżającego się terminu" jest **indywidualny**:
  każdy użytkownik ma własne `urgentDays` z Panelu Usprawnień.

Każde powiadomienie ma klucz naturalny (rodzaj + link + odbiorca), więc ponowny skan nie zasypuje
skrzynki duplikatami — zweryfikowane: drugi skan pod rząd tworzy zero nowych wpisów.
Skan uruchamia Administrator z ekranu powiadomień; docelowo powinien wisieć na harmonogramie.

**Komentarze z @wzmiankami** pod zadaniem ([`TaskComments.tsx`](src/components/tasks/TaskComments.tsx)).
Wzmianka zapisuje się jako **id użytkownika, nie tekst** — zmiana nazwiska nie zrywa powiązania.
Usunięcie „@Imię Nazwisko" z treści przed wysłaniem cofa powiadomienie.

**Notatki ze spotkań** z konwersją punktu na zadanie jednym kliknięciem, bez opuszczania widoku
notatki. Punkt dłuższy niż 120 znaków trafia skrócony do tytułu, a w całości do opisu — nic
z ustalenia nie ginie. Notatka ze spotkania z klientem **przesuwa datę ostatniego kontaktu**,
inaczej przypomnienie o ciszy odpalałoby mimo odbytej rozmowy.

**Raporty statusowe** — historia RAG w czasie z paskiem, na którym widać, czy projekt się
poprawia, czy osuwa. RAG jest proponowany z wyliczenia, ale autor może go nadpisać: czasem
opiekun wie o czymś, czego terminy jeszcze nie pokazują. **Rozjazd między oceną a wyliczeniem
trafia do dziennika audytu** — sprawdzone: raport AMBER na projekcie wyliczonym jako RED
odnotował `override: true`.

**Karta zadania** ([`/tasks/[id]`](src/app/(dashboard)/tasks/[id]/page.tsx)) — opis, komentarze,
rejestracja czasu i historia wpisów w jednym miejscu.

### Kopie zapasowe (spec 10)
[`src/server/services/backup.ts`](src/server/services/backup.ts) — kopia robiona przez
`VACUUM INTO`, czyli **spójna przy żywej bazie**; zwykłe skopiowanie pliku przy otwartym WAL
dałoby kopię niespójną. Trzymamy dziesięć ostatnich, starsze kasujemy.

- **Automatyczna przy starcie** — [`scripts/startup-backup.ts`](scripts/startup-backup.ts)
  odpalany przez `npm run dev` / `npm run start` przed serwerem. Raz na dobę, żeby restart
  w pętli nie zasypał dysku.
- **Ręczna na żądanie** — z zakładki „Platforma" w panelu administracyjnym.

Zweryfikowane: kopia otwarta niezależnym klientem SQLite zawiera komplet danych
(5 projektów, 14 zadań, 4 klientów).

### Kalendarz — dwie ścieżki (spec 09)

**1. Integracja z Google Calendar** ([`googleCalendar.ts`](src/server/services/googleCalendar.ts)) —
ELEVATE OS zakłada w koncie użytkownika **osobny kalendarz „ELEVATE OS”** i wypycha do niego
kamienie milowe, spotkania i terminy projektów. Nie mieszamy terminów projektowych z kalendarzem
prywatnym, a odłączenie sprowadza się do usunięcia jednego kalendarza po stronie Google.

- Zgoda na kalendarz jest **osobna od logowania**. Logowanie prosi tylko o e-mail i imię; dostęp
  do kalendarza użytkownik nadaje świadomie i może go cofnąć bez tracenia możliwości logowania.
- Identyfikatory wydarzeń są **deterministyczne** (`sha1` z rodzaju i id encji, przemapowany
  na dozwolony przez Google alfabet base32hex) — ponowna synchronizacja aktualizuje wpisy
  zamiast je duplikować. Zweryfikowane: id są powtarzalne, rozdzielne między rodzajami
  i zgodne z regułami Google.
- Przepływ chroni **podpisany parametr `state`** (HMAC z `AUTH_SECRET`, ważność 10 minut) —
  bez niego ktoś mógłby podstawić własny kod autoryzacyjny i podpiąć swój kalendarz pod cudze
  konto. Zweryfikowane: state zmanipulowany, podrobiony i przeterminowany są odrzucane.
- Tokeny **nigdy nie wychodzą na klienta** — trasa statusu nie selektuje pól `accessToken`
  ani `refreshToken`. Rozłączenie cofa zgodę po stronie Google, zanim skasuje tokeny u nas.
- Synchronizacja jest jednokierunkowa: zmiany zrobione w Google zostaną nadpisane.
- Scheduler synchronizuje kalendarze wszystkich połączonych kont — awaria u jednego użytkownika
  nie blokuje reszty.

Panel połączenia jest w **Panelu Usprawnień**, bo to ustawienie osobiste, nie systemowe.

**2. Feed iCal** ([`calendar.ts`](src/server/services/calendar.ts)) — dla osób, które nie chcą
łączyć konta Google. Feed RFC 5545 z osobistym tokenem w adresie (aplikacja kalendarza nie ma
ciasteczka sesji). Token jest odwoływalny: nowy natychmiast psuje poprzednią subskrypcję
(sprawdzone: stary adres → `401`, nowy → `200`). Adres w zakładce „Platforma".

Obie ścieżki zawężają wydarzenia do widoczności roli.

### Poczta transakcyjna (spec 09)
[`src/server/services/email.ts`](src/server/services/email.ts) — dostawca jest **opcjonalny**:
bez `RESEND_API_KEY` wysyłka jest pomijana z wpisem w logu, a aplikacja działa normalnie.
Wdrożenie nie blokuje się na koncie u dostawcy poczty. Mail niesie powód i link, nigdy pól
finansowych ani danych klientów — poczta wychodzi poza kontrolowany kanał.

### Harmonogram skanu powiadomień (spec 11)
`POST /api/cron/scan` chroniony sekretem `CRON_SECRET` w nagłówku, **nie sesją** — scheduler nie
ma ciasteczka. Bez ustawionego sekretu trasa odmawia zawsze (`503`), żeby nie stała się publicznym
przyciskiem do generowania powiadomień. Wysyła jedno zbiorcze podsumowanie na osobę, nie mail
na każde powiadomienie.

Podpięcie pod cron:

```
0 7 * * *  curl -X POST https://elevate.adviseyou.pl/api/cron/scan \
             -H "Authorization: Bearer $CRON_SECRET"
```

### Logowanie przez konto Google (spec 09)
Provider wchodzi do konfiguracji **tylko gdy są klucze** — bez nich przycisk nie pojawia się na
ekranie logowania, zamiast wywalać się przy próbie użycia.

- OAuth **nie zakłada kont**: zalogować się może wyłącznie ktoś, komu Administrator wcześniej
  utworzył konto, i tylko na koncie aktywnym. Inaczej każdy adres Google byłby przepustką
  do platformy.
- Google zwraca własne `sub`, które podmieniamy na id z naszej bazy — reszta aplikacji dostaje
  jeden spójny identyfikator niezależnie od sposobu logowania.
- Reszta profilu Google jest odrzucana (spec 09): bierzemy e-mail i imię.

**Stan: kod gotowy, integracja wyłączona.** Google Workspace to koszt per użytkownik, więc
na tym wdrożeniu nie jest włączona. Bez `AUTH_GOOGLE_ID` i `AUTH_GOOGLE_SECRET` przycisk
logowania się nie pokazuje, a panel Kalendarza mówi wprost, że wdrożenie nie ma kluczy —
nic się nie psuje. Włączenie to uzupełnienie trzech zmiennych środowiskowych, bez zmian w kodzie.

**Kalendarz działa bez Google.** Feed iCal (Administracja → Platforma) subskrybujesz
w Kalendarzu Google, Outlooku albo Apple Calendar — za darmo, także na koncie prywatnym.
Różnica wobec integracji przez API: feed jest tylko do odczytu i odświeża się co kilkanaście
minut, zamiast wypychać wydarzenia natychmiast do osobnego kalendarza.

Pełna instrukcja konfiguracji, gdyby kiedyś była potrzebna, jest w [`.env.example`](.env.example).

### Bezpieczeństwo i RODO (spec 10)

Pełny opis: **[BEZPIECZENSTWO.md](BEZPIECZENSTWO.md)** — kontrola dostępu, szyfrowanie,
nagłówki, ślad audytowy, kategorie danych osobowych, prawa podmiotów, retencja i lista
tego, czego brakuje przed produkcją.

W skrócie:
- **Trzy warstwy kontroli dostępu**: `rbac.ts` (rola → moduł), `access.ts` (użytkownik →
  rekord), `redact.ts` (rola → pola). Uprawnienia czytane świeżo z bazy przy każdym żądaniu.
- **Tokeny OAuth Google szyfrowane w spoczynku** (AES-256-GCM, klucz z HKDF z `AUTH_SECRET`) —
  wyciek kopii bazy nie oddaje dostępu do kalendarzy.
- **Blokada logowania** na dwóch poziomach: para (IP, e-mail) oraz sam e-mail — bo
  `X-Forwarded-For` pochodzi od klienta i można go zmyślić.
- **CSP z zamkniętą listą domen**, HSTS, `X-Frame-Options: DENY`.
- **Ślad audytowy** każdej operacji zapisu; hasła i tokeny nigdy do niego nie trafiają.
- **RODO**: eksport danych (każdy własne bez pytania Administratora), anonimizacja zamiast
  usunięcia (rekordy finansowe podlegają 5-letniej retencji rachunkowej), rejestr żądań,
  automatyczne sprzątanie retencyjne. Panel administracyjny → zakładka RODO.

## Czego jeszcze nie ma

Zakres specyfikacji jest domknięty. Poza nim zostaje:

| Zakres | Stan |
|---|---|
| Migracja na Postgres/Supabase | schemat kompatybilny; do zmiany: `provider` w schemacie, adapter w [`prisma.ts`](src/lib/prisma.ts), `VACUUM INTO` → `pg_dump` w [`backup.ts`](src/server/services/backup.ts) |
| Odtworzenie z kopii przez interfejs | kopie powstają i są weryfikowalne, ale przywracanie robi się ręcznie na serwerze |
| Wysyłka poczty w produkcji | kod gotowy, wymaga `RESEND_API_KEY` i `EMAIL_FROM` |
| Logowanie Google i synchronizacja Kalendarza w produkcji | kod gotowy i przetestowany do granicy Google; wymaga `AUTH_GOOGLE_ID` i `AUTH_GOOGLE_SECRET` z Google Cloud Console |

### Znane ostrzeżenie buildu
`jose` wewnątrz `@auth/core` używa `CompressionStream`, którego Edge Runtime nie wspiera. To
ostrzeżenie upstreamu NextAuth v5, nie naszego kodu — dotyczy skompresowanych JWE, których nie
tworzymy. Build przechodzi.

### Świadome odstępstwa od specyfikacji

1. **`zespol` i `uzytkownicy` scalone w jeden model `User`.** Specyfikacja wymienia je osobno,
   ale profil zespołowy (FTE, stawka godzinowa, stanowisko) nie ma sensu bez konta, a rozdział
   dokładałby złączenie do każdego zapytania o obciążenie. Pola zespołowe siedzą na `User`.
2. **Ekspert zewnętrzny nie jest czwartą rolą.** Sekcja 06 definiuje trzy role i tak jest
   zaimplementowane. `ExternalExpert` to kartoteka z opcjonalnym powiązaniem `userId` — ekspert
   z kontem loguje się jako `CONSULTANT` i widzi wyłącznie swoje zadania dzięki
   `projectScopeWhere`.
3. **`TimeLog` jako osobna encja.** Nie ma jej na liście w sekcji 08, ale rentowność
   „per konsultant" ze spec 04 jest bez niej niepoliczalna. `Task.actualHours` pozostaje sumą
   utrzymywaną przy zapisie wpisu.
4. **Ocena RAG w raporcie statusowym może nadpisać wyliczenie.** Specyfikacja mówi, że RAG jest
   liczony automatycznie — i tak działa na karcie projektu. Raport statusowy to jednak ocena
   człowieka w danym momencie; blokowanie rozjazdu zmusiłoby opiekuna do pisania nieprawdy albo
   do omijania narzędzia. Zamiast blokady: rozjazd jest odnotowany w dzienniku audytu.
5. **Wzmianki bez parsowania tekstu.** `@Imię Nazwisko` w treści to tylko wyświetlanie; wiążąca
   jest lista id wysłana osobnym polem. Parsowanie nazwisk z tekstu łamałoby się przy zbieżnych
   nazwiskach i przy każdej zmianie nazwiska w systemie.
