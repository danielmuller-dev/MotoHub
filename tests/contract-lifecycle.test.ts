import { describe, expect, it } from "vitest";
import {
  calculateRenegotiatedInstallment,
  canRenegotiateInstallment,
  canRoleExecuteContractOperation,
  getContractActionsForStatus,
  installmentStatusFromBalance,
  shouldCancelFuturePendingInstallment,
  statusAfterResume
} from "../src/lib/contract-lifecycle";
import { sumConfirmedPayments } from "../src/lib/payment-totals";

const amount = (value: number) => ({ toNumber: () => value });

describe("contract lifecycle rules", () => {
  it("define acoes rapidas para contrato ativo", () => {
    expect(getContractActionsForStatus("ACTIVE")).toEqual(
      expect.arrayContaining([
        "EDIT",
        "REGISTER_PAYMENT",
        "SUSPEND",
        "TERMINATE",
        "CANCEL",
        "PRINT"
      ])
    );
  });

  it("define acoes de retomada para contrato suspenso", () => {
    const actions = getContractActionsForStatus("SUSPENDED");

    expect(actions).toContain("RESUME");
    expect(actions).toContain("TERMINATE");
    expect(actions).not.toContain("REGISTER_PAYMENT");
  });

  it("bloqueia alteracoes normais em contrato finalizado", () => {
    const actions = getContractActionsForStatus("COMPLETED");

    expect(actions).toEqual(["VIEW_HISTORY", "PRINT", "VIEW_CUSTOMER", "VIEW_MOTORCYCLE"]);
  });

  it("bloqueia acoes sensiveis para cliente e superadmin", () => {
    expect(canRoleExecuteContractOperation("CUSTOMER", "CANCEL")).toBe(false);
    expect(canRoleExecuteContractOperation("CUSTOMER", "SUSPEND")).toBe(false);
    expect(canRoleExecuteContractOperation("CUSTOMER", "RENEGOTIATE_INSTALLMENT")).toBe(false);
    expect(canRoleExecuteContractOperation("SUPER_ADMIN", "CANCEL")).toBe(false);
    expect(canRoleExecuteContractOperation("SUPER_ADMIN", "PRINT")).toBe(true);
  });

  it("permite funcionario registrar pagamento e renegociar, mas nao estornar", () => {
    expect(canRoleExecuteContractOperation("EMPLOYEE", "REGISTER_PAYMENT")).toBe(true);
    expect(canRoleExecuteContractOperation("EMPLOYEE", "RENEGOTIATE_INSTALLMENT")).toBe(true);
    expect(canRoleExecuteContractOperation("EMPLOYEE", "REVERSE_PAYMENT")).toBe(false);
  });

  it("cancela somente parcelas futuras pendentes", () => {
    const actionDate = new Date("2026-08-06T12:00:00.000Z");

    expect(
      shouldCancelFuturePendingInstallment({
        cancelFutureInstallments: true,
        installmentStatus: "PENDING",
        dueDate: new Date("2026-08-13T12:00:00.000Z"),
        actionDate
      })
    ).toBe(true);
    expect(
      shouldCancelFuturePendingInstallment({
        cancelFutureInstallments: true,
        installmentStatus: "OVERDUE",
        dueDate: new Date("2026-08-01T12:00:00.000Z"),
        actionDate
      })
    ).toBe(false);
    expect(
      shouldCancelFuturePendingInstallment({
        cancelFutureInstallments: true,
        installmentStatus: "PAID",
        dueDate: new Date("2026-08-13T12:00:00.000Z"),
        actionDate
      })
    ).toBe(false);
  });

  it("mantem pagamentos antigos confirmados e ignora estornados no total", () => {
    expect(
      sumConfirmedPayments([
        { amountPaid: amount(370), status: "CONFIRMED" },
        { amountPaid: amount(120), status: "REVERSED" },
        { amountPaid: amount(250), status: "CONFIRMED" }
      ])
    ).toBe(620);
  });

  it("reabre parcela apos estorno conforme saldo e vencimento", () => {
    const today = new Date("2026-08-06T12:00:00.000Z");

    expect(
      installmentStatusFromBalance({
        dueDate: new Date("2026-08-13T12:00:00.000Z"),
        paidAmount: 0,
        finalAmount: 370,
        today
      })
    ).toBe("PENDING");
    expect(
      installmentStatusFromBalance({
        dueDate: new Date("2026-08-01T12:00:00.000Z"),
        paidAmount: 0,
        finalAmount: 370,
        today
      })
    ).toBe("OVERDUE");
    expect(
      installmentStatusFromBalance({
        dueDate: new Date("2026-08-01T12:00:00.000Z"),
        paidAmount: 120,
        finalAmount: 370,
        today
      })
    ).toBe("PARTIALLY_PAID");
  });

  it("recalcula status do contrato ao retomar", () => {
    expect(statusAfterResume({ hasOpenInstallments: true, hasOverdueInstallments: false })).toBe("ACTIVE");
    expect(statusAfterResume({ hasOpenInstallments: true, hasOverdueInstallments: true })).toBe("OVERDUE");
    expect(statusAfterResume({ hasOpenInstallments: false, hasOverdueInstallments: false })).toBe("COMPLETED");
  });

  it("renegocia vencimento e saldo parcial sem apagar valor original", () => {
    expect(
      calculateRenegotiatedInstallment({
        originalAmount: 370,
        paidAmount: 120,
        discountAmount: 20,
        penaltyAmount: 10,
        interestAmount: 5
      })
    ).toEqual({
      finalAmount: 365,
      balance: 245
    });
  });

  it("bloqueia renegociacao de parcela paga ou contrato finalizado", () => {
    expect(canRenegotiateInstallment({ contractStatus: "ACTIVE", installmentStatus: "PAID" })).toBe(false);
    expect(canRenegotiateInstallment({ contractStatus: "COMPLETED", installmentStatus: "PENDING" })).toBe(false);
    expect(canRenegotiateInstallment({ contractStatus: "SUSPENDED", installmentStatus: "OVERDUE" })).toBe(false);
    expect(canRenegotiateInstallment({ contractStatus: "OVERDUE", installmentStatus: "PARTIALLY_PAID" })).toBe(true);
  });

  it("nao permite valor renegociado negativo ou menor que o ja pago", () => {
    expect(() =>
      calculateRenegotiatedInstallment({
        originalAmount: 370,
        paidAmount: 0,
        discountAmount: 371,
        penaltyAmount: 0,
        interestAmount: 0
      })
    ).toThrow("negativo");

    expect(() =>
      calculateRenegotiatedInstallment({
        originalAmount: 370,
        paidAmount: 300,
        discountAmount: 100,
        penaltyAmount: 0,
        interestAmount: 0
      })
    ).toThrow("menor que o valor ja pago");
  });
});
