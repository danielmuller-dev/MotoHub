export type InstallmentLike = {
  finalAmount: number;
  paidAmount: number;
  status: "PENDING" | "PAID" | "OVERDUE" | "PARTIALLY_PAID" | "CANCELLED";
};

export function assertTenantIsolation(userCompanyId: string | null, entityCompanyId: string) {
  if (!userCompanyId || userCompanyId !== entityCompanyId) {
    throw new Error("Acesso negado para dados de outra empresa.");
  }
}

export function assertCustomerOwnData(userCustomerId: string | null, entityCustomerId: string) {
  if (!userCustomerId || userCustomerId !== entityCustomerId) {
    throw new Error("Cliente pode acessar apenas seus proprios dados.");
  }
}

export function canCreateActiveContractForMotorcycle(activeContractsForMotorcycle: number) {
  return activeContractsForMotorcycle === 0;
}

export function applyPaymentToInstallment(input: {
  finalAmount: number;
  paidAmount: number;
  paymentAmount: number;
}) {
  if (input.paymentAmount <= 0) {
    throw new Error("Pagamento deve ser maior que zero.");
  }

  const balance = Number((input.finalAmount - input.paidAmount).toFixed(2));
  if (input.paymentAmount > balance) {
    throw new Error("Pagamento maior que o saldo da parcela.");
  }

  const nextPaidAmount = Number((input.paidAmount + input.paymentAmount).toFixed(2));
  const nextBalance = Number((input.finalAmount - nextPaidAmount).toFixed(2));

  return {
    paidAmount: nextPaidAmount,
    balance: Math.max(nextBalance, 0),
    status: nextBalance <= 0 ? "PAID" as const : "PARTIALLY_PAID" as const
  };
}

export function isContractFullyPaid(installments: InstallmentLike[]) {
  return installments.every(
    (installment) =>
      installment.status === "PAID" ||
      Number(installment.paidAmount.toFixed(2)) >= Number(installment.finalAmount.toFixed(2))
  );
}

export function motorcycleStatusAfterContractCompletion(contractType: "RENTAL" | "RENT_TO_OWN") {
  return contractType === "RENT_TO_OWN" ? "SOLD" : "AVAILABLE";
}
