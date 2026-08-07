export type InspectionTypeLike = "DELIVERY" | "PERIODIC" | "RETURN" | "EXTRAORDINARY";
export type InspectionStatusLike = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type InspectionConditionLike =
  | "OK"
  | "DAMAGED"
  | "MISSING"
  | "NEEDS_MAINTENANCE"
  | "NOT_APPLICABLE"
  | "NOT_CHECKED";
export type InspectionRoleLike = "SUPER_ADMIN" | "COMPANY_ADMIN" | "EMPLOYEE" | "CUSTOMER";
export type InspectionOperation =
  | "CREATE"
  | "EDIT_DRAFT"
  | "COMPLETE"
  | "CANCEL"
  | "ADMIN_CORRECTION"
  | "GENERATE_CHARGE"
  | "CREATE_MAINTENANCE"
  | "VIEW";

export function inspectionRequiresContract(type: InspectionTypeLike) {
  return type === "DELIVERY" || type === "RETURN";
}

export function canRoleExecuteInspectionOperation(
  role: InspectionRoleLike,
  operation: InspectionOperation
) {
  if (operation === "VIEW") {
    return true;
  }

  if (role === "COMPANY_ADMIN") {
    return true;
  }

  if (role === "EMPLOYEE") {
    return ["CREATE", "EDIT_DRAFT", "COMPLETE"].includes(operation);
  }

  return false;
}

export function canEditInspection(status: InspectionStatusLike, role: InspectionRoleLike) {
  if (status === "DRAFT" || status === "IN_PROGRESS") {
    return canRoleExecuteInspectionOperation(role, "EDIT_DRAFT");
  }

  return role === "COMPANY_ADMIN" && status === "COMPLETED";
}

export function canCompleteInspection(status: InspectionStatusLike, role: InspectionRoleLike) {
  return (
    ["DRAFT", "IN_PROGRESS"].includes(status) &&
    canRoleExecuteInspectionOperation(role, "COMPLETE")
  );
}

export function canCancelInspection(status: InspectionStatusLike, role: InspectionRoleLike) {
  if (role !== "COMPANY_ADMIN") {
    return false;
  }

  return status !== "CANCELLED";
}

export function calculateMileage(input: {
  initialMileage: number;
  finalMileage: number;
  mileageLimit?: number | null;
  excessKmPrice?: number | null;
  allowLowerFinalMileage?: boolean;
}) {
  if (input.finalMileage < input.initialMileage && !input.allowLowerFinalMileage) {
    throw new Error("Quilometragem final nao pode ser menor que a inicial.");
  }

  const mileageDriven = Math.max(input.finalMileage - input.initialMileage, 0);
  const mileageExcess = input.mileageLimit
    ? Math.max(mileageDriven - input.mileageLimit, 0)
    : 0;
  const mileageExcessCharge = Number(
    (mileageExcess * (input.excessKmPrice ?? 0)).toFixed(2)
  );

  return {
    mileageDriven,
    mileageExcess,
    mileageExcessCharge
  };
}

export function compareInspectionItems(
  deliveryItems: Array<{ itemKey: string; condition: InspectionConditionLike; notes?: string | null }>,
  returnItems: Array<{ itemKey: string; condition: InspectionConditionLike; notes?: string | null }>
) {
  const deliveryByKey = new Map(deliveryItems.map((item) => [item.itemKey, item]));

  return returnItems.map((returnItem) => {
    const deliveryItem = deliveryByKey.get(returnItem.itemKey);
    const changed = deliveryItem?.condition !== returnItem.condition;
    const newDamage =
      changed &&
      ["DAMAGED", "MISSING", "NEEDS_MAINTENANCE"].includes(returnItem.condition) &&
      deliveryItem?.condition !== returnItem.condition;

    return {
      itemKey: returnItem.itemKey,
      deliveryCondition: deliveryItem?.condition ?? "NOT_CHECKED",
      returnCondition: returnItem.condition,
      changed,
      newDamage,
      deliveryNotes: deliveryItem?.notes ?? null,
      returnNotes: returnItem.notes ?? null
    };
  });
}

export function deliveryInspectionAllowed(input: {
  contractStatus: string;
  existingCompletedDeliveries: number;
  adminOverride?: boolean;
}) {
  if (!["DRAFT", "ACTIVE", "OVERDUE"].includes(input.contractStatus)) {
    return false;
  }

  return input.existingCompletedDeliveries === 0 || Boolean(input.adminOverride);
}

export function returnInspectionAllowed(input: {
  contractStatus: string;
  hasCompletedDelivery: boolean;
}) {
  return (
    ["ACTIVE", "OVERDUE", "SUSPENDED", "TERMINATED"].includes(input.contractStatus) &&
    input.hasCompletedDelivery
  );
}
