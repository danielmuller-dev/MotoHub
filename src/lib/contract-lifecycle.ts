export type ContractLifecycleStatus =
  | "DRAFT"
  | "ACTIVE"
  | "OVERDUE"
  | "SUSPENDED"
  | "COMPLETED"
  | "CANCELLED"
  | "TERMINATED";

export type InstallmentLifecycleStatus =
  | "PENDING"
  | "PAID"
  | "OVERDUE"
  | "PARTIALLY_PAID"
  | "CANCELLED";

export type ContractLifecycleAction =
  | "EDIT"
  | "REGISTER_PAYMENT"
  | "VIEW_CUSTOMER"
  | "VIEW_MOTORCYCLE"
  | "PRINT"
  | "SUSPEND"
  | "RESUME"
  | "TERMINATE"
  | "CANCEL"
  | "VIEW_HISTORY";

export type ContractLifecycleOperation =
  | ContractLifecycleAction
  | "RENEGOTIATE_INSTALLMENT"
  | "REVERSE_PAYMENT";

export type ContractLifecycleRole =
  | "SUPER_ADMIN"
  | "COMPANY_ADMIN"
  | "EMPLOYEE"
  | "CUSTOMER";

export const finalContractStatuses: ContractLifecycleStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "TERMINATED"
];

export const openInstallmentStatuses: InstallmentLifecycleStatus[] = [
  "PENDING",
  "OVERDUE",
  "PARTIALLY_PAID"
];

export function isFinalContractStatus(status: ContractLifecycleStatus) {
  return finalContractStatuses.includes(status);
}

export function canMutateContract(status: ContractLifecycleStatus) {
  return !isFinalContractStatus(status) && status !== "SUSPENDED";
}

export function canRoleExecuteContractOperation(
  role: ContractLifecycleRole,
  operation: ContractLifecycleOperation
) {
  if (["VIEW_CUSTOMER", "VIEW_MOTORCYCLE", "PRINT", "VIEW_HISTORY"].includes(operation)) {
    return true;
  }

  if (role === "COMPANY_ADMIN") {
    return true;
  }

  if (role === "EMPLOYEE") {
    return operation === "REGISTER_PAYMENT" || operation === "RENEGOTIATE_INSTALLMENT";
  }

  return false;
}

export function canRenegotiateInstallment(input: {
  contractStatus: ContractLifecycleStatus;
  installmentStatus: InstallmentLifecycleStatus;
}) {
  return (
    canMutateContract(input.contractStatus) &&
    openInstallmentStatuses.includes(input.installmentStatus)
  );
}

export function shouldCancelFuturePendingInstallment(input: {
  cancelFutureInstallments: boolean;
  installmentStatus: InstallmentLifecycleStatus;
  dueDate: Date;
  actionDate: Date;
}) {
  return (
    input.cancelFutureInstallments &&
    input.installmentStatus === "PENDING" &&
    input.dueDate.getTime() > input.actionDate.getTime()
  );
}

export function getContractActionsForStatus(status: ContractLifecycleStatus): ContractLifecycleAction[] {
  if (status === "ACTIVE" || status === "OVERDUE" || status === "DRAFT") {
    return [
      "EDIT",
      "REGISTER_PAYMENT",
      "VIEW_CUSTOMER",
      "VIEW_MOTORCYCLE",
      "PRINT",
      "SUSPEND",
      "TERMINATE",
      "CANCEL"
    ] satisfies ContractLifecycleAction[];
  }

  if (status === "SUSPENDED") {
    return [
      "VIEW_CUSTOMER",
      "VIEW_MOTORCYCLE",
      "PRINT",
      "RESUME",
      "TERMINATE",
      "CANCEL"
    ] satisfies ContractLifecycleAction[];
  }

  return [
    "VIEW_HISTORY",
    "PRINT",
    "VIEW_CUSTOMER",
    "VIEW_MOTORCYCLE"
  ] satisfies ContractLifecycleAction[];
}

export function statusAfterResume(input: {
  hasOverdueInstallments: boolean;
  hasOpenInstallments: boolean;
}) {
  if (!input.hasOpenInstallments) {
    return "COMPLETED" as const;
  }

  return input.hasOverdueInstallments ? "OVERDUE" as const : "ACTIVE" as const;
}

export function installmentStatusFromBalance(input: {
  dueDate: Date;
  paidAmount: number;
  finalAmount: number;
  today: Date;
}) {
  const balance = Number((input.finalAmount - input.paidAmount).toFixed(2));

  if (balance <= 0) {
    return "PAID" as const;
  }

  if (input.paidAmount > 0) {
    return "PARTIALLY_PAID" as const;
  }

  return input.dueDate.getTime() < input.today.getTime()
    ? "OVERDUE" as const
    : "PENDING" as const;
}

export function calculateRenegotiatedInstallment(input: {
  originalAmount: number;
  paidAmount: number;
  discountAmount: number;
  penaltyAmount: number;
  interestAmount: number;
}) {
  if (input.discountAmount < 0 || input.penaltyAmount < 0 || input.interestAmount < 0) {
    throw new Error("Desconto, multa e juros nao podem ser negativos.");
  }

  const finalAmount = Number(
    (
      input.originalAmount -
      input.discountAmount +
      input.penaltyAmount +
      input.interestAmount
    ).toFixed(2)
  );

  if (finalAmount < 0) {
    throw new Error("Novo valor da parcela nao pode ser negativo.");
  }

  if (finalAmount < input.paidAmount) {
    throw new Error("Novo valor nao pode ser menor que o valor ja pago.");
  }

  return {
    finalAmount,
    balance: Number((finalAmount - input.paidAmount).toFixed(2))
  };
}
