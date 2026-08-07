type PaymentAmountLike = {
  amountPaid: { toNumber(): number };
  status?: string;
};

export function sumConfirmedPayments(payments: PaymentAmountLike[]) {
  return payments.reduce(
    (sum, payment) =>
      payment.status === "REVERSED" ? sum : sum + payment.amountPaid.toNumber(),
    0
  );
}

export function isConfirmedPayment(payment: { status?: string }) {
  return payment.status !== "REVERSED";
}
