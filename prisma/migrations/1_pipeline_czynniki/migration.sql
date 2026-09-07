-- AlterTable
ALTER TABLE "pipeline_szans" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "lossFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "winFactors" TEXT[] DEFAULT ARRAY[]::TEXT[];

