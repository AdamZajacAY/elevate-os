# Bezpieczeństwo i ochrona danych — ELEVATE OS

Dokument opisuje, jak ELEVATE OS chroni dane i jak realizuje obowiązki wynikające z RODO.
Uzupełnia [README.md](README.md), które opisuje funkcje produktu.

> **Zastrzeżenie.** To opis techniczny tego, co robi oprogramowanie — nie jest to opinia
> prawna ani gotowa dokumentacja zgodności. Ocenę podstaw prawnych, umowy powierzenia
> i politykę prywatności AdviseYou musi zatwierdzić osoba odpowiedzialna za zgodność.

---

## 1. Kontrola dostępu

Trzy warstwy, każda odpowiada na inne pytanie:

| Warstwa | Pytanie | Plik |
|---|---|---|
| RBAC | Czy ta **rola** widzi ten **moduł**? | [`src/lib/rbac.ts`](src/lib/rbac.ts) |
| Dostęp do rekordu | Czy ten **użytkownik** widzi ten **rekord**? | [`src/server/access.ts`](src/server/access.ts) |
| Redakcja pól | Czy ta rola widzi **te pola**? | [`src/lib/redact.ts`](src/lib/redact.ts) |

Sama zgoda na moduł nie wystarcza: moduł `projects` czyta każda rola, ale zakres projektów
konsultanta jest węższy niż cały portfel. Każda trasa API operująca na identyfikatorze
przysłanym przez klienta przechodzi przez `access.ts` — bez tego identyfikator z cudzego
projektu dawał dostęp do danych.

**Uprawnienia czytane są świeżo z bazy przy każdym żądaniu**
([`session.ts`](src/server/session.ts)), więc dezaktywacja konta i zmiana roli działają
natychmiast, bez czekania na wygaśnięcie tokenu sesji.

### Redakcja finansowa
Pola `budget`, `contractValue`, `quotedValue`, `hourlyRate`, `value`, `rateSnapshot` są
zerowane **na granicy odpowiedzi serwera**, nie ukrywane w komponencie. Konsultant nie
dostaje tych wartości nawet w surowej odpowiedzi API. Mapa pól jest w jednym miejscu
(`FINANCIAL_FIELDS`), więc nowe pole finansowe wystarczy dopisać raz.

---

## 2. Uwierzytelnianie

- **Hasła**: bcrypt z kosztem 12. Hash nigdy nie jest serializowany do odpowiedzi
  ani do eksportu danych.
- **Blokada logowania**: 5 nieudanych prób w oknie 15 minut na parę (IP, e-mail) **oraz**
  20 prób na sam e-mail niezależnie od adresu. Drugi limit istnieje dlatego, że nagłówek
  `X-Forwarded-For` pochodzi od klienta i można go zmyślić — ufamy mu wyłącznie, gdy
  wdrożenie deklaruje `TRUST_PROXY=true`.
- **Komunikat logowania** nie rozróżnia złego hasła od nieistniejącego konta ani od blokady —
  nie jest wyrocznią o istnieniu adresu w systemie.
- **Google OAuth** nie zakłada kont: wpuszcza wyłącznie na konta już istniejące i aktywne,
  i tylko przy zweryfikowanym adresie e-mail (`email_verified`).
- **Sesja**: JWT, ważność 12 godzin.

---

## 3. Sekrety i szyfrowanie

| Sekret | Ochrona |
|---|---|
| Hasła użytkowników | bcrypt (koszt 12), nieodwracalnie |
| Tokeny OAuth Google | **AES-256-GCM w spoczynku** ([`crypto.ts`](src/server/services/crypto.ts)) |
| Token subskrypcji kalendarza | 32 bajty losowe, odwoływalny przez wygenerowanie nowego |
| `CRON_SECRET` | porównanie stałoczasowe (`timingSafeEqual`) |
| `state` w OAuth | HMAC-SHA256 z `AUTH_SECRET`, ważność 10 minut |

