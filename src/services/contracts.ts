import {
  BillingFrequency,
  ContractType,
  MonthlyOverflowRule,
  Prisma,
  WeekDay
} from "@prisma/client";
import { generateDueDates } from "@/lib/due-dates";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit";
import { createInstallmentsForContract } from "@/services/installments";

const unavailableContractStatuses = ["ACTIVE", "OVERDUE", "SUSPENDED"] as const;

export type CreateContractInput = {
  companyId: string;
  customerId: string;
  motorcycleId: string;
  type: ContractType;
  startDate: Date;
  expectedEndDate?: Date | null;
  billingFrequency: BillingFrequency;
  firstDueDate: Date;
  weeklyDueDay?: WeekDay | null;
  monthlyDueDay?: number | null;
  monthlyOverflowRule: MonthlyOverflowRule;
  installmentAmount: number;
  totalInstallments: number;
  downPayment: number;
  lateInterestAmount: number;
  lateFeeAmount: number;
  gracePeriodDays: number;
  initialMileage?: number | null;
  mileageLimit?: number | null;
  depositAmount?: number | null;
  notes?: string | null;
  customTerms?: string | null;
  userId: string;
};

export function calculateTotalAmount(installmentAmount: number, totalInstallments: number, downPayment = 0) {
  return new Prisma.Decimal(installmentAmount)
    .mul(totalInstallments)
    .plus(downPayment)
    .toDecimalPlaces(2);
}

async function generateContractCode(tx: Prisma.TransactionClient, companyId: string) {
  const year = new Date().getUTCFullYear();
  const count = await tx.contract.count({ where: { companyId } });
  return `CTR-${year}-${String(count + 1).padStart(5, "0")}`;
}

export async function assertMotorcycleCanReceiveContract(
  tx: Prisma.TransactionClient,
  companyId: string,
  motorcycleId: string
) {
  const activeContract = await tx.contract.findFirst({
    where: {
      companyId,
      motorcycleId,
      status: {
        in: [...unavailableContractStatuses]
      }
    },
    select: { id: true, code: true }
  });

  if (activeContract) {
    throw new Error(`Esta moto ja possui contrato ativo (${activeContract.code}).`);
  }
}

export async function createActiveContract(input: CreateContractInput) {
  return prisma.$transaction(async (tx) => {
    await assertMotorcycleCanReceiveContract(tx, input.companyId, input.motorcycleId);

    const [customer, motorcycle] = await Promise.all([
      tx.customer.findFirst({
        where: {
          id: input.customerId,
          companyId: input.companyId,
          status: "ACTIVE",
          deletedAt: null
        },
        select: { id: true, fullName: true }
      }),
      tx.motorcycle.findFirst({
        where: {
          id: input.motorcycleId,
          companyId: input.companyId,
          status: { in: ["AVAILABLE", "BLOCKED"] },
          deletedAt: null
        },
        select: { id: true, brand: true, model: true, plate: true }
      })
    ]);

    if (!customer) {
      throw new Error("Cliente nao encontrado para esta empresa.");
    }

    if (!motorcycle) {
      throw new Error("Moto nao encontrada ou indisponivel para contrato.");
    }

    generateDueDates({
      billingFrequency: input.billingFrequency,
      firstDueDate: input.firstDueDate,
      totalInstallments: input.totalInstallments,
      weeklyDueDay: input.weeklyDueDay,
      monthlyDueDay: input.monthlyDueDay,
      monthlyOverflowRule: input.monthlyOverflowRule
    });

    const contract = await tx.contract.create({
      data: {
        companyId: input.companyId,
        customerId: input.customerId,
        motorcycleId: input.motorcycleId,
        code: await generateContractCode(tx, input.companyId),
        type: input.type,
        startDate: input.startDate,
        expectedEndDate: input.expectedEndDate,
        billingFrequency: input.billingFrequency,
        firstDueDate: input.firstDueDate,
        weeklyDueDay: input.billingFrequency === "WEEKLY" ? input.weeklyDueDay : null,
        monthlyDueDay: input.billingFrequency === "MONTHLY" ? input.monthlyDueDay : null,
        monthlyOverflowRule: input.monthlyOverflowRule,
        installmentAmount: new Prisma.Decimal(input.installmentAmount),
        totalInstallments: input.totalInstallments,
        downPayment: new Prisma.Decimal(input.downPayment),
        totalAmount: calculateTotalAmount(
          input.installmentAmount,
          input.totalInstallments,
          input.downPayment
        ),
        lateInterestAmount: new Prisma.Decimal(input.lateInterestAmount),
        lateFeeAmount: new Prisma.Decimal(input.lateFeeAmount),
        gracePeriodDays: input.gracePeriodDays,
        initialMileage: input.initialMileage,
        mileageLimit: input.mileageLimit,
        depositAmount:
          input.depositAmount === null || input.depositAmount === undefined
            ? undefined
            : new Prisma.Decimal(input.depositAmount),
        notes: input.notes,
        customTerms: input.customTerms,
        status: "ACTIVE",
        activatedAt: new Date()
      }
    });

    await createInstallmentsForContract(tx, contract);

    await tx.motorcycle.update({
      where: { id: input.motorcycleId },
      data: {
        status: "RENTED",
        currentCustomerId: input.customerId
      }
    });

    await recordAudit(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: "CONTRACT_ACTIVATED",
      entity: "Contract",
      entityId: contract.id,
      description: `Contrato ${contract.code} ativado para ${customer.fullName}.`,
      after: {
        contractCode: contract.code,
        customerId: input.customerId,
        motorcycleId: input.motorcycleId
      }
    });

    return contract;
  });
}

export async function cancelContract(companyId: string, contractId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findFirst({
      where: { id: contractId, companyId },
      include: { motorcycle: true }
    });

    if (!contract) {
      throw new Error("Contrato nao encontrado.");
    }

    if (!["ACTIVE", "OVERDUE", "SUSPENDED", "DRAFT"].includes(contract.status)) {
      throw new Error("Este contrato nao pode ser cancelado.");
    }

    const updated = await tx.contract.update({
      where: { id: contract.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date()
      }
    });

    await tx.motorcycle.update({
      where: { id: contract.motorcycleId },
      data: {
        status: "AVAILABLE",
        currentCustomerId: null
      }
    });

    await recordAudit(tx, {
      companyId,
      userId,
      action: "CONTRACT_CANCELLED",
      entity: "Contract",
      entityId: contract.id,
      description: `Contrato ${contract.code} cancelado.`,
      before: { status: contract.status },
      after: { status: updated.status }
    });

    return updated;
  });
}
