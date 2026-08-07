import { Prisma } from "@prisma/client";
import {
  installmentStatusFromBalance,
  isFinalContractStatus
} from "@/lib/contract-lifecycle";
import { normalizeDateOnly } from "@/lib/due-dates";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit";
import { refreshContractFinancialState } from "@/services/contracts";
import { recordContractEvent } from "@/services/contract-events";
import { installmentBalance } from "@/services/installments";

export type RegisterPaymentInput = {
  companyId: string;
  installmentId: string;
  amountPaid: number;
  paymentDate: Date;
  method: "PIX" | "CASH" | "TRANSFER" | "CARD" | "BOLETO" | "OTHER";
  reference?: string | null;
  note?: string | null;
  receiptUrl?: string | null;
  registeredByUserId: string;
};

export type ReversePaymentInput = {
  companyId: string;
  paymentId: string;
  reversedByUserId: string;
  reason: string;
  notes: string;
};

function createPaymentCode() {
  return `PG-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function requireText(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} obrigatorio.`);
  }
  return trimmed;
}

export async function registerPayment(input: RegisterPaymentInput) {
  if (input.amountPaid <= 0) {
    throw new Error("Pagamento deve ser maior que zero.");
  }

  return prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findFirst({
      where: {
        id: input.installmentId,
        companyId: input.companyId
      },
      include: {
        contract: true
      }
    });

    if (!installment) {
      throw new Error("Parcela nao encontrada para esta empresa.");
    }

    if (isFinalContractStatus(installment.contract.status) || installment.contract.status === "SUSPENDED") {
      throw new Error("Este contrato nao aceita novos pagamentos.");
    }

    if (installment.status === "CANCELLED" || installment.status === "PAID") {
      throw new Error("Esta parcela nao aceita novo pagamento.");
    }

    const amount = new Prisma.Decimal(input.amountPaid).toDecimalPlaces(2);
    const balance = installmentBalance(installment);

    if (amount.gt(balance)) {
      throw new Error("Pagamento maior que o saldo da parcela.");
    }

    const nextPaidAmount = installment.paidAmount.plus(amount).toDecimalPlaces(2);
    const paidInFull = nextPaidAmount.greaterThanOrEqualTo(installment.finalAmount);

    const updatedInstallment = await tx.installment.update({
      where: { id: installment.id },
      data: {
        paidAmount: nextPaidAmount,
        paymentDate: paidInFull ? input.paymentDate : null,
        status: paidInFull ? "PAID" : "PARTIALLY_PAID"
      }
    });

    const payment = await tx.payment.create({
      data: {
        companyId: input.companyId,
        customerId: installment.contract.customerId,
        contractId: installment.contractId,
        installmentId: installment.id,
        registeredByUserId: input.registeredByUserId,
        code: createPaymentCode(),
        amountPaid: amount,
        paymentDate: input.paymentDate,
        method: input.method,
        reference: input.reference,
        note: input.note,
        receiptUrl: input.receiptUrl
      }
    });

    await refreshContractFinancialState(tx, {
      companyId: input.companyId,
      contractId: installment.contractId,
      userId: input.registeredByUserId,
      today: input.paymentDate
    });

    await recordAudit(tx, {
      companyId: input.companyId,
      userId: input.registeredByUserId,
      action: "PAYMENT_REGISTERED",
      entity: "Payment",
      entityId: payment.id,
      description: `Pagamento ${payment.code} registrado na parcela ${installment.number}.`,
      before: {
        installmentStatus: installment.status,
        paidAmount: installment.paidAmount.toString()
      },
      after: {
        installmentStatus: updatedInstallment.status,
        paidAmount: updatedInstallment.paidAmount.toString()
      }
    });

    await recordContractEvent(tx, {
      companyId: input.companyId,
      contractId: installment.contractId,
      userId: input.registeredByUserId,
      type: paidInFull ? "PAYMENT_REGISTERED" : "PAYMENT_PARTIAL",
      title: paidInFull ? "Pagamento registrado" : "Pagamento parcial registrado",
      description: `Pagamento ${payment.code} de ${amount.toString()} registrado na parcela ${installment.number}.`,
      metadata: {
        paymentId: payment.id,
        installmentId: installment.id,
        installmentNumber: installment.number,
        amountPaid: amount.toString(),
        paymentDate: input.paymentDate.toISOString(),
        installmentStatus: updatedInstallment.status
      }
    });

    return payment;
  });
}

export async function reversePayment(input: ReversePaymentInput) {
  const reason = requireText(input.reason, "Motivo");
  const notes = requireText(input.notes, "Observacao");

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: {
        id: input.paymentId,
        companyId: input.companyId
      },
      include: {
        installment: true,
        contract: true
      }
    });

    if (!payment) {
      throw new Error("Pagamento nao encontrado para esta empresa.");
    }

    if (payment.status === "REVERSED") {
      throw new Error("Pagamento ja foi estornado.");
    }

    const reversed = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "REVERSED",
        reversedAt: new Date(),
        reversedByUserId: input.reversedByUserId,
        reversalReason: reason,
        reversalNotes: notes
      }
    });

    if (payment.installment) {
      let nextPaidAmount = payment.installment.paidAmount
        .minus(payment.amountPaid)
        .toDecimalPlaces(2);

      if (nextPaidAmount.lt(0)) {
        nextPaidAmount = new Prisma.Decimal(0);
      }

      const today = normalizeDateOnly(new Date());
      const nextStatus = installmentStatusFromBalance({
        dueDate: payment.installment.dueDate,
        paidAmount: nextPaidAmount.toNumber(),
        finalAmount: payment.installment.finalAmount.toNumber(),
        today
      });

      await tx.installment.update({
        where: { id: payment.installment.id },
        data: {
          paidAmount: nextPaidAmount,
          paymentDate: nextStatus === "PAID" ? payment.installment.paymentDate : null,
          status: nextStatus
        }
      });
    }

    await refreshContractFinancialState(tx, {
      companyId: input.companyId,
      contractId: payment.contractId,
      userId: input.reversedByUserId
    });

    await recordAudit(tx, {
      companyId: input.companyId,
      userId: input.reversedByUserId,
      action: "PAYMENT_REVERSED",
      entity: "Payment",
      entityId: payment.id,
      description: `Pagamento ${payment.code} estornado.`,
      before: {
        status: payment.status,
        amountPaid: payment.amountPaid.toString()
      },
      after: {
        status: reversed.status,
        reason
      }
    });

    await recordContractEvent(tx, {
      companyId: input.companyId,
      contractId: payment.contractId,
      userId: input.reversedByUserId,
      type: "PAYMENT_REVERSED",
      title: "Pagamento estornado",
      description: `Pagamento ${payment.code} estornado por ${reason}.`,
      metadata: {
        paymentId: payment.id,
        installmentId: payment.installmentId,
        amountPaid: payment.amountPaid.toString(),
        reason,
        contractWasCompleted: payment.contract.status === "COMPLETED"
      }
    });

    return reversed;
  });
}
