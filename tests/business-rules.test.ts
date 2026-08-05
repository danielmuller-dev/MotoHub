import { describe, expect, it } from "vitest";
import {
  applyPaymentToInstallment,
  assertCustomerOwnData,
  assertTenantIsolation,
  canCreateActiveContractForMotorcycle,
  isContractFullyPaid,
  motorcycleStatusAfterContractCompletion
} from "../src/lib/business-rules";

describe("business rules", () => {
  it("bloqueia acesso entre empresas", () => {
    expect(() => assertTenantIsolation("empresa-a", "empresa-b")).toThrow(
      "Acesso negado"
    );
    expect(() => assertTenantIsolation("empresa-a", "empresa-a")).not.toThrow();
  });

  it("bloqueia cliente acessando dados de outro cliente", () => {
    expect(() => assertCustomerOwnData("cliente-1", "cliente-2")).toThrow(
      "Cliente pode acessar"
    );
    expect(() => assertCustomerOwnData("cliente-1", "cliente-1")).not.toThrow();
  });

  it("registra pagamento parcial", () => {
    expect(
      applyPaymentToInstallment({
        finalAmount: 370,
        paidAmount: 0,
        paymentAmount: 120
      })
    ).toEqual({
      paidAmount: 120,
      balance: 250,
      status: "PARTIALLY_PAID"
    });
  });

  it("registra pagamento integral", () => {
    expect(
      applyPaymentToInstallment({
        finalAmount: 370,
        paidAmount: 120,
        paymentAmount: 250
      })
    ).toEqual({
      paidAmount: 370,
      balance: 0,
      status: "PAID"
    });
  });

  it("nao permite pagamento negativo ou acima do saldo", () => {
    expect(() =>
      applyPaymentToInstallment({ finalAmount: 370, paidAmount: 0, paymentAmount: -1 })
    ).toThrow("maior que zero");
    expect(() =>
      applyPaymentToInstallment({ finalAmount: 370, paidAmount: 100, paymentAmount: 300 })
    ).toThrow("maior que o saldo");
  });

  it("conclui contrato quando todas as parcelas estao pagas", () => {
    expect(
      isContractFullyPaid([
        { finalAmount: 370, paidAmount: 370, status: "PAID" },
        { finalAmount: 370, paidAmount: 370, status: "PAID" }
      ])
    ).toBe(true);
  });

  it("bloqueia dois contratos ativos para a mesma moto", () => {
    expect(canCreateActiveContractForMotorcycle(0)).toBe(true);
    expect(canCreateActiveContractForMotorcycle(1)).toBe(false);
  });

  it("define situacao da moto ao concluir contrato", () => {
    expect(motorcycleStatusAfterContractCompletion("RENT_TO_OWN")).toBe("SOLD");
    expect(motorcycleStatusAfterContractCompletion("RENTAL")).toBe("AVAILABLE");
  });
});
