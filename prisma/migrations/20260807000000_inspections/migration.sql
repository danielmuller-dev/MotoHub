-- AlterEnum
ALTER TYPE "ContractEventType" ADD VALUE 'INSPECTION_CREATED';
ALTER TYPE "ContractEventType" ADD VALUE 'INSPECTION_COMPLETED';
ALTER TYPE "ContractEventType" ADD VALUE 'INSPECTION_CANCELLED';
ALTER TYPE "ContractEventType" ADD VALUE 'INSPECTION_DAMAGE_REGISTERED';
ALTER TYPE "ContractEventType" ADD VALUE 'INSPECTION_CHARGE_CREATED';
ALTER TYPE "ContractEventType" ADD VALUE 'INSPECTION_MAINTENANCE_CREATED';

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('DELIVERY', 'PERIODIC', 'RETURN', 'EXTRAORDINARY');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionItemCondition" AS ENUM ('OK', 'DAMAGED', 'MISSING', 'NEEDS_MAINTENANCE', 'NOT_APPLICABLE', 'NOT_CHECKED');

-- CreateEnum
CREATE TYPE "FuelLevel" AS ENUM ('EMPTY', 'RESERVE', 'ONE_QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL');

-- CreateEnum
CREATE TYPE "InspectionPhotoType" AS ENUM ('FRONT', 'REAR', 'LEFT_SIDE', 'RIGHT_SIDE', 'ODOMETER', 'PLATE', 'ENGINE', 'FRONT_TIRE', 'REAR_TIRE', 'DAMAGE', 'ACCESSORY', 'SIGNATURE', 'OTHER');

-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "DamageStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CHARGED', 'REPAIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DamageResponsibleParty" AS ENUM ('CUSTOMER', 'COMPANY', 'THIRD_PARTY', 'UNDEFINED');