Klucz szyfrujący wyprowadzany jest z `AUTH_SECRET` przez HKDF z odrębną etykietą — nie jest
tym samym bajtem co sekret sesji, a jednocześnie nie wprowadza kolejnej zmiennej
środowiskowej, którą ktoś zapomni ustawić. AES-GCM szyfruje i uwierzytelnia naraz: podmiana
szyfrogramu w bazie kończy się błędem, nie cichym zwróceniem śmieci.

**Wyciek pliku bazy albo kopii zapasowej nie oddaje dostępu do kalendarzy użytkowników.**

---

## 4. Trasy wywoływane przez maszyny

Trzy trasy są celowo wyłączone z sesji, bo ich klient nie obsłuży przekierowania na `/login`:

| Trasa | Autoryzacja |
|---|---|
| `/api/calendar` | osobisty token w adresie (aplikacja kalendarza nie ma ciasteczka) |
| `/api/cron/*` | nagłówek `Authorization: Bearer $CRON_SECRET` |
| `/api/google/calendar/callback` | podpisany parametr `state` (powrót z domeny Google) |

Trasy wołane przez harmonogram mieszkają pod wspólnym prefiksem `/api/cron`, żeby nie
dokładać wyjątku do middleware przy każdym nowym endpoincie.

---

## 5. Nagłówki i transport

Ustawiane w [`next.config.ts`](next.config.ts):

- `Content-Security-Policy` z zamkniętą listą domen — dozwolone wyłącznie
  `wl-api.mf.gov.pl`, `api-krs.ms.gov.pl`, `dane.biznes.gov.pl`. Każde inne połączenie
  wychodzące z przeglądarki jest blokowane.
- `X-Frame-Options: DENY` — ochrona przed clickjackingiem.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — kamera, mikrofon i geolokalizacja wyłączone.
- `Strict-Transport-Security` (produkcja) — `max-age=63072000; includeSubDomains; preload`.

---

## 6. Eksport danych

Raport executive eksportowany do CSV przechodzi przez escapowanie chroniące przed
**wstrzyknięciem formuły**: komórka zaczynająca się od `=`, `+`, `-` albo `@` jest przez
Excela i Arkusze Google traktowana jak formuła, więc nazwa projektu w rodzaju `=1+1`
wykonałaby się u odbiorcy raportu. Apostrof z przodu wymusza interpretację jako tekst.

Feed iCal escapuje znaki specjalne wg RFC 5545 (średnik, przecinek, ukośnik, nowa linia).

---

## 7. Ślad audytowy

Każda operacja zapisu trafia do dziennika ([`audit.ts`](src/server/services/audit.ts)):
kto, co, na czym, kiedy, z jakimi zmianami. Hasła i tokeny **nigdy** nie trafiają do
dziennika — przy zmianie hasła zapisujemy wyłącznie flagę `passwordChanged: true`.

