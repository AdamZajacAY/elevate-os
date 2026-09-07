-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "uzytkownicy" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CONSULTANT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "position" TEXT,
    "fte" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "hourlyRate" DOUBLE PRECISION,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "defaultView" TEXT NOT NULL DEFAULT '/dashboard',
    "urgentDays" INTEGER NOT NULL DEFAULT 3,
    "calendarToken" TEXT,
    "anonymizedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uzytkownicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integracje_google_kalendarz" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "calendarId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integracje_google_kalendarz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proby_logowania" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proby_logowania_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dziennik_audytu" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dziennik_audytu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "klienci" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "segment" TEXT NOT NULL DEFAULT 'STANDARDOWY',
    "status" TEXT NOT NULL DEFAULT 'PROSPEKT',
    "nip" TEXT,
    "krs" TEXT,
    "regon" TEXT,
    "address" TEXT,
    "city" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "retentionUntil" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "klienci_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kontakty_klienta" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "decisionLevel" TEXT NOT NULL DEFAULT 'OPERACYJNY',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kontakty_klienta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_szans" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'LEAD_OFERTA',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "serviceType" TEXT,
    "value" DOUBLE PRECISION,
    "probability" INTEGER NOT NULL DEFAULT 30,
    "expectedCloseDate" TIMESTAMP(3),
    "ownerId" TEXT,
    "lostReason" TEXT,
    "convertedProjectId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_szans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projekty" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "ownerId" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'EXPLORE',
    "ragStatus" TEXT NOT NULL DEFAULT 'GREEN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "budget" DOUBLE PRECISION,
    "contractValue" DOUBLE PRECISION,
    "quotedValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projekty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harmonogram" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'EXPLORE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "harmonogram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zadania" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assigneeId" TEXT,
    "expertId" TEXT,
    "estimatedHours" DOUBLE PRECISION,
    "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zadania_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wpisy_czasu" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "rateSnapshot" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wpisy_czasu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "szablony_checklist" (
    "id" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "szablony_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pozycje_szablonu_checklisty" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'EXPLORE',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pozycje_szablonu_checklisty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklisty_projektow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'EXPLORE',
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklisty_projektow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eksperci_zewnetrzni" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "hourlyRate" DOUBLE PRECISION,
    "availability" TEXT NOT NULL DEFAULT 'DOSTEPNY',
    "rating" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eksperci_zewnetrzni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "przypisania_ekspertow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "expertId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "contractValue" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "przypisania_ekspertow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ryzyka_i_problemy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'RYZYKO',
    "description" TEXT,
    "impact" TEXT NOT NULL DEFAULT 'SREDNI',
    "probability" TEXT NOT NULL DEFAULT 'SREDNI',
    "mitigation" TEXT,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ryzyka_i_problemy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kamienie_milowe" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'EXPLORE',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kamienie_milowe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raporty_statusowe" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "ragStatus" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "budgetNote" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raporty_statusowe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notatki_spotkan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT,
    "content" TEXT,
    "attendees" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notatki_spotkan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punkty_notatki" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "taskId" TEXT,

    CONSTRAINT "punkty_notatki_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "komentarze" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "komentarze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "powiadomienia" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "powiadomienia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etykiety_konfiguracji" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#194A99',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "etykiety_konfiguracji_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usprawnienia" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOWY',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usprawnienia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zadania_rodo" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectLabel" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zadania_rodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liczniki" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "liczniki_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "uzytkownicy_email_key" ON "uzytkownicy"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uzytkownicy_calendarToken_key" ON "uzytkownicy"("calendarToken");

-- CreateIndex
CREATE INDEX "uzytkownicy_role_isActive_idx" ON "uzytkownicy"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "integracje_google_kalendarz_userId_key" ON "integracje_google_kalendarz"("userId");

-- CreateIndex
CREATE INDEX "proby_logowania_email_ip_createdAt_idx" ON "proby_logowania"("email", "ip", "createdAt");

-- CreateIndex
CREATE INDEX "dziennik_audytu_entity_entityId_idx" ON "dziennik_audytu"("entity", "entityId");

-- CreateIndex
CREATE INDEX "dziennik_audytu_createdAt_idx" ON "dziennik_audytu"("createdAt");

-- CreateIndex
CREATE INDEX "klienci_status_idx" ON "klienci"("status");

-- CreateIndex
CREATE INDEX "kontakty_klienta_clientId_idx" ON "kontakty_klienta"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_szans_convertedProjectId_key" ON "pipeline_szans"("convertedProjectId");

-- CreateIndex
CREATE INDEX "pipeline_szans_stage_status_idx" ON "pipeline_szans"("stage", "status");

-- CreateIndex
CREATE INDEX "pipeline_szans_clientId_idx" ON "pipeline_szans"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "projekty_code_key" ON "projekty"("code");

-- CreateIndex
CREATE INDEX "projekty_status_phase_idx" ON "projekty"("status", "phase");

-- CreateIndex
CREATE INDEX "projekty_clientId_idx" ON "projekty"("clientId");

-- CreateIndex
CREATE INDEX "projekty_ownerId_idx" ON "projekty"("ownerId");

-- CreateIndex
CREATE INDEX "harmonogram_projectId_idx" ON "harmonogram"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "zadania_code_key" ON "zadania"("code");

-- CreateIndex
CREATE INDEX "zadania_projectId_status_idx" ON "zadania"("projectId", "status");

-- CreateIndex
CREATE INDEX "zadania_assigneeId_status_idx" ON "zadania"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "zadania_dueDate_idx" ON "zadania"("dueDate");

-- CreateIndex
CREATE INDEX "wpisy_czasu_projectId_workDate_idx" ON "wpisy_czasu"("projectId", "workDate");

-- CreateIndex
CREATE INDEX "wpisy_czasu_userId_workDate_idx" ON "wpisy_czasu"("userId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "szablony_checklist_serviceType_key" ON "szablony_checklist"("serviceType");

-- CreateIndex
CREATE INDEX "pozycje_szablonu_checklisty_templateId_idx" ON "pozycje_szablonu_checklisty"("templateId");

-- CreateIndex
CREATE INDEX "checklisty_projektow_projectId_phase_idx" ON "checklisty_projektow"("projectId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "eksperci_zewnetrzni_userId_key" ON "eksperci_zewnetrzni"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "przypisania_ekspertow_projectId_expertId_key" ON "przypisania_ekspertow"("projectId", "expertId");

-- CreateIndex
CREATE INDEX "ryzyka_i_problemy_projectId_status_idx" ON "ryzyka_i_problemy"("projectId", "status");

-- CreateIndex
CREATE INDEX "kamienie_milowe_projectId_dueDate_idx" ON "kamienie_milowe"("projectId", "dueDate");

-- CreateIndex
CREATE INDEX "raporty_statusowe_projectId_reportDate_idx" ON "raporty_statusowe"("projectId", "reportDate");

-- CreateIndex
CREATE INDEX "notatki_spotkan_projectId_idx" ON "notatki_spotkan"("projectId");

-- CreateIndex
CREATE INDEX "notatki_spotkan_clientId_idx" ON "notatki_spotkan"("clientId");

-- CreateIndex
CREATE INDEX "punkty_notatki_noteId_idx" ON "punkty_notatki"("noteId");

-- CreateIndex
CREATE INDEX "komentarze_taskId_createdAt_idx" ON "komentarze"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "powiadomienia_userId_readAt_idx" ON "powiadomienia"("userId", "readAt");

-- CreateIndex
CREATE INDEX "etykiety_konfiguracji_kind_idx" ON "etykiety_konfiguracji"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "etykiety_konfiguracji_kind_value_key" ON "etykiety_konfiguracji"("kind", "value");

-- CreateIndex
CREATE INDEX "usprawnienia_status_idx" ON "usprawnienia"("status");

-- CreateIndex
CREATE INDEX "zadania_rodo_subjectType_subjectId_idx" ON "zadania_rodo"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "zadania_rodo_createdAt_idx" ON "zadania_rodo"("createdAt");

-- AddForeignKey
ALTER TABLE "integracje_google_kalendarz" ADD CONSTRAINT "integracje_google_kalendarz_userId_fkey" FOREIGN KEY ("userId") REFERENCES "uzytkownicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dziennik_audytu" ADD CONSTRAINT "dziennik_audytu_userId_fkey" FOREIGN KEY ("userId") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kontakty_klienta" ADD CONSTRAINT "kontakty_klienta_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "klienci"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_szans" ADD CONSTRAINT "pipeline_szans_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "klienci"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_szans" ADD CONSTRAINT "pipeline_szans_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projekty" ADD CONSTRAINT "projekty_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "klienci"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projekty" ADD CONSTRAINT "projekty_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harmonogram" ADD CONSTRAINT "harmonogram_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projekty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zadania" ADD CONSTRAINT "zadania_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projekty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zadania" ADD CONSTRAINT "zadania_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "harmonogram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zadania" ADD CONSTRAINT "zadania_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zadania" ADD CONSTRAINT "zadania_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "eksperci_zewnetrzni"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wpisy_czasu" ADD CONSTRAINT "wpisy_czasu_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "zadania"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wpisy_czasu" ADD CONSTRAINT "wpisy_czasu_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projekty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wpisy_czasu" ADD CONSTRAINT "wpisy_czasu_userId_fkey" FOREIGN KEY ("userId") REFERENCES "uzytkownicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pozycje_szablonu_checklisty" ADD CONSTRAINT "pozycje_szablonu_checklisty_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "szablony_checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklisty_projektow" ADD CONSTRAINT "checklisty_projektow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projekty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eksperci_zewnetrzni" ADD CONSTRAINT "eksperci_zewnetrzni_userId_fkey" FOREIGN KEY ("userId") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "przypisania_ekspertow" ADD CONSTRAINT "przypisania_ekspertow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projekty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "przypisania_ekspertow" ADD CONSTRAINT "przypisania_ekspertow_expertId_fkey" FOREIGN KEY ("expertId") REFERENCES "eksperci_zewnetrzni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ryzyka_i_problemy" ADD CONSTRAINT "ryzyka_i_problemy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projekty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ryzyka_i_problemy" ADD CONSTRAINT "ryzyka_i_problemy_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kamienie_milowe" ADD CONSTRAINT "kamienie_milowe_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projekty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raporty_statusowe" ADD CONSTRAINT "raporty_statusowe_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projekty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raporty_statusowe" ADD CONSTRAINT "raporty_statusowe_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notatki_spotkan" ADD CONSTRAINT "notatki_spotkan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projekty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notatki_spotkan" ADD CONSTRAINT "notatki_spotkan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "klienci"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notatki_spotkan" ADD CONSTRAINT "notatki_spotkan_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "uzytkownicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punkty_notatki" ADD CONSTRAINT "punkty_notatki_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notatki_spotkan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punkty_notatki" ADD CONSTRAINT "punkty_notatki_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "zadania"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "komentarze" ADD CONSTRAINT "komentarze_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "zadania"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "komentarze" ADD CONSTRAINT "komentarze_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "uzytkownicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "powiadomienia" ADD CONSTRAINT "powiadomienia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "uzytkownicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usprawnienia" ADD CONSTRAINT "usprawnienia_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "uzytkownicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

