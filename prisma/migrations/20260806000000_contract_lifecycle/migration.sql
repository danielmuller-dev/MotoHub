-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'TERMINATED';

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CONFIRMED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ContractEventType" AS ENUM (
    'CONTRACT_CREATED',
    'CONTRACT_ACTIVATED',
    'CONTRACT_EDITED',
    'INSTALLMENT_GENERATED',
    'PAYMENT_REGISTERED',
    'PAYMENT_PARTIAL',
    'PAYMENT_REVERSED',
    'INSTALLMENT_OVERDUE',
    'INSTALLMENT_RENEGOTIATED',
    'DISCOUNT_APPLIED',
    'FINE_APPLIED',
    'CONTRACT_SUSPENDED',
    'CONTRACT_RESUMED',
    'CONTRACT_TERMINATED',
    'CONTRACT_CANCELLED',
    'CONTRACT_COMPLETED',
    'MOTORCYCLE_STATUS_CHANGED'
);

-- AlterTable
ALTER TABLE "Contract"
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "cancellationNotes" TEXT,
ADD COLUMN "terminatedAt" TIMESTAMP(3),
ADD COLUMN "terminationReason" TEXT,
ADD COLUMN "terminationNotes" TEXT,
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspensionReason" TEXT,
ADD COLUMN "suspensionNotes" TEXT,
ADD COLUMN "suspensionExpectedResumeAt" TIMESTAMP(3),
ADD COLUMN "resumedAt" TIMESTAMP(3),
ADD COLUMN "resumeNotes" TEXT,
ADD COLUMN "closedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Installment"
ADD COLUMN "originalDueDate" TIMESTAMP(3),
ADD COLUMN "renegotiatedAt" TIMESTAMP(3),
ADD COLUMN "renegotiatedByUserId" TEXT,
ADD COLUMN "renegotiationReason" TEXT,
ADD COLUMN "renegotiationNotes" TEXT;

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN "reversedAt" TIMESTAMP(3),
ADD COLUMN "reversedByUserId" TEXT,
ADD COLUMN "reversalReason" TEXT,
ADD COLUMN "reversalNotes" TEXT;

-- CreateTable
CREATE TABLE "ContractEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "ContractEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_companyId_status_idx" ON "Payment"("companyId", "status");

-- CreateIndex
CREATE INDEX "ContractEvent_companyId_contractId_createdAt_idx" ON "ContractEvent"("companyId", "contractId", "createdAt");

-- CreateIndex
CREATE INDEX "ContractEvent_companyId_type_idx" ON "ContractEvent"("companyId", "type");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractEvent" ADD CONSTRAINT "ContractEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractEvent" ADD CONSTRAINT "ContractEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractEvent" ADD CONSTRAINT "ContractEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
