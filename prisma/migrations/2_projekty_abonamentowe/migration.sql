-- AlterTable
ALTER TABLE "projekty" ADD COLUMN     "billingEndDate" TIMESTAMP(3),
ADD COLUMN     "billingModel" TEXT NOT NULL DEFAULT 'JEDNORAZOWY',
ADD COLUMN     "billingPeriod" TEXT,
ADD COLUMN     "billingStartDate" TIMESTAMP(3),
ADD COLUMN     "noticePeriodDays" INTEGER,
ADD COLUMN     "recurringAmount" DOUBLE PRECISION;

