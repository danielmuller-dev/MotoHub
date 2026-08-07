import {
  BillingFrequency,
  ContractType,
  MonthlyOverflowRule,
  MotorcycleStatus,
  Prisma,
  WeekDay
} from "@prisma/client";
import type { ContractStatus, InstallmentStatus } from "@prisma/client";
import {
  calculateRenegotiatedInstallment,
  installmentStatusFromBalance,
  isFinalContractStatus,
  openInstallmentStatuses,
  statusAfterResume
} from "@/lib/contract-lifecycle";
import { generateDueDates, normalizeDateOnly } from "@/lib/due-dates";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit";
import { recordContractEvent } from "@/services/contract-events";
import { createInstallmentsForContract } from "@/services/installments";

const unavailableContractStatuses = ["ACTIVE", "OVERDUE", "SUSPENDED"] as const;
const openStatuses = openInstallmentStatuses as InstallmentStatus[];
const immutableStatuses: ContractStatus[] = ["COMPLETED", "CANCELLED", "TERMINATED"];

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

export type MotorcycleDisposition = "AVAILABLE" | "MAINTENANCE" | "BLOCKED" | "SOLD";

export type UpdateContractDetailsInput = {
  companyId: string;
  contractId: string;
  userId: string;
  expectedEndDate?: Date | null;
  lateInterestAmount: number;
  lateFeeAmount: number;
  gracePeriodDays: number;
  mileageLimit?: number | null;
  notes?: string | null;
  customTerms?: string | null;
};

export type TerminateContractInput = {
  companyId: string;
  contractId: string;
  userId: string;
  terminatedAt: Date;
  reason: string;
  notes: string;
  cancelFutureInstallments: boolean;
  motorcycleDisposition: MotorcycleDisposition;
};

export type CancelContractInput = {
  companyId: string;
  contractId: string;
  userId: string;
  cancelledAt: Date;
  reason: string;
  notes: string;
  cancelFutureInstallments: boolean;
  releaseMotorcycle: boolean;
};

export type SuspendContractInput = {
  companyId: string;
  contractId: string;
  userId: string;
  suspendedAt: Date;
  expectedResumeAt?: Date | null;
  reason: string;
  notes?: string | null;
  freezeDueDates: boolean;
};

export type ResumeContractInput = {
  companyId: string;
  contractId: string;
  userId: string;
  resumedAt: Date;
  notes?: string | null;
};