Dziennik jest widoczny w panelu administracyjnym (zakładka „Dziennik audytu") i podlega
retencji 2 lat.

---

## 8. Kopie zapasowe

Kopia robiona przez `VACUUM INTO` — **spójna przy żywej bazie**; zwykłe skopiowanie pliku
przy otwartym WAL dałoby kopię niespójną. Automatyczna przy starcie (raz na dobę) i ręczna
z panelu. Trzymamy dziesięć ostatnich.

> **Do zrobienia przed produkcją:** kopie leżą w katalogu `backups/` na tym samym dysku co
> baza. Produkcyjnie muszą trafiać poza serwer i być szyfrowane — pełna kopia bazy zawiera
> wszystkie dane osobowe.

---

## 9. RODO — realizacja obowiązków

### Kategorie danych i podstawy przetwarzania

| Kategoria | Zakres | Podstawa (art. 6 RODO) |
|---|---|---|
| Konta pracowników | imię, nazwisko, e-mail, stanowisko, FTE, stawka | ust. 1 lit. b (umowa) i lit. f |
| Kontakty u klienta | imię, nazwisko, stanowisko, e-mail, telefon, poziom decyzyjny | ust. 1 lit. f — realizacja i rozliczenie projektu |
| Dane firmowe klienta | nazwa, NIP, KRS, REGON, adres | ust. 1 lit. b i lit. c (obowiązki podatkowe) |
| Ewidencja czasu pracy | godziny, daty, autor, notatka | ust. 1 lit. c (rachunkowość) i lit. f |
| Ślad audytowy | id konta, operacja, encja, czas | ust. 1 lit. f — bezpieczeństwo systemu |

Dane firmowe spółki prawa handlowego nie są danymi osobowymi, ale dla jednoosobowej
działalności są — dlatego traktujemy je tak samo.

### Prawa podmiotów danych

Panel administracyjny → zakładka **RODO** ([`GdprPanel`](src/components/admin/GdprPanel.tsx)).

| Prawo | Realizacja |
|---|---|
| Dostęp (art. 15) i przenoszenie (art. 20) | `GET /api/gdpr/export` — JSON do odczytu maszynowego. **Każdy pobiera własne dane bez pytania Administratora** — to prawo podmiotu, nie przywilej. Dane cudze i dane klientów wydaje Administrator. |
| Usunięcie (art. 17) | `POST /api/gdpr/anonymize` — anonimizacja, wyłącznie Administrator, operacja nieodwracalna |
| Udokumentowanie odpowiedzi (art. 12 ust. 3) | Rejestr żądań `zadania_rodo` — każdy eksport i anonimizacja zostawia ślad |

### Dlaczego anonimizacja, a nie usunięcie

Twarde skasowanie klienta zabrałoby rentowność projektów, które już się rozliczyły, a wpisy
czasu i faktury podlegają odrębnym terminom przechowywania (ustawa o rachunkowości — 5 lat).
Zastępujemy więc dane osobowe znacznikami, zostawiając rekordy finansowe bez możliwości
powiązania z osobą. Po anonimizacji klienta projekt `PRJ-0003` nadal ma wartość umowy
56 000 zł, ale nie wiadomo już, czyj był.

Anonimizacja konta pracownika dodatkowo: dezaktywuje konto, kasuje hash hasła, token
kalendarza, tokeny Google, powiadomienia i próby logowania (te ostatnie **przed** podmianą
adresu, bo są kluczowane e-mailem).

### Retencja (art. 5 ust. 1 lit. e)

| Dane | Okres | Uzasadnienie |
|---|---|---|
| Próby logowania | 30 dni | okno blokady i analiza incydentu |
| Przeczytane powiadomienia | 30 dni | po miesiącu nie niosą informacji |
| Dziennik audytu | 2 lata | odtworzenie historii zmian |
| Dane klienta | 5 lat od zamknięcia ostatniego projektu | terminy podatkowe i rachunkowe |

Sprzątanie: `POST /api/cron/cleanup` (harmonogram) albo przycisk w panelu.
Klientów **nie anonimizujemy automatycznie** — decyzja o usunięciu danych kontrahenta ma
skutki umowne i księgowe, więc zostaje przy człowieku. System wylicza datę końca retencji
i zwraca listę przeterminowanych do rozpatrzenia.

### Minimalizacja

Z profilu Google bierzemy wyłącznie e-mail i imię — reszta jest odrzucana. Zgoda na
kalendarz jest **osobna od logowania**, więc logowanie nie wymusza oddania dostępu do
kalendarza. Poczta transakcyjna niesie powód i link, nigdy pól finansowych ani danych
klientów — wychodzi poza kontrolowany kanał.

---

## 10. Czego brakuje przed produkcją

| Obszar | Stan |
|---|---|
| Kopie zapasowe poza serwerem, szyfrowane | kopie działają lokalnie; wysyłka na zewnątrz niezrobiona |
| Odtworzenie z kopii przez interfejs | robi się ręcznie na serwerze |
| Umowy powierzenia z podprocesorami | Google, dostawca poczty, hosting — do zawarcia |
| Polityka prywatności i klauzule informacyjne | do napisania i zatwierdzenia |
| Ograniczanie liczby żądań poza logowaniem | limit działa tylko na logowaniu |
| Rotacja `AUTH_SECRET` | zmiana sekretu unieważni tokeny Google (są nim szyfrowane) — procedura do opisania |
| Rejestr naruszeń (art. 33) | prowadzony poza systemem |
