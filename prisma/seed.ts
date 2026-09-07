import "dotenv/config";
// Wspólny klient — konfiguracja SSL dla zdalnych baz w jednym miejscu.
import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

const day = 86_400_000;
const today = new Date();
const at = (offsetDays: number) => new Date(today.getTime() + offsetDays * day);

// ─── Konta ───────────────────────────────────────────────────────────────────
const USERS = [
  {
    email: "admin@adviseyou.pl",
    fullName: "Adam Zając",
    role: "ADMIN",
    position: "Administrator platformy",
    fte: 1,
    hourlyRate: 320,
    password: "Admin2026!",
  },
  {
    email: "partner@adviseyou.pl",
    fullName: "Marta Lewandowska",
    role: "PARTNER",
    position: "Partner zarządzający",
    fte: 1,
    hourlyRate: 420,
    password: "Haslo2026!",
  },
  {
    email: "konsultant@adviseyou.pl",
    fullName: "Piotr Nowicki",
    role: "CONSULTANT",
    position: "Senior konsultant e-commerce",
    fte: 1,
    hourlyRate: 240,
    password: "Haslo2026!",
  },
  {
    email: "konsultant2@adviseyou.pl",
    fullName: "Katarzyna Wrona",
    role: "CONSULTANT",
    position: "Konsultant sprzedaży B2B",
    fte: 0.8,
    hourlyRate: 210,
    password: "Haslo2026!",
  },
] as const;

// ─── Szablony checklist per typ uslugi (spec 03) ──────────────────────────────
const CHECKLIST_TEMPLATES: Record<string, { name: string; items: [string, string][] }> = {
  AUDYT_ECOMMERCE: {
    name: "Audyt e-commerce",
    items: [
      ["Wywiad otwierający z zarządem klienta", "EXPLORE"],
      ["Dostępy do analityki, panelu sklepu i systemu reklamowego", "EXPLORE"],
      ["Analiza lejka sprzedażowego i porzuceń koszyka", "EXPLORE"],
      ["Audyt techniczny wydajności i Core Web Vitals", "EXPLORE"],
      ["Przegląd asortymentu i polityki cenowej", "EXPLORE"],
      ["Benchmark trzech konkurentów", "ENGINEER"],
      ["Lista rekomendacji z priorytetyzacją wpływ/nakład", "ENGINEER"],
      ["Prezentacja raportu diagnostycznego klientowi", "ENGINEER"],
    ],
  },
  STRATEGIA_SPRZEDAZY: {
    name: "Strategia sprzedaży",
    items: [
      ["Warsztat diagnostyczny z zespołem sprzedaży", "EXPLORE"],
      ["Analiza struktury przychodu i marży wg segmentów", "EXPLORE"],
      ["Mapa procesu sprzedażowego stanu obecnego", "EXPLORE"],
      ["Definicja segmentów docelowych i propozycji wartości", "ENGINEER"],
      ["Model prowizyjny i cele dla zespołu", "ENGINEER"],
      ["Mapa działań na 12 miesięcy", "ENGINEER"],
      ["Akceptacja strategii przez zarząd klienta", "ENGINEER"],
      ["Wdrożenie pierwszego kwartału mapy działań", "EXECUTE"],
    ],
  },
  WDROZENIE_NARZEDZIA: {
    name: "Wdrożenie narzędzia",
    items: [
      ["Zebranie wymagań procesowych od użytkowników", "EXPLORE"],
      ["Wybór narzędzia i uzasadnienie kosztowe", "EXPLORE"],
      ["Projekt modelu danych i mapowanie pól", "ENGINEER"],
      ["Konfiguracja środowiska testowego", "EXECUTE"],
      ["Migracja danych z systemu źródłowego", "EXECUTE"],
      ["Szkolenie zespołu klienta", "EXECUTE"],
      ["Przegląd adopcji po 30 dniach", "ELEVATE"],
    ],
  },
  INTERIM_MANAGEMENT: {
    name: "Interim management",
    items: [
      ["Przejęcie obowiązków i mapa interesariuszy", "EXPLORE"],
      ["Diagnoza zespołu i kluczowych ryzyk", "EXPLORE"],
      ["Plan działania na pierwsze 90 dni", "ENGINEER"],
      ["Cotygodniowy rytm raportowania do zarządu", "EXECUTE"],
      ["Przekazanie obowiązków następcy", "ELEVATE"],
    ],
  },
  SZKOLENIE_ZESPOLU: {
    name: "Szkolenie zespołu",
    items: [
      ["Badanie potrzeb szkoleniowych", "EXPLORE"],
      ["Program i materiały szkoleniowe", "ENGINEER"],
      ["Realizacja sesji szkoleniowych", "EXECUTE"],
      ["Ankieta ewaluacyjna i raport z rekomendacjami", "ELEVATE"],
    ],
  },
  EKSPANSJA_CROSS_BORDER: {
    name: "Ekspansja cross-border",
    items: [
      ["Analiza potencjału rynków docelowych", "EXPLORE"],
      ["Wymogi prawne, podatkowe i logistyczne", "EXPLORE"],
      ["Model wejścia na rynek i budżet", "ENGINEER"],
      ["Lokalizacja oferty i kanałów sprzedaży", "EXECUTE"],
      ["Pilotaż na jednym rynku", "EXECUTE"],
      ["Przegląd wyników pilotażu i decyzja o skalowaniu", "ELEVATE"],
    ],
  },
};

