import { describe, expect, it } from "vitest";
import {
  calculateMileage,
  canCancelInspection,
  canCompleteInspection,
  canEditInspection,
  canRoleExecuteInspectionOperation,
  compareInspectionItems,
  deliveryInspectionAllowed,
  inspectionRequiresContract,
  returnInspectionAllowed
} from "../src/lib/inspection-rules";

describe("inspection rules", () => {
  it("exige contrato para entrega e devolucao", () => {
    expect(inspectionRequiresContract("DELIVERY")).toBe(true);
    expect(inspectionRequiresContract("RETURN")).toBe(true);
    expect(inspectionRequiresContract("PERIODIC")).toBe(false);
    expect(inspectionRequiresContract("EXTRAORDINARY")).toBe(false);
  });

  it("permite primeira entrega e bloqueia segunda entrega concluida", () => {
    expect(
      deliveryInspectionAllowed({
        contractStatus: "ACTIVE",
        existingCompletedDeliveries: 0
      })
    ).toBe(true);

    expect(
      deliveryInspectionAllowed({
        contractStatus: "ACTIVE",
        existingCompletedDeliveries: 1
      })
    ).toBe(false);
  });

  it("permite override administrativo para segunda entrega", () => {
    expect(
      deliveryInspectionAllowed({
        contractStatus: "ACTIVE",
        existingCompletedDeliveries: 1,
        adminOverride: true
      })
    ).toBe(true);
  });

  it("bloqueia entrega em contrato finalizado ou cancelado", () => {
    expect(deliveryInspectionAllowed({ contractStatus: "COMPLETED", existingCompletedDeliveries: 0 })).toBe(false);
    expect(deliveryInspectionAllowed({ contractStatus: "CANCELLED", existingCompletedDeliveries: 0 })).toBe(false);
  });

  it("devolucao exige entrega concluida e contrato elegivel", () => {
    expect(returnInspectionAllowed({ contractStatus: "ACTIVE", hasCompletedDelivery: true })).toBe(true);
    expect(returnInspectionAllowed({ contractStatus: "SUSPENDED", hasCompletedDelivery: true })).toBe(true);
    expect(returnInspectionAllowed({ contractStatus: "ACTIVE", hasCompletedDelivery: false })).toBe(false);
    expect(returnInspectionAllowed({ contractStatus: "CANCELLED", hasCompletedDelivery: true })).toBe(false);
  });

  it("calcula km rodado, excesso e cobranca", () => {
    expect(
      calculateMileage({
        initialMileage: 1000,
        finalMileage: 1600,
        mileageLimit: 500,
        excessKmPrice: 0.85
      })
    ).toEqual({
      mileageDriven: 600,
      mileageExcess: 100,
      mileageExcessCharge: 85
    });
  });

  it("bloqueia quilometragem final menor que inicial", () => {
    expect(() =>
      calculateMileage({
        initialMileage: 1600,
        finalMileage: 1200,
        mileageLimit: 500,
        excessKmPrice: 1
      })
    ).toThrow("Quilometragem final");
  });

  it("compara entrega e devolucao marcando nova avaria", () => {
    expect(
      compareInspectionItems(
        [
          { itemKey: "front_tire", condition: "OK", notes: null },
          { itemKey: "helmet", condition: "OK", notes: null }
        ],
        [
          { itemKey: "front_tire", condition: "DAMAGED", notes: "Corte lateral" },
          { itemKey: "helmet", condition: "OK", notes: null }
        ]
      )
    ).toEqual([
      {
        itemKey: "front_tire",
        deliveryCondition: "OK",
        returnCondition: "DAMAGED",
        changed: true,
        newDamage: true,
        deliveryNotes: null,
        returnNotes: "Corte lateral"
      },
      {
        itemKey: "helmet",
        deliveryCondition: "OK",
        returnCondition: "OK",
        changed: false,
        newDamage: false,
        deliveryNotes: null,
        returnNotes: null
      }
    ]);
  });

  it("respeita permissoes por perfil", () => {
    expect(canRoleExecuteInspectionOperation("COMPANY_ADMIN", "CANCEL")).toBe(true);
    expect(canRoleExecuteInspectionOperation("EMPLOYEE", "CREATE")).toBe(true);
    expect(canRoleExecuteInspectionOperation("EMPLOYEE", "CANCEL")).toBe(false);
    expect(canRoleExecuteInspectionOperation("CUSTOMER", "VIEW")).toBe(true);
    expect(canRoleExecuteInspectionOperation("CUSTOMER", "CREATE")).toBe(false);
  });

  it("controla edicao, conclusao e cancelamento por status", () => {
    expect(canEditInspection("DRAFT", "EMPLOYEE")).toBe(true);
    expect(canEditInspection("COMPLETED", "EMPLOYEE")).toBe(false);
    expect(canEditInspection("COMPLETED", "COMPANY_ADMIN")).toBe(true);
    expect(canCompleteInspection("DRAFT", "EMPLOYEE")).toBe(true);
    expect(canCompleteInspection("CANCELLED", "COMPANY_ADMIN")).toBe(false);
    expect(canCancelInspection("COMPLETED", "COMPANY_ADMIN")).toBe(true);
    expect(canCancelInspection("COMPLETED", "EMPLOYEE")).toBe(false);
  });
});
