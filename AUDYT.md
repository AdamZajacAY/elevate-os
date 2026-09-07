# Audyt funkcjonalny ELEVATE OS

> **Status: etapy 1–5 wdrożone** (07.09.2026). Wszystkie braki z sekcji A i C
> zostały domknięte. Pozostają pozycje z sekcji B — funkcje Jiry odłożone
> do decyzji po zebraniu opinii z użycia.

Stan wyjściowy na 07.09.2026. Metoda: zmapowanie operacji dostępnych w API względem tych,
które da się wywołać z interfejsu, plus porównanie z zakresem funkcji Jiry.

**Wynik liczbowy:** 38 operacji zapisu istnieje w API, ale nie ma jak ich użyć
z ekranu. Dwie encje — **ryzyka** i **kamienie milowe** — nie mają tras zapisu
w ogóle, mimo że są wyświetlane na karcie projektu i zasilają status RAG.

---

## A. Braki blokujące codzienną pracę

Rzeczy, przez które narzędzia nie da się używać do prowadzenia projektu.

| # | Brak | Stan API | Skutek |
|---|---|---|---|
| A1 | **Edycja projektu** — nazwa, opis, terminy, budżet, wartość umowy | `PATCH` gotowy | Pomyłka przy zakładaniu jest nie do naprawienia |
| A2 | **Zmiana statusu projektu** (w tym zamknięcie) | `PATCH` gotowy | Projekt nie da się zamknąć; liczy się w rentowności bez końca |
| A3 | **Zmiana opiekuna projektu** | `PATCH` gotowy | Przekazanie projektu wymaga wejścia do bazy |
| A4 | **Zmiana fazy Elevate** | `PATCH` gotowy | Faza zostaje ta z założenia |
| A5 | **Kamienie milowe** — dodanie, edycja, odhaczenie | **brak trasy** | Widoczne, ale nie do wprowadzenia. Zasilają RAG, więc RAG jest niepełny |
| A6 | **Ryzyka i problemy** — dodanie, edycja, zamknięcie | **brak trasy** | Jak wyżej; rejestr ryzyk jest tylko do oglądania |
| A7 | **Harmonogram** — dodanie i edycja etapów | `POST`/`PATCH`/`DELETE` gotowe | Gantt jest pusty, dopóki ktoś nie wpisze etapów do bazy |
| A8 | **Zespół projektowy** — kto pracuje nad projektem | **brak w modelu danych** | Przynależność wynika wyłącznie z przypisań zadań |
| A9 | **Edycja zadania** poza zmianą statusu | `PATCH` gotowy | Tytuł, opis, termin, wykonawca — nie do poprawienia |
| A10 | **Usunięcie zadania** | `DELETE` gotowy | Pomyłkowe zadanie zostaje na zawsze |

**A8 wymaga zmiany modelu danych.** Reszta to wyłącznie interfejs do tego,
co już działa po stronie serwera.

---

## B. Braki względem Jiry

Porównanie z tym, czego zespół przyzwyczajony do Jiry będzie szukał.

### Jest i działa
- Tablica Kanban ze zmianą statusu, widok listy, „moje zadania"
- Priorytety, terminy, godziny szacowane i rzeczywiste, rejestracja czasu
- Komentarze z @wzmiankami i powiadomieniami
- Powiązanie zadania z etapem harmonogramu
- Wykres Gantta wieloprojektowy
- Ślad audytowy zmian

### Brakuje — uporządkowane wg tego, jak często się o to potyka
| Funkcja Jiry | Uwaga |
|---|---|
| **Przeciąganie kart** (drag & drop) | Status zmienia się selektorem. `@dnd-kit` był w planie, nie został użyty |
| **Podzadania** | Model `Task` nie ma relacji do rodzica |
| **Zależności między zadaniami** („blokuje / zablokowane przez") | Brak w modelu |
| **Załączniki** | Brak — nie ma gdzie wrzucić raportu ani zrzutu ekranu |
| **Historia zmian na zadaniu** | Zmiany trafiają do dziennika audytu, ale nie widać ich przy zadaniu |
| **Etykiety / tagi** | Model `ConfigLabel` istnieje, ale zadania nie mają do niego relacji |
| **Wyszukiwarka globalna** | Szukać da się tylko klientów w CRM |
| **Filtry zapisane / własne widoki** | Filtry są w URL, ale nie da się ich nazwać i zapisać |
| **Sprinty / iteracje** | Świadomie pominięte — ELEVATE stoi na fazach Elevate, nie na sprintach |
| **Szacowanie w punktach** | Godziny zamiast punktów — dla firmy doradczej to trafniejsza jednostka |
| **Automatyzacje** („gdy status = X, zrób Y") | Brak silnika reguł |
| **Raporty burndown / velocity** | Brak; są za to terminowość i rentowność |

Ostatnie trzy pozycje to świadome odstępstwa — narzędzie ma rozliczać projekty
doradcze, nie prowadzić scrum. Nie proponuję ich dodawać bez wyraźnej potrzeby.

---

## C. Braki w pozostałych modułach

| Moduł | Brak |
|---|---|
| CRM | usunięcie kontaktu, usunięcie szansy |
| Eksperci | edycja i dezaktywacja eksperta, usunięcie przypisania do projektu |
| Notatki | edycja i usunięcie notatki po zapisaniu |
| Administracja | edycja słowników (`ConfigLabel` — trasa jest, ekran tylko wyświetla), usunięcie konta |
| Checklisty | edycja szablonów per typ usługi — tylko przez seed |

---

## D. Proponowana kolejność

**Etap 1 — odblokowanie prowadzenia projektu** ✅
A1–A4 (edycja i zamknięcie projektu, opiekun, faza), A9–A10 (edycja i usunięcie
zadania). Wyłącznie interfejs, API gotowe.

**Etap 2 — to, co zasila RAG** ✅
A5 i A6 — trasy i ekrany dla kamieni milowych i ryzyk. Bez nich status zdrowia
projektu liczy się z niepełnych danych.

**Etap 3 — harmonogram** ✅
A7 — dodawanie i edycja etapów, żeby Gantt miał z czego rysować.

**Etap 4 — zespół projektowy** ✅
A8 — zmiana modelu danych plus ekran. Jedyna pozycja wymagająca migracji.

**Etap 5 — reszta CRUD** ✅
Sekcja C.

**Osobno, po zebraniu opinii z użycia:** drag & drop, podzadania, załączniki,
wyszukiwarka globalna.
