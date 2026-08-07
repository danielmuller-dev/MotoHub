import { BillingFrequency, MonthlyOverflowRule, Prisma, WeekDay } from "@prisma/client";
import { generateDueDates, normalizeDateOnly } from "@/lib/due-dates";
import { prisma } from "@/lib/prisma";

type ContractInstallmentSource = {
  id: string;
  companyId: string;
  billingFrequency: BillingFrequency;
  firstDueDate: Date;
  weeklyDueDay: WeekDay | null;
  monthlyDueDay: number | null;
  monthlyOverflowRule: MonthlyOverflowRule;
  totalInstallments: number;
  installmentAmount: Prisma.Decimal;
};

export function buildInstallmentRows(contract: ContractInstallmentSource) {
  const dates = generateDueDates({
    billingFrequency: contract.billingFrequency,
    firstDueDate: contract.firstDueDate,
    totalInstallments: contract.totalInstallments,
    weeklyDueDay: contract.weeklyDueDay,
    monthlyDueDay: contract.monthlyDueDay,
    monthlyOverflowRule: contract.monthlyOverflowRule
  });

  return dates.map((dueDate, index) => ({
    companyId: contract.companyId,
    contractId: contract.id,
    number: index + 1,
    dueDate,
    originalAmount: contract.installmentAmount,
    finalAmount: contract.installmentAmount
  }));
}

export async function createInstallmentsForContract(
  tx: Prisma.TransactionClient,
  contract: ContractInstallmentSource
) {
  return tx.installment.createMany({
    data: buildInstallmentRows(contract)
  });
}

export async function updateOverdueInstallments(companyId?: string) {
  const today = normalizeDateOnly(new Date());
  const where = {
    dueDate: { lt: today },
    status: "PENDING" as const,
    ...(companyId ? { companyId } : {})
  };

  const overdue = await prisma.installment.findMany({
    where,
    select: {
      id: true,
      companyId: true,
      contractId: true,
      number: true
    }
  });

  if (!overdue.length) {
    return 0;
  }

  await prisma.installment.updateMany({
    where: {
      id: { in: overdue.map((item) => item.id) }
    },
    data: {
      status: "OVERDUE"
    }
  });

  await prisma.contract.updateMany({
    where: {
      id: { in: [...new Set(overdue.map((item) => item.contractId))] },
      status: "ACTIVE"
    },
    data: {
      status: "OVERDUE"
    }
  });

  await prisma.contractEvent.createMany({
    data: overdue.map((installment) => ({
      companyId: installment.companyId,
      contractId: installment.contractId,
      type: "INSTALLMENT_OVERDUE",
      title: "Parcela atrasada",
      description: `Parcela ${installment.number} marcada como atrasada.`,
      metadata: {
        installmentId: installment.id,
        installmentNumber: installment.number
      }
    }))
  });

  return overdue.length;
}

export function installmentBalance(installment: {
  finalAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
}) {
  return installment.finalAmount.minus(installment.paidAmount);
}
