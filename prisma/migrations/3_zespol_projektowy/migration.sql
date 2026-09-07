-- CreateTable
CREATE TABLE "zespoly_projektowe" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'KONSULTANT',
    "allocation" DOUBLE PRECISION,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "zespoly_projektowe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "zespoly_projektowe_userId_idx" ON "zespoly_projektowe"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "zespoly_projektowe_projectId_userId_key" ON "zespoly_projektowe"("projectId", "userId");

-- AddForeignKey
ALTER TABLE "zespoly_projektowe" ADD CONSTRAINT "zespoly_projektowe_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projekty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zespoly_projektowe" ADD CONSTRAINT "zespoly_projektowe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "uzytkownicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