-- CreateEnum
CREATE TYPE "InspectionSignatureType" AS ENUM ('EMPLOYEE', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "AdditionalChargeType" AS ENUM ('DAMAGE', 'MILEAGE_EXCESS', 'MISSING_ACCESSORY', 'FUEL_DIFFERENCE', 'FINE', 'OTHER');

-- CreateEnum
CREATE TYPE "AdditionalChargeStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'OVERDUE');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "additionalChargeId" TEXT;

-- AlterTable
ALTER TABLE "Maintenance" ADD COLUMN "inspectionId" TEXT;

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contractId" TEXT,
    "motorcycleId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdByUserId" TEXT,
    "completedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "code" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "inspectionDate" TIMESTAMP(3) NOT NULL,
    "mileage" INTEGER NOT NULL,
    "fuelLevel" "FuelLevel" NOT NULL,
    "generalCondition" TEXT,
    "generalDamages" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "administrativeNotes" TEXT,
    "customerPresent" BOOLEAN NOT NULL DEFAULT false,
    "customerRefusedSignature" BOOLEAN NOT NULL DEFAULT false,
    "refusalReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "deliveryConfirmedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "destinationStatus" "MotorcycleStatus",
    "mileageDriven" INTEGER,
    "mileageExcess" INTEGER,
    "mileageExcessCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "condition" "InspectionItemCondition" NOT NULL DEFAULT 'NOT_CHECKED',
    "notes" TEXT,
    "photoUrl" TEXT,
    "estimatedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "preExisting" BOOLEAN NOT NULL DEFAULT false,
    "newDamage" BOOLEAN NOT NULL DEFAULT false,
    "chargeCustomer" BOOLEAN NOT NULL DEFAULT false,
    "evaluatorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionPhoto" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "inspectionItemId" TEXT,
    "type" "InspectionPhotoType" NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InspectionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionDamage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "inspectionItemId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "DamageSeverity" NOT NULL DEFAULT 'LOW',
    "preExisting" BOOLEAN NOT NULL DEFAULT false,
    "newDamage" BOOLEAN NOT NULL DEFAULT false,
    "chargeCustomer" BOOLEAN NOT NULL DEFAULT false,
    "estimatedCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "approvedChargeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "DamageStatus" NOT NULL DEFAULT 'OPEN',
    "responsibleParty" "DamageResponsibleParty" NOT NULL DEFAULT 'UNDEFINED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionDamage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionAccessory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "delivered" BOOLEAN NOT NULL DEFAULT false,
    "returned" BOOLEAN NOT NULL DEFAULT false,
    "condition" "InspectionItemCondition" NOT NULL DEFAULT 'NOT_CHECKED',
    "notes" TEXT,
    "replacementCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "chargeCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InspectionAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionSignature" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "type" "InspectionSignatureType" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "signedByName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalCharge" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "motorcycleId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "inspectionDamageId" TEXT,
    "createdByUserId" TEXT,
    "code" TEXT NOT NULL,
    "type" "AdditionalChargeType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "AdditionalChargeStatus" NOT NULL DEFAULT 'PENDING',
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdditionalCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_companyId_code_key" ON "Inspection"("companyId", "code");
CREATE INDEX "Inspection_companyId_type_status_idx" ON "Inspection"("companyId", "type", "status");
CREATE INDEX "Inspection_companyId_inspectionDate_idx" ON "Inspection"("companyId", "inspectionDate");
CREATE INDEX "Inspection_companyId_contractId_idx" ON "Inspection"("companyId", "contractId");
CREATE INDEX "Inspection_companyId_motorcycleId_idx" ON "Inspection"("companyId", "motorcycleId");
CREATE INDEX "Inspection_companyId_customerId_idx" ON "Inspection"("companyId", "customerId");
CREATE INDEX "InspectionItem_companyId_inspectionId_idx" ON "InspectionItem"("companyId", "inspectionId");
CREATE INDEX "InspectionItem_companyId_itemKey_idx" ON "InspectionItem"("companyId", "itemKey");
CREATE INDEX "InspectionPhoto_companyId_inspectionId_type_idx" ON "InspectionPhoto"("companyId", "inspectionId", "type");
CREATE INDEX "InspectionPhoto_companyId_inspectionItemId_idx" ON "InspectionPhoto"("companyId", "inspectionItemId");
CREATE INDEX "InspectionDamage_companyId_inspectionId_idx" ON "InspectionDamage"("companyId", "inspectionId");
CREATE INDEX "InspectionDamage_companyId_status_idx" ON "InspectionDamage"("companyId", "status");
CREATE INDEX "InspectionAccessory_companyId_inspectionId_idx" ON "InspectionAccessory"("companyId", "inspectionId");
CREATE INDEX "InspectionSignature_companyId_inspectionId_type_idx" ON "InspectionSignature"("companyId", "inspectionId", "type");
CREATE UNIQUE INDEX "AdditionalCharge_companyId_code_key" ON "AdditionalCharge"("companyId", "code");
CREATE INDEX "AdditionalCharge_companyId_status_dueDate_idx" ON "AdditionalCharge"("companyId", "status", "dueDate");
CREATE INDEX "AdditionalCharge_companyId_contractId_idx" ON "AdditionalCharge"("companyId", "contractId");
CREATE INDEX "AdditionalCharge_companyId_inspectionId_idx" ON "AdditionalCharge"("companyId", "inspectionId");
CREATE INDEX "Payment_companyId_additionalChargeId_idx" ON "Payment"("companyId", "additionalChargeId");
CREATE INDEX "Maintenance_companyId_inspectionId_idx" ON "Maintenance"("companyId", "inspectionId");

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_motorcycleId_fkey" FOREIGN KEY ("motorcycleId") REFERENCES "Motorcycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionPhoto" ADD CONSTRAINT "InspectionPhoto_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionPhoto" ADD CONSTRAINT "InspectionPhoto_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionPhoto" ADD CONSTRAINT "InspectionPhoto_inspectionItemId_fkey" FOREIGN KEY ("inspectionItemId") REFERENCES "InspectionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InspectionPhoto" ADD CONSTRAINT "InspectionPhoto_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InspectionDamage" ADD CONSTRAINT "InspectionDamage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionDamage" ADD CONSTRAINT "InspectionDamage_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionDamage" ADD CONSTRAINT "InspectionDamage_inspectionItemId_fkey" FOREIGN KEY ("inspectionItemId") REFERENCES "InspectionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InspectionAccessory" ADD CONSTRAINT "InspectionAccessory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionAccessory" ADD CONSTRAINT "InspectionAccessory_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionSignature" ADD CONSTRAINT "InspectionSignature_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InspectionSignature" ADD CONSTRAINT "InspectionSignature_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdditionalCharge" ADD CONSTRAINT "AdditionalCharge_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdditionalCharge" ADD CONSTRAINT "AdditionalCharge_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdditionalCharge" ADD CONSTRAINT "AdditionalCharge_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdditionalCharge" ADD CONSTRAINT "AdditionalCharge_motorcycleId_fkey" FOREIGN KEY ("motorcycleId") REFERENCES "Motorcycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdditionalCharge" ADD CONSTRAINT "AdditionalCharge_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdditionalCharge" ADD CONSTRAINT "AdditionalCharge_inspectionDamageId_fkey" FOREIGN KEY ("inspectionDamageId") REFERENCES "InspectionDamage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdditionalCharge" ADD CONSTRAINT "AdditionalCharge_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_additionalChargeId_fkey" FOREIGN KEY ("additionalChargeId") REFERENCES "AdditionalCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