// ─── Slowniki konfiguracyjne ─────────────────────────────────────────────────
const CONFIG_LABELS = [
  ["SERVICE_TYPE", "AUDYT_ECOMMERCE", "Audyt e-commerce", "#194A99"],
  ["SERVICE_TYPE", "STRATEGIA_SPRZEDAZY", "Strategia sprzedaży", "#1E6FD9"],
  ["SERVICE_TYPE", "INTERIM_MANAGEMENT", "Interim management", "#5F8FE0"],
  ["SERVICE_TYPE", "WDROZENIE_NARZEDZIA", "Wdrożenie narzędzia", "#3FBE8B"],
  ["SERVICE_TYPE", "SZKOLENIE_ZESPOLU", "Szkolenie zespołu", "#E3AC49"],
  ["SERVICE_TYPE", "EKSPANSJA_CROSS_BORDER", "Ekspansja cross-border", "#8B5FD1"],
  ["PHASE", "EXPLORE", "Explore", "#4E7FD1"],
  ["PHASE", "ENGINEER", "Engineer", "#5F8FE0"],
  ["PHASE", "EXECUTE", "Execute", "#6FA0EF"],
  ["PHASE", "ELEVATE", "Elevate", "#609DFF"],
] as const;

async function main() {
  console.log("→ Konta");
  const users: Record<string, string> = {};
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, role: u.role, position: u.position, fte: u.fte, hourlyRate: u.hourlyRate },
      create: {
        email: u.email,
        fullName: u.fullName,
        passwordHash,
        role: u.role,
        position: u.position,
        fte: u.fte,
        hourlyRate: u.hourlyRate,
        isActive: true,
      },
    });
    users[u.role === "CONSULTANT" ? u.email : u.role] = user.id;
    console.log(`   ${u.role.padEnd(10)} ${u.fullName} (${u.email})`);
  }
  const adminId = users["ADMIN"];
  const partnerId = users["PARTNER"];
  const consultantId = users["konsultant@adviseyou.pl"];
  const consultant2Id = users["konsultant2@adviseyou.pl"];

  console.log("→ Słowniki konfiguracyjne");
  for (const [kind, value, label, color] of CONFIG_LABELS) {
    await prisma.configLabel.upsert({
      where: { kind_value: { kind, value } },
      update: { label, color },
      create: { kind, value, label, color },
    });
  }

  console.log("→ Szablony checklist");
  for (const [serviceType, template] of Object.entries(CHECKLIST_TEMPLATES)) {
    const existing = await prisma.checklistTemplate.findUnique({ where: { serviceType } });
    if (existing) {
      await prisma.checklistTemplateItem.deleteMany({ where: { templateId: existing.id } });
      await prisma.checklistTemplate.delete({ where: { id: existing.id } });
    }
    await prisma.checklistTemplate.create({
      data: {
        serviceType,
        name: template.name,
        items: {
          create: template.items.map(([label, phase], index) => ({
            label,
            phase,
            position: index,
          })),
        },
      },
    });
    console.log(`   ${template.name} — ${template.items.length} pozycji`);
  }

  console.log("→ Klienci");
  const clients = await Promise.all(
    [
      {
        name: "NordicHome Sp. z o.o.",
        industry: "Meble i wyposażenie wnętrz",
        segment: "STRATEGICZNY",
        status: "STALY",
        nip: "5252445566",
        city: "Warszawa",
      },
      {
        name: "VitaPharm S.A.",
        industry: "Suplementy i zdrowie",
        segment: "KLUCZOWY",
        status: "AKTYWNY",
        nip: "7010334455",
        city: "Poznań",
      },
      {
        name: "Trailmark Outdoor",
        industry: "Odzież outdoor",
        segment: "STANDARDOWY",
        status: "AKTYWNY",
        nip: "6772889900",
        city: "Kraków",
      },
      {
        name: "Formatec Industrial",
        industry: "Produkcja przemysłowa B2B",
        segment: "KLUCZOWY",
        status: "PROSPEKT",
        nip: "9542771122",
        city: "Katowice",
      },
    ].map((c) =>
      prisma.client.upsert({
        where: { id: c.nip },
        update: {},
        create: { id: c.nip, ...c, lastContactAt: at(-6) },
      }),
    ),
  );

  console.log("→ Kontakty");
  // `createMany` bez klucza naturalnego duplikowal kontakty przy kazdym seedzie —
  // czyscimy je, zeby seed byl idempotentny.
  await prisma.clientContact.deleteMany({
    where: { clientId: { in: clients.map((c) => c.id) } },
  });
  await prisma.clientContact.createMany({
    data: [
      { clientId: clients[0].id, fullName: "Agnieszka Rutkowska", position: "Dyrektor e-commerce", email: "a.rutkowska@nordichome.pl", decisionLevel: "DECYDENT", isPrimary: true },
      { clientId: clients[0].id, fullName: "Michał Sobczak", position: "Head of Marketing", email: "m.sobczak@nordichome.pl", decisionLevel: "WPLYWOWY", isPrimary: false },
      { clientId: clients[1].id, fullName: "Robert Kamiński", position: "Członek zarządu", email: "r.kaminski@vitapharm.pl", decisionLevel: "DECYDENT", isPrimary: true },
      { clientId: clients[2].id, fullName: "Julia Adamczyk", position: "Kierownik sprzedaży", email: "j.adamczyk@trailmark.pl", decisionLevel: "OPERACYJNY", isPrimary: true },
    ],
  });

  console.log("→ Projekty");
  // Licznik kodow startuje od zera przy kazdym seedzie zestawu demonstracyjnego.
  await prisma.counter.upsert({ where: { key: "PRJ" }, update: { value: 0 }, create: { key: "PRJ", value: 0 } });
  await prisma.counter.upsert({ where: { key: "ZAD" }, update: { value: 0 }, create: { key: "ZAD", value: 0 } });

  const projectSpecs = [
    {
      code: "PRJ-0001",
      name: "Audyt e-commerce NordicHome",
      clientId: clients[0].id,
      serviceType: "AUDYT_ECOMMERCE",
      ownerId: consultantId,
      phase: "ENGINEER",
      status: "ACTIVE",
      description:
        "Diagnoza lejka sprzedażowego, wydajności technicznej i polityki asortymentowej sklepu. Deliverable: raport diagnostyczny z priorytetyzowaną listą rekomendacji.",
      startDate: at(-38),
      endDate: at(12),
      quotedValue: 78000,
      contractValue: 74000,
      budget: 41000,
    },
    {
      code: "PRJ-0002",
      name: "Strategia sprzedaży VitaPharm",
      clientId: clients[1].id,
      serviceType: "STRATEGIA_SPRZEDAZY",
      ownerId: consultant2Id,
      phase: "EXECUTE",
      status: "ACTIVE",
      description:
        "Przebudowa modelu sprzedaży B2B: segmentacja, propozycja wartości, model prowizyjny i mapa działań na 12 miesięcy.",
      startDate: at(-72),
      endDate: at(34),
      quotedValue: 132000,
      contractValue: 128000,
      budget: 71000,
    },
    {
      code: "PRJ-0003",
      name: "Wdrożenie CRM Trailmark",
      clientId: clients[2].id,
      serviceType: "WDROZENIE_NARZEDZIA",
      ownerId: consultantId,
      phase: "EXECUTE",
      status: "ACTIVE",
      description: "Wybór i wdrożenie CRM wraz z migracją danych i szkoleniem zespołu handlowego.",
      startDate: at(-24),
      endDate: at(-3), // po terminie — projekt zejdzie na RED
      quotedValue: 56000,
      contractValue: 56000,
      budget: 33000,
    },
    {
      code: "PRJ-0004",
      name: "Stała opieka NordicHome",
      clientId: clients[0].id,
      serviceType: "INTERIM_MANAGEMENT",
      ownerId: partnerId,
      phase: "ELEVATE",
      status: "ACTIVE",
      description: "Cykliczny monitoring wyników i przegląd kwartalny po zakończonym wdrożeniu.",
      startDate: at(-14),
      endDate: at(150),
      quotedValue: 96000,
      // Abonament bezterminowy: wartości umowy nie ma, bo umowa nie ma końca.
      // Przychód liczy się z okresów, które minęły.
      contractValue: null,
      budget: 52000,
      billingModel: "ABONAMENT",
      billingPeriod: "MIESIECZNY",
      recurringAmount: 8000,
      billingStartDate: at(-14),
      billingEndDate: null,
      noticePeriodDays: 30,
    },
  ];

  const projects = [];
  for (const spec of projectSpecs) {
    const project = await prisma.project.upsert({
      where: { code: spec.code },
      update: {},
      create: spec,
    });
    projects.push(project);

    // Checklista instancjonowana z szablonu — tak jak przy zakladaniu przez API.
    const existingChecklist = await prisma.projectChecklistItem.count({
      where: { projectId: project.id },
    });
    if (existingChecklist === 0) {
      const template = await prisma.checklistTemplate.findUnique({
        where: { serviceType: project.serviceType },
        include: { items: { orderBy: { position: "asc" } } },
      });
      if (template) {
        await prisma.projectChecklistItem.createMany({
          data: template.items.map((item, index) => ({
            projectId: project.id,
            label: item.label,
            phase: item.phase,
            position: item.position,
            // Kilka pierwszych pozycji odhaczonych, zeby postep byl widoczny.
            isDone: index < 3,
            doneAt: index < 3 ? at(-10 + index) : null,
          })),
        });
      }
    }
  }
  await prisma.counter.update({ where: { key: "PRJ" }, data: { value: projects.length } });

  console.log("→ Harmonogram");
  const stageSpecs: [number, string, string, number, number, number][] = [
    // [indeks projektu, nazwa, faza, offset startu, offset konca, postep %]
    [0, "Diagnoza i zbiór danych", "EXPLORE", -38, -18, 100],
    [0, "Analiza i benchmark", "ENGINEER", -17, 4, 65],
    [0, "Raport i prezentacja", "ENGINEER", 5, 12, 0],
    [1, "Warsztaty i diagnoza", "EXPLORE", -72, -48, 100],
    [1, "Projektowanie strategii", "ENGINEER", -47, -18, 100],
    [1, "Wdrożenie Q1 mapy działań", "EXECUTE", -17, 34, 40],
    [2, "Wybór narzędzia", "EXPLORE", -24, -14, 100],
    [2, "Konfiguracja i migracja", "EXECUTE", -13, -3, 70],
    [3, "Monitoring bieżący", "ELEVATE", -14, 150, 10],
  ];
  for (const [index, name, phase, start, end, progress] of stageSpecs) {
    const project = projects[index];
    const exists = await prisma.projectStage.findFirst({ where: { projectId: project.id, name } });
    if (!exists) {
      await prisma.projectStage.create({
        data: { projectId: project.id, name, phase, startDate: at(start), endDate: at(end), progress },
      });
    }
  }

  console.log("→ Zadania");
  const taskSpecs: [number, string, string, string, string | null, number, number | null, number][] = [
    // [projekt, tytul, status, priorytet, wykonawca, offset terminu, szac. godz., rzecz. godz.]
    [0, "Wywiad otwierający z zarządem", "DONE", "HIGH", consultantId, -34, 6, 5.5],
    [0, "Analiza porzuceń koszyka", "DONE", "HIGH", consultantId, -20, 16, 18],
    [0, "Audyt Core Web Vitals", "IN_PROGRESS", "MEDIUM", consultantId, 2, 12, 7],
    [0, "Benchmark konkurencji", "IN_PROGRESS", "MEDIUM", consultant2Id, 5, 10, 3],
    [0, "Redakcja raportu diagnostycznego", "TODO", "CRITICAL", consultantId, 10, 20, 0],
    [1, "Warsztat z zespołem sprzedaży", "DONE", "HIGH", consultant2Id, -60, 8, 9],
    [1, "Model prowizyjny", "DONE", "HIGH", consultant2Id, -30, 14, 16],
    [1, "Wdrożenie CRM-owego lejka", "IN_PROGRESS", "HIGH", consultant2Id, 8, 24, 11],
    [1, "Szkolenie handlowców z nowego procesu", "TODO", "MEDIUM", consultantId, 22, 12, 0],
    [2, "Migracja bazy kontaktów", "REVIEW", "CRITICAL", consultantId, -9, 18, 21],
    [2, "Szkolenie zespołu handlowego", "BLOCKED", "HIGH", consultant2Id, -4, 8, 2],
    [2, "Konfiguracja automatyzacji e-mail", "TODO", "MEDIUM", null, 6, 10, 0],
    [3, "Przegląd wyników — miesiąc 1", "TODO", "MEDIUM", partnerId, 16, 4, 0],
  ];
  let taskNo = 0;
  for (const [index, title, status, priority, assigneeId, due, estimated, actual] of taskSpecs) {
    taskNo += 1;
    const code = `ZAD-${String(taskNo).padStart(4, "0")}`;
    const exists = await prisma.task.findUnique({ where: { code } });
    if (exists) continue;
    await prisma.task.create({
      data: {
        code,
        projectId: projects[index].id,
        title,
        status,
        priority,
        assigneeId,
        dueDate: at(due),
        estimatedHours: estimated,
        actualHours: actual,
        completedAt: status === "DONE" ? at(due) : null,
        position: taskNo,
      },
    });
  }
  await prisma.counter.update({ where: { key: "ZAD" }, data: { value: taskNo } });

  console.log("→ Wpisy czasu");
  // Rentownosc liczy sie wylacznie z TimeLog (spec 02/04), wiec godziny rzeczywiste
  // zadan musza miec pokrycie we wpisach — inaczej dashboard finansowy pokaze
  // marze rowna calej wartosci umowy.
  const seededTasks = await prisma.task.findMany({
    where: { actualHours: { gt: 0 } },
    select: {
      id: true,
      projectId: true,
      assigneeId: true,
      actualHours: true,
      dueDate: true,
      status: true,
    },
  });
  const rateByUser = Object.fromEntries(
    (await prisma.user.findMany({ select: { id: true, hourlyRate: true } })).map((u) => [
      u.id,
      u.hourlyRate,
    ]),
  );
  for (const task of seededTasks) {
    const existing = await prisma.timeLog.count({ where: { taskId: task.id } });
    if (existing > 0) continue;
    const userId = task.assigneeId ?? adminId;
    // Rozbicie na sesje po maks. 6 h, cofajac sie dzien po dniu od terminu zadania.
    let remaining = task.actualHours;
    let offset = 0;
    // Zadanie zamkniete: praca wykonana wokol terminu. Zadanie w toku: praca
    // wykonana w ostatnich dniach — inaczej obciazenie zespolu za ostatnie
    // 30 dni byloby puste mimo trwajacych projektow.
    const base = task.status === "DONE" ? (task.dueDate ?? today) : today;
    while (remaining > 0) {
      const hours = Math.min(remaining, 6);
      await prisma.timeLog.create({
        data: {
          taskId: task.id,
          projectId: task.projectId,
          userId,
          hours,
          workDate: new Date(base.getTime() - offset * day),
          rateSnapshot: rateByUser[userId] ?? null,
          note: "Wpis demonstracyjny",
        },
      });
      remaining -= hours;
      offset += 1;
    }
  }
  const logCount = await prisma.timeLog.count();
  console.log(`   wpisów czasu w bazie: ${logCount}`);

  console.log("→ Eksperci zewnętrzni");
  const expertSpecs = [
    { fullName: "Łukasz Brzeziński", specialty: "Performance marketing", hourlyRate: 280, availability: "DOSTEPNY" },
    { fullName: "Ewa Sadowska", specialty: "UX i optymalizacja konwersji", hourlyRate: 260, availability: "OGRANICZONA" },
    { fullName: "Damian Kot", specialty: "Integracje ERP/PIM", hourlyRate: 310, availability: "DOSTEPNY" },
  ];
  for (const expert of expertSpecs) {
    const exists = await prisma.externalExpert.findFirst({ where: { fullName: expert.fullName } });
    if (!exists) await prisma.externalExpert.create({ data: expert });
  }

  console.log("→ Przypisania ekspertów");
  const expertAssignments: [number, string, string, number][] = [
    // [indeks projektu, nazwisko eksperta, zakres, wartosc umowy]
    [0, "Ewa Sadowska", "Audyt UX ścieżki zakupowej", 14000],
    [1, "Łukasz Brzeziński", "Kampanie pozyskania leadów B2B", 22000],
    [2, "Damian Kot", "Integracja CRM z ERP klienta", 18000],
  ];
  for (const [index, expertName, scope, contractValue] of expertAssignments) {
    const expert = await prisma.externalExpert.findFirst({ where: { fullName: expertName } });
    if (!expert) continue;
    await prisma.projectExpert.upsert({
      where: { projectId_expertId: { projectId: projects[index].id, expertId: expert.id } },
      update: { scope, contractValue },
      create: { projectId: projects[index].id, expertId: expert.id, scope, contractValue },
    });
  }

  console.log("→ Kamienie milowe");
  const milestoneSpecs: [number, string, string, number, boolean][] = [
    [0, "Raport diagnostyczny dostarczony", "ENGINEER", 12, false],
    [1, "Strategia zaakceptowana przez zarząd", "ENGINEER", -18, true],
    [1, "Zamknięcie pierwszego kwartału wdrożenia", "EXECUTE", 34, false],
    [2, "Start produkcyjny CRM", "EXECUTE", -3, false],
    [3, "Przegląd kwartalny z klientem", "ELEVATE", 74, false],
  ];
  for (const [index, name, phase, due, done] of milestoneSpecs) {
    const exists = await prisma.milestone.findFirst({ where: { projectId: projects[index].id, name } });
    if (!exists) {
      await prisma.milestone.create({
        data: {
          projectId: projects[index].id,
          name,
          phase,
          dueDate: at(due),
          completedAt: done ? at(due) : null,
        },
      });
    }
  }

  console.log("→ Ryzyka");
  const riskSpecs: [number, string, string, string, string, string, string][] = [
    [0, "Opóźnione dostępy do analityki po stronie klienta", "RYZYKO", "SREDNI", "WYSOKI", "Eskalacja do sponsora projektu, termin przypomnienia co 3 dni", "MITIGATED"],
    [2, "Brak decyzji o migracji historycznych danych", "PROBLEM", "WYSOKI", "WYSOKI", "Warsztat decyzyjny z zarządem klienta w tym tygodniu", "OPEN"],
    [2, "Niska dostępność zespołu handlowego na szkolenia", "RYZYKO", "SREDNI", "SREDNI", "Sesje w dwóch turach, nagranie do odtworzenia", "OPEN"],
    [1, "Rotacja w zespole sprzedaży klienta", "RYZYKO", "WYSOKI", "SREDNI", "Dokumentacja procesu niezależna od osób", "OPEN"],
  ];
  for (const [index, title, kind, impact, probability, mitigation, status] of riskSpecs) {
    const exists = await prisma.risk.findFirst({ where: { projectId: projects[index].id, title } });
    if (!exists) {
      await prisma.risk.create({
        data: {
          projectId: projects[index].id,
          title,
          kind,
          impact,
          probability,
          mitigation,
          status,
          ownerId: adminId,
        },
      });
    }
  }

  console.log("→ Pipeline sprzedażowy");
  const opportunitySpecs = [
    { clientId: clients[3].id, title: "Audyt kanału B2B Formatec", stage: "KONSULTACJE", serviceType: "AUDYT_ECOMMERCE", value: 68000, probability: 40, ownerId: partnerId, expectedCloseDate: at(28) },
    { clientId: clients[1].id, title: "Ekspansja VitaPharm na rynek DACH", stage: "OFERTA_W_PRZYGOTOWANIU", serviceType: "EKSPANSJA_CROSS_BORDER", value: 180000, probability: 55, ownerId: partnerId, expectedCloseDate: at(60) },
    { clientId: clients[2].id, title: "Stała opieka Trailmark po wdrożeniu", stage: "WERYFIKACJA_OFERTY", serviceType: "INTERIM_MANAGEMENT", value: 72000, probability: 70, ownerId: partnerId, expectedCloseDate: at(20) },
    { clientId: clients[0].id, title: "Optymalizacja PIM NordicHome", stage: "OFERTA_WYSLANA", serviceType: "WDROZENIE_NARZEDZIA", value: 44000, probability: 50, ownerId: partnerId, expectedCloseDate: at(15) },
    // Zamkniete — pokazuja, jak wygladaja zebrane czynniki decyzji.
    { clientId: clients[1].id, title: "Szkolenie zespołu VitaPharm", stage: "ZAKUP", status: "WON", serviceType: "SZKOLENIE_ZESPOLU", value: 28000, probability: 100, ownerId: partnerId, expectedCloseDate: at(-12), closedAt: at(-12), winFactors: ["REKOMENDACJA", "DOSWIADCZENIE_BRANZOWE", "TERMIN_REALIZACJI"], decisionNote: "Zdecydowało polecenie od zarządu NordicHome i gotowość na termin przed sezonem." },
    { clientId: clients[3].id, title: "Interim management Formatec", stage: "ODMOWA", status: "LOST", serviceType: "INTERIM_MANAGEMENT", value: 210000, probability: 0, ownerId: partnerId, expectedCloseDate: at(-20), closedAt: at(-20), lossFactors: ["CENA_ZA_WYSOKA", "REALIZACJA_WEWNETRZNA"], decisionNote: "Klient zdecydował się obsadzić rolę wewnętrznie. Warto wrócić za dwa kwartały." },
  ];
  for (const opportunity of opportunitySpecs) {
    const exists = await prisma.opportunity.findFirst({
      where: { clientId: opportunity.clientId, title: opportunity.title },
    });
    if (!exists) await prisma.opportunity.create({ data: opportunity });
  }

  console.log("→ Notatki ze spotkań");
  const noteSpecs: [number, string, number, string, string, string[]][] = [
    // [projekt, tytul, offset daty, uczestnicy, przebieg, punkty]
    [
      0,
      "Przegląd wyników audytu z zarządem NordicHome",
      -2,
      "Agnieszka Rutkowska, Michał Sobczak, Piotr Nowicki",
      "Zarząd akceptuje kierunek rekomendacji. Priorytet numer jeden: porzucenia koszyka na urządzeniach mobilnych.",
      [
        "Przygotować zestawienie porzuceń koszyka w podziale na urządzenia",
        "Ustalić termin warsztatu wdrożeniowego z zespołem e-commerce",
        "Wysłać ofertę na moduł rekomendacji produktowych",
      ],
    ],
    [
      1,
      "Warsztat modelu prowizyjnego — VitaPharm",
      -9,
      "Robert Kamiński, Katarzyna Wrona",
      "Ustalono progi prowizyjne dla trzech segmentów. Zarząd prosi o symulację kosztową przed wdrożeniem.",
      [
        "Symulacja kosztowa modelu prowizyjnego na danych z 2025",
        "Spotkanie z działem HR w sprawie aneksów do umów",
      ],
    ],
    [
      2,
      "Status wdrożenia CRM — Trailmark",
      -4,
      "Julia Adamczyk, Piotr Nowicki",
      "Migracja kontaktów zakończona. Blokada: brak decyzji o zakresie danych historycznych.",
      ["Eskalować decyzję o danych historycznych do zarządu klienta"],
    ],
  ];
  for (const [index, title, offset, attendees, content, items] of noteSpecs) {
    const exists = await prisma.meetingNote.findFirst({
      where: { projectId: projects[index].id, title },
    });
    if (exists) continue;
    await prisma.meetingNote.create({
      data: {
        title,
        meetingDate: at(offset),
        projectId: projects[index].id,
        attendees,
        content,
        authorId: projects[index].ownerId ?? adminId,
        items: { create: items.map((c, i) => ({ content: c, position: i })) },
      },
    });
  }

  console.log("→ Raporty statusowe");
  const reportSpecs: [number, number, string, string, string | null][] = [
    // [projekt, offset daty, RAG, podsumowanie, uwaga budzetowa]
    [0, -28, "GREEN", "Diagnoza zgodnie z planem, dostępy do analityki uzyskane po eskalacji.", "Bez odchyleń"],
    [0, -14, "AMBER", "Benchmark konkurencji opóźniony o tydzień — czekamy na dane rynkowe od klienta.", "Bez odchyleń"],
    [0, -3, "GREEN", "Opóźnienie nadrobione, raport diagnostyczny w redakcji.", "Bez odchyleń"],
    [2, -12, "AMBER", "Migracja danych ruszyła, ale zakres danych historycznych wciąż nieustalony.", "Ryzyko przekroczenia o 8%"],
    [2, -2, "RED", "Termin startu produkcyjnego przekroczony. Blokada decyzyjna po stronie klienta.", "Przekroczenie 8% potwierdzone"],
  ];
  for (const [index, offset, rag, summary, budgetNote] of reportSpecs) {
    const exists = await prisma.statusReport.findFirst({
      where: { projectId: projects[index].id, summary },
    });
    if (exists) continue;
    await prisma.statusReport.create({
      data: {
        projectId: projects[index].id,
        reportDate: at(offset),
        ragStatus: rag,
        summary,
        budgetNote,
        authorId: projects[index].ownerId ?? adminId,
      },
    });
  }

  console.log("→ Komentarze");
  const commentSpecs: [string, string, string][] = [
    // [kod zadania, autor (id), tresc]
    ["ZAD-0003", partnerId, "Czy Core Web Vitals mierzysz na produkcji czy na stagingu? Klient pytał o metodologię."],
    ["ZAD-0003", consultantId, "Na produkcji, dane z CrUX za ostatnie 28 dni. Staging służy tylko do weryfikacji poprawek."],
    ["ZAD-0010", consultantId, "Migracja przeszła, ale 340 rekordów ma niespójne numery telefonów. Czyszczę ręcznie."],
  ];
  for (const [code, authorId, body] of commentSpecs) {
    const task = await prisma.task.findUnique({ where: { code }, select: { id: true } });
    if (!task) continue;
    const exists = await prisma.comment.findFirst({ where: { taskId: task.id, body } });
    if (exists) continue;
    await prisma.comment.create({ data: { taskId: task.id, authorId, body } });
  }

  console.log("→ Przeliczanie statusów RAG");
  // Ten sam algorytm co w src/server/services/rag.ts — seed nie importuje modulu
  // aplikacji, zeby dzialal bez aliasow sciezek Next.
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * day);
  for (const project of projects) {
    const [badlyOverdue, overdue, overdueMilestones, risks] = await Promise.all([
      prisma.task.count({ where: { projectId: project.id, status: { not: "DONE" }, dueDate: { lt: sevenDaysAgo } } }),
      prisma.task.count({ where: { projectId: project.id, status: { not: "DONE" }, dueDate: { lt: now } } }),
      prisma.milestone.count({ where: { projectId: project.id, completedAt: null, dueDate: { lt: now } } }),
      prisma.risk.findMany({ where: { projectId: project.id, status: "OPEN" }, select: { impact: true, probability: true } }),
    ]);
    const critical = risks.some((r) => r.impact === "WYSOKI" && r.probability === "WYSOKI");
    const highImpact = risks.some((r) => r.impact === "WYSOKI");
    const pastEnd = !!project.endDate && project.endDate < now;

    const rag = critical || badlyOverdue > 0 || pastEnd
      ? "RED"
      : highImpact || overdue > 0 || overdueMilestones > 0
        ? "AMBER"
        : "GREEN";
    await prisma.project.update({ where: { id: project.id }, data: { ragStatus: rag } });
    console.log(`   ${project.code} → ${rag}`);
  }

  console.log("\nGotowe. Konta:");
  for (const u of USERS) console.log(`   ${u.email.padEnd(30)} ${u.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
