import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit";
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

function createPaymentCode() {
  return `PG-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
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

    const openInstallments = await tx.installment.count({
      where: {
        contractId: installment.contractId,
        status: {
          not: "PAID"
        }
      }
    });

    if (openInstallments === 0) {
      await tx.contract.update({
        where: { id: installment.contractId },
        data: {
          status: "COMPLETED",
          completedAt: new Date()
        }
      });

      await tx.motorcycle.update({
        where: { id: installment.contract.motorcycleId },
        data:
          installment.contract.type === "RENT_TO_OWN"
            ? { status: "SOLD" }
            : { status: "AVAILABLE", currentCustomerId: null }
      });
    }

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

    return payment;
  });
}
