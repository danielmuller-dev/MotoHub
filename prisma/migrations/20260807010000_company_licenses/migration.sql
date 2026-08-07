-- CreateEnum
CREATE TYPE "CompanyLicensePlan" AS ENUM ('FREE_30', 'THIRTY_DAYS', 'NINETY_DAYS', 'ANNUAL', 'LIFETIME');

-- AlterTable
ALTER TABLE "Company"
ADD COLUMN "licensePlan" "CompanyLicensePlan" NOT NULL DEFAULT 'FREE_30',
ADD COLUMN "licenseStartsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "licenseExpiresAt" TIMESTAMP(3),
ADD COLUMN "licenseUpdatedAt" TIMESTAMP(3);

-- Preserve current active customers while the new licensing system is introduced.
UPDATE "Company"
SET
  "licensePlan" = 'LIFETIME',
  "licenseExpiresAt" = NULL,
  "licenseUpdatedAt" = CURRENT_TIMESTAMP,
  "subscriptionStatus" = 'lifetime'
WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX "Company_licensePlan_idx" ON "Company"("licensePlan");

-- CreateIndex
CREATE INDEX "Company_licenseExpiresAt_idx" ON "Company"("licenseExpiresAt");