export type RenegotiateInstallmentInput = {
  companyId: string;
  contractId: string;
  installmentId: string;
  userId: string;
  newDueDate: Date;
  discountAmount: number;
  penaltyAmount: number;
  interestAmount: number;
  reason: string;
  notes?: string | null;
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

function requireNotes(value: string, fieldName = "Observacao") {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} obrigatoria.`);
  }
  return trimmed;
}

function requireReason(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Motivo obrigatorio.");
  }
  return trimmed;
}

function motorcycleUpdateForDisposition(disposition: MotorcycleDisposition) {
  const status: MotorcycleStatus = disposition;
  return {
    status,
    currentCustomerId: null
  };
}

async function cancelFuturePendingInstallments(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    contractId: string;
    fromDate: Date;
  }
) {
  return tx.installment.updateMany({
    where: {
      companyId: input.companyId,
      contractId: input.contractId,
      dueDate: { gt: normalizeDateOnly(input.fromDate) },
      status: "PENDING"
    },
    data: {
      status: "CANCELLED"
    }
  });
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

export async function refreshContractFinancialState(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    contractId: string;
    userId?: string | null;
    today?: Date;
  }
) {
  const contract = await tx.contract.findFirst({
    where: { id: input.contractId, companyId: input.companyId },
    select: {
      id: true,
      code: true,
      companyId: true,
      customerId: true,
      motorcycleId: true,
      type: true,
      status: true
    }
  });

  if (!contract) {
    throw new Error("Contrato nao encontrado.");
  }

  if (contract.status === "CANCELLED" || contract.status === "TERMINATED" || contract.status === "SUSPENDED") {
    return contract.status;
  }

  const today = normalizeDateOnly(input.today ?? new Date());
  const [openInstallments, overdueInstallments] = await Promise.all([
    tx.installment.count({
      where: {
        companyId: input.companyId,
        contractId: input.contractId,
        status: { in: openStatuses }
      }
    }),
    tx.installment.count({
      where: {
        companyId: input.companyId,
        contractId: input.contractId,
        dueDate: { lt: today },
        status: { in: openStatuses }
      }
    })
  ]);

  if (openInstallments === 0) {
    if (contract.status !== "COMPLETED") {
      await tx.contract.update({
        where: { id: contract.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date()
        }
      });

      await tx.motorcycle.update({
        where: { id: contract.motorcycleId },
        data:
          contract.type === "RENT_TO_OWN"
            ? { status: "SOLD", currentCustomerId: null }
            : { status: "AVAILABLE", currentCustomerId: null }
      });

      await recordContractEvent(tx, {
        companyId: input.companyId,
        contractId: contract.id,
        userId: input.userId,
        type: "CONTRACT_COMPLETED",
        title: "Contrato concluido",
        description: `Contrato ${contract.code} concluido por quitacao das parcelas.`,
        metadata: { previousStatus: contract.status, status: "COMPLETED" }
      });
    }

    return "COMPLETED" as const;
  }

  const nextStatus = overdueInstallments > 0 ? "OVERDUE" : "ACTIVE";
  if (contract.status !== nextStatus) {
    await tx.contract.update({
      where: { id: contract.id },
      data: {
        status: nextStatus,
        completedAt: null
      }
    });

    if (contract.status === "COMPLETED") {
      const motorcycle = await tx.motorcycle.findFirst({
        where: { id: contract.motorcycleId, companyId: input.companyId },
        select: { status: true }
      });

      if (motorcycle && motorcycle.status !== "SOLD") {
        await tx.motorcycle.update({
          where: { id: contract.motorcycleId },
          data: { status: "RENTED", currentCustomerId: contract.customerId }
        });
      }
    }
  }

  return nextStatus;
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

    await recordContractEvent(tx, {
      companyId: input.companyId,
      contractId: contract.id,
      userId: input.userId,
      type: "CONTRACT_ACTIVATED",
      title: "Contrato ativado",
      description: `Contrato ${contract.code} ativado para ${customer.fullName}.`,
      metadata: {
        customerId: input.customerId,
        motorcycleId: input.motorcycleId,
        totalInstallments: input.totalInstallments
      }
    });

    await recordContractEvent(tx, {
      companyId: input.companyId,
      contractId: contract.id,
      userId: input.userId,
      type: "INSTALLMENT_GENERATED",
      title: "Parcelas geradas",
      description: `${input.totalInstallments} parcela(s) geradas automaticamente.`,
      metadata: { totalInstallments: input.totalInstallments }
    });

    return contract;
  });
}

export async function updateContractDetails(input: UpdateContractDetailsInput) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findFirst({
      where: { id: input.contractId, companyId: input.companyId, deletedAt: null }
    });

    if (!contract) {
      throw new Error("Contrato nao encontrado.");
    }

    if (isFinalContractStatus(contract.status) || contract.status === "SUSPENDED") {
      throw new Error("Contrato finalizado ou suspenso nao permite edicao.");
    }

    const updated = await tx.contract.update({
      where: { id: contract.id },
      data: {
        expectedEndDate: input.expectedEndDate ?? null,
        lateInterestAmount: new Prisma.Decimal(input.lateInterestAmount).toDecimalPlaces(2),
        lateFeeAmount: new Prisma.Decimal(input.lateFeeAmount).toDecimalPlaces(2),
        gracePeriodDays: input.gracePeriodDays,
        mileageLimit: input.mileageLimit ?? null,
        notes: input.notes?.trim() || null,
        customTerms: input.customTerms?.trim() || null
      }
    });

    await recordAudit(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: "CONTRACT_EDITED",
      entity: "Contract",
      entityId: contract.id,
      description: `Contrato ${contract.code} editado.`,
      before: {
        expectedEndDate: contract.expectedEndDate?.toISOString() ?? null,
        lateInterestAmount: contract.lateInterestAmount.toString(),
        lateFeeAmount: contract.lateFeeAmount.toString(),
        gracePeriodDays: contract.gracePeriodDays,
        mileageLimit: contract.mileageLimit,
        notes: contract.notes,
        customTerms: contract.customTerms
      },
      after: {
        expectedEndDate: updated.expectedEndDate?.toISOString() ?? null,
        lateInterestAmount: updated.lateInterestAmount.toString(),
        lateFeeAmount: updated.lateFeeAmount.toString(),
        gracePeriodDays: updated.gracePeriodDays,
        mileageLimit: updated.mileageLimit,
        notes: updated.notes,
        customTerms: updated.customTerms
      }
    });

    await recordContractEvent(tx, {
      companyId: input.companyId,
      contractId: contract.id,
      userId: input.userId,
      type: "CONTRACT_EDITED",
      title: "Contrato editado",
      description: `Dados administrativos do contrato ${contract.code} atualizados.`,
      metadata: {
        previousStatus: contract.status,
        status: updated.status
      }
    });

    return updated;
  });
}

export async function terminateContract(input: TerminateContractInput) {
  const reason = requireReason(input.reason);
  const notes = requireNotes(input.notes);

  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findFirst({
      where: { id: input.contractId, companyId: input.companyId, deletedAt: null },
      include: { customer: true, motorcycle: true }
    });

    if (!contract) {
      throw new Error("Contrato nao encontrado.");
    }

    if (isFinalContractStatus(contract.status)) {
      throw new Error("Contrato finalizado nao pode ser encerrado novamente.");
    }

    let cancelledInstallments = 0;
    if (input.cancelFutureInstallments) {
      const result = await cancelFuturePendingInstallments(tx, {
        companyId: input.companyId,
        contractId: contract.id,
        fromDate: input.terminatedAt
      });
      cancelledInstallments = result.count;
    }

    const updated = await tx.contract.update({
      where: { id: contract.id },
      data: {
        status: "TERMINATED",
        terminatedAt: input.terminatedAt,
        terminationReason: reason,
        terminationNotes: notes,
        completedAt: null,
        closedByUserId: input.userId
      }
    });

    await tx.motorcycle.update({
      where: { id: contract.motorcycleId },
      data: motorcycleUpdateForDisposition(input.motorcycleDisposition)
    });

    await recordAudit(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: "CONTRACT_TERMINATED",
      entity: "Contract",
      entityId: contract.id,
      description: `Contrato ${contract.code} encerrado.`,
      before: { status: contract.status },
      after: {
        status: updated.status,
        reason,
        cancelledInstallments,
        motorcycleStatus: input.motorcycleDisposition
      }
    });

    await recordContractEvent(tx, {
      companyId: input.companyId,
      contractId: contract.id,
      userId: input.userId,
      type: "CONTRACT_TERMINATED",
      title: "Contrato encerrado",
      description: `Contrato encerrado por ${reason}.`,
      metadata: {
        previousStatus: contract.status,
        status: updated.status,
        cancelledInstallments,
        motorcycleStatus: input.motorcycleDisposition
      }
    });

    return updated;
  });
}

export async function cancelContract(input: CancelContractInput) {
  const reason = requireReason(input.reason);
  const notes = requireNotes(input.notes);

  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findFirst({
      where: { id: input.contractId, companyId: input.companyId, deletedAt: null },
      include: { motorcycle: true }
    });

    if (!contract) {
      throw new Error("Contrato nao encontrado.");
    }

    if (contract.status === "CANCELLED") {
      throw new Error("Contrato ja esta cancelado.");
    }

    if (immutableStatuses.includes(contract.status)) {
      throw new Error("Este contrato nao pode ser cancelado.");
    }

    let cancelledInstallments = 0;
    if (input.cancelFutureInstallments) {
      const result = await cancelFuturePendingInstallments(tx, {
        companyId: input.companyId,
        contractId: contract.id,
        fromDate: input.cancelledAt
      });
      cancelledInstallments = result.count;
    }

    const updated = await tx.contract.update({
      where: { id: contract.id },
      data: {
        status: "CANCELLED",
        cancelledAt: input.cancelledAt,
        cancellationReason: reason,
        cancellationNotes: notes,
        completedAt: null,
        closedByUserId: input.userId
      }
    });

    if (input.releaseMotorcycle) {
      await tx.motorcycle.update({
        where: { id: contract.motorcycleId },
        data: {
          status: "AVAILABLE",
          currentCustomerId: null
        }
      });
    }

    await recordAudit(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: "CONTRACT_CANCELLED",
      entity: "Contract",
      entityId: contract.id,
      description: `Contrato ${contract.code} cancelado.`,
      before: { status: contract.status },
      after: {
        status: updated.status,
        reason,
        cancelledInstallments,
        releaseMotorcycle: input.releaseMotorcycle
      }
    });

    await recordContractEvent(tx, {
      companyId: input.companyId,
      contractId: contract.id,
      userId: input.userId,
      type: "CONTRACT_CANCELLED",
      title: "Contrato cancelado",
      description: `Contrato cancelado por ${reason}.`,
      metadata: {
        previousStatus: contract.status,
        status: updated.status,
        cancelledInstallments,
        releaseMotorcycle: input.releaseMotorcycle
      }
    });

    return updated;
  });
}

export async function suspendContract(input: SuspendContractInput) {
  const reason = requireReason(input.reason);

  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findFirst({
      where: { id: input.contractId, companyId: input.companyId, deletedAt: null }
    });

    if (!contract) {
      throw new Error("Contrato nao encontrado.");
    }

    if (!["ACTIVE", "OVERDUE"].includes(contract.status)) {
      throw new Error("Somente contratos ativos ou atrasados podem ser suspensos.");
    }

    const updated = await tx.contract.update({
      where: { id: contract.id },
      data: {
        status: "SUSPENDED",
        suspendedAt: input.suspendedAt,
        suspensionExpectedResumeAt: input.expectedResumeAt,
        suspensionReason: reason,
        suspensionNotes: input.notes?.trim() || null
      }
    });

    await recordAudit(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: "CONTRACT_SUSPENDED",
      entity: "Contract",
      entityId: contract.id,
      description: `Contrato ${contract.code} suspenso.`,
      before: { status: contract.status },
      after: {
        status: updated.status,
        reason,
        freezeDueDates: input.freezeDueDates
      }
    });

    await recordContractEvent(tx, {
      companyId: input.companyId,
      contractId: contract.id,
      userId: input.userId,
      type: "CONTRACT_SUSPENDED",
      title: "Contrato suspenso",
      description: `Contrato suspenso por ${reason}.`,
      metadata: {
        previousStatus: contract.status,
        status: updated.status,
        freezeDueDates: input.freezeDueDates,
        expectedResumeAt: input.expectedResumeAt?.toISOString() ?? null
      }
    });

    return updated;
  });
}

export async function resumeContract(input: ResumeContractInput) {
  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findFirst({
      where: { id: input.contractId, companyId: input.companyId, deletedAt: null }
    });

    if (!contract) {
      throw new Error("Contrato nao encontrado.");
    }

    if (contract.status !== "SUSPENDED") {
      throw new Error("Somente contratos suspensos podem ser retomados.");
    }

    const resumedAt = normalizeDateOnly(input.resumedAt);
    const [openInstallments, overdueInstallments] = await Promise.all([
      tx.installment.count({
        where: {
          companyId: input.companyId,
          contractId: contract.id,
          status: { in: openStatuses }
        }
      }),
      tx.installment.count({
        where: {
          companyId: input.companyId,
          contractId: contract.id,
          dueDate: { lt: resumedAt },
          status: { in: openStatuses }
        }
      })
    ]);
    const nextStatus = statusAfterResume({
      hasOpenInstallments: openInstallments > 0,
      hasOverdueInstallments: overdueInstallments > 0
    });

    const updated = await tx.contract.update({
      where: { id: contract.id },
      data: {
        status: nextStatus,
        resumedAt: input.resumedAt,
        resumeNotes: input.notes?.trim() || null,
        completedAt: nextStatus === "COMPLETED" ? new Date() : null
      }
    });

    if (nextStatus === "COMPLETED") {
      await tx.motorcycle.update({
        where: { id: contract.motorcycleId },
        data:
          contract.type === "RENT_TO_OWN"
            ? { status: "SOLD", currentCustomerId: null }
            : { status: "AVAILABLE", currentCustomerId: null }
      });
    }

    await recordAudit(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: "CONTRACT_RESUMED",
      entity: "Contract",
      entityId: contract.id,
      description: `Contrato ${contract.code} retomado.`,
      before: { status: contract.status },
      after: { status: updated.status }
    });

    await recordContractEvent(tx, {
      companyId: input.companyId,
      contractId: contract.id,
      userId: input.userId,
      type: "CONTRACT_RESUMED",
      title: "Contrato retomado",
      description: `Contrato retomado com status ${updated.status}.`,
      metadata: {
        previousStatus: contract.status,
        status: updated.status
      }
    });

    return updated;
  });
}

export async function renegotiateInstallment(input: RenegotiateInstallmentInput) {
  const reason = requireReason(input.reason);

  return prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findFirst({
      where: {
        id: input.installmentId,
        companyId: input.companyId,
        contractId: input.contractId
      },
      include: {
        contract: {
          select: {
            id: true,
            code: true,
            companyId: true,
            status: true
          }
        }
      }
    });

    if (!installment) {
      throw new Error("Parcela nao encontrada para este contrato.");
    }

    if (installment.contract.companyId !== input.companyId) {
      throw new Error("Contrato nao pertence a esta empresa.");
    }

    if (isFinalContractStatus(installment.contract.status) || installment.contract.status === "SUSPENDED") {
      throw new Error("Contrato finalizado ou suspenso nao permite renegociacao.");
    }

    if (installment.status === "PAID") {
      throw new Error("Nao e permitido renegociar parcela paga integralmente.");
    }

    if (installment.status === "CANCELLED") {
      throw new Error("Nao e permitido renegociar parcela cancelada.");
    }

    const amounts = calculateRenegotiatedInstallment({
      originalAmount: installment.originalAmount.toNumber(),
      paidAmount: installment.paidAmount.toNumber(),
      discountAmount: input.discountAmount,
      penaltyAmount: input.penaltyAmount,
      interestAmount: input.interestAmount
    });
    const newDueDate = normalizeDateOnly(input.newDueDate);
    const today = normalizeDateOnly(new Date());
    const nextStatus = installmentStatusFromBalance({
      dueDate: newDueDate,
      paidAmount: installment.paidAmount.toNumber(),
      finalAmount: amounts.finalAmount,
      today
    });

    const updated = await tx.installment.update({
      where: { id: installment.id },
      data: {
        originalDueDate: installment.originalDueDate ?? installment.dueDate,
        dueDate: newDueDate,
        discountAmount: new Prisma.Decimal(input.discountAmount).toDecimalPlaces(2),
        penaltyAmount: new Prisma.Decimal(input.penaltyAmount).toDecimalPlaces(2),
        interestAmount: new Prisma.Decimal(input.interestAmount).toDecimalPlaces(2),
        finalAmount: new Prisma.Decimal(amounts.finalAmount).toDecimalPlaces(2),
        paymentDate: nextStatus === "PAID" ? installment.paymentDate ?? new Date() : null,
        status: nextStatus,
        renegotiatedAt: new Date(),
        renegotiatedByUserId: input.userId,
        renegotiationReason: reason,
        renegotiationNotes: input.notes?.trim() || null
      }
    });

    await refreshContractFinancialState(tx, {
      companyId: input.companyId,
      contractId: input.contractId,
      userId: input.userId
    });

    await recordAudit(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: "INSTALLMENT_RENEGOTIATED",
      entity: "Installment",
      entityId: installment.id,
      description: `Parcela ${installment.number} do contrato ${installment.contract.code} renegociada.`,
      before: {
        dueDate: installment.dueDate.toISOString(),
        finalAmount: installment.finalAmount.toString(),
        status: installment.status
      },
      after: {
        dueDate: updated.dueDate.toISOString(),
        finalAmount: updated.finalAmount.toString(),
        status: updated.status,
        reason
      }
    });

    await recordContractEvent(tx, {
      companyId: input.companyId,
      contractId: input.contractId,
      userId: input.userId,
      type: "INSTALLMENT_RENEGOTIATED",
      title: "Parcela renegociada",
      description: `Parcela ${installment.number} renegociada por ${reason}.`,
      metadata: {
        installmentId: installment.id,
        installmentNumber: installment.number,
        previousDueDate: installment.dueDate.toISOString(),
        dueDate: updated.dueDate.toISOString(),
        previousAmount: installment.finalAmount.toString(),
        finalAmount: updated.finalAmount.toString(),
        discountAmount: input.discountAmount,
        penaltyAmount: input.penaltyAmount,
        interestAmount: input.interestAmount
      }
    });

    return updated;
  });
}
