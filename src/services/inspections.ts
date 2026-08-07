import {
  DamageResponsibleParty,
  DamageSeverity,
  DamageStatus,
  FuelLevel,
  InspectionItemCondition,
  InspectionPhotoType,
  InspectionSignatureType,
  InspectionType,
  MotorcycleStatus,
  Prisma
} from "@prisma/client";
import { randomUUID } from "crypto";
import { normalizeDateOnly } from "@/lib/due-dates";
import { defaultInspectionAccessories, inspectionChecklist } from "@/lib/inspection-checklist";
import {
  calculateMileage,
  compareInspectionItems,
  deliveryInspectionAllowed,
  returnInspectionAllowed
} from "@/lib/inspection-rules";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/services/audit";
import { recordContractEvent } from "@/services/contract-events";
import { dataUrlToFile, uploadInspectionImage, type StoredFile } from "@/services/storage";

export type InspectionItemInput = {
  itemKey: string;
  condition: InspectionItemCondition;
  notes?: string | null;
  estimatedCost: number;
  preExisting: boolean;
  newDamage: boolean;
  chargeCustomer: boolean;
};

export type InspectionAccessoryInput = {
  name: string;
  delivered: boolean;
  returned: boolean;
  condition: InspectionItemCondition;
  notes?: string | null;
  replacementCost: number;
  chargeCustomer: boolean;
};

export type InspectionPhotoInput = {
  type: InspectionPhotoType;
  file: File;
  caption?: string | null;
  sortOrder?: number;
};

export type InspectionSignatureInput = {
  type: InspectionSignatureType;
  dataUrl: string;
  signedByName: string;
};

export type UpsertInspectionInput = {
  inspectionId?: string | null;
  companyId: string;
  userId: string;
  contractId?: string | null;
  motorcycleId: string;
  customerId?: string | null;
  type: InspectionType;
  submitIntent: "DRAFT" | "COMPLETE";
  inspectionDate: Date;
  mileage: number;
  fuelLevel: FuelLevel;
  generalCondition?: string | null;
  generalDamages?: string | null;
  location?: string | null;
  notes?: string | null;
  administrativeNotes?: string | null;
  customerPresent: boolean;
  customerRefusedSignature: boolean;
  refusalReason?: string | null;
  destinationStatus?: MotorcycleStatus | null;
  mileageExcessKmPrice: number;
  createMaintenance: boolean;
  items: InspectionItemInput[];
  accessories: InspectionAccessoryInput[];
  photos: InspectionPhotoInput[];
  signatures: InspectionSignatureInput[];
};

async function generateInspectionCode(tx: Prisma.TransactionClient, companyId: string) {
  const year = new Date().getUTCFullYear();
  const count = await tx.inspection.count({ where: { companyId } });
  return `INS-${year}-${String(count + 1).padStart(6, "0")}`;
}

async function generateChargeCode(tx: Prisma.TransactionClient, companyId: string) {
  const year = new Date().getUTCFullYear();
  const count = await tx.additionalCharge.count({ where: { companyId } });
  return `COB-${year}-${String(count + 1).padStart(6, "0")}`;
}

function defaultItems(input: InspectionItemInput[]) {
  const byKey = new Map(input.map((item) => [item.itemKey, item]));

  return inspectionChecklist.map((source) => {
    const item = byKey.get(source.key);
    return {
      itemKey: source.key,
      category: source.category,
      itemLabel: source.label,
      condition: item?.condition ?? "NOT_CHECKED",
      notes: item?.notes,
      estimatedCost: new Prisma.Decimal(item?.estimatedCost ?? 0).toDecimalPlaces(2),
      preExisting: Boolean(item?.preExisting),
      newDamage: Boolean(item?.newDamage),
      chargeCustomer: Boolean(item?.chargeCustomer)
    };
  });
}

function defaultAccessories(input: InspectionAccessoryInput[]) {
  const byName = new Map(input.map((item) => [item.name, item]));

  return defaultInspectionAccessories.map((name) => {
    const accessory = byName.get(name);
    return {
      name,
      delivered: Boolean(accessory?.delivered),
      returned: Boolean(accessory?.returned),
      condition: accessory?.condition ?? "NOT_CHECKED",
      notes: accessory?.notes,
      replacementCost: new Prisma.Decimal(accessory?.replacementCost ?? 0).toDecimalPlaces(2),
      chargeCustomer: Boolean(accessory?.chargeCustomer)
    };
  });
}

async function uploadPhotos(input: {
  companyId: string;
  inspectionId: string;
  photos: InspectionPhotoInput[];
  signatures: InspectionSignatureInput[];
}) {
  const photos: Array<InspectionPhotoInput & { stored: StoredFile }> = [];
  const signatures: Array<InspectionSignatureInput & { stored: StoredFile }> = [];

  for (const [index, photo] of input.photos.entries()) {
    photos.push({
      ...photo,
      stored: await uploadInspectionImage({
        companyId: input.companyId,
        inspectionId: input.inspectionId,
        file: photo.file,
        folder: "photos",
        nameHint: `${index}-${photo.type}`
      })
    });
  }

  for (const signature of input.signatures) {
    const file = dataUrlToFile(signature.dataUrl, `${signature.type.toLowerCase()}-signature.png`);
    signatures.push({
      ...signature,
      stored: await uploadInspectionImage({
        companyId: input.companyId,
        inspectionId: input.inspectionId,
        file,
        folder: "signatures",
        nameHint: `${signature.type}-signature`
      })
    });
  }

  return { photos, signatures };
}

export async function upsertInspection(input: UpsertInspectionInput) {
  const inspectionId = input.inspectionId || randomUUID();
  const uploaded = await uploadPhotos({
    companyId: input.companyId,
    inspectionId,
    photos: input.photos,
    signatures: input.signatures
  });

  return prisma.$transaction(async (tx) => {
    const existing = input.inspectionId
      ? await tx.inspection.findFirst({
          where: { id: input.inspectionId, companyId: input.companyId },
          include: { items: true, accessories: true, photos: true, signatures: true }
        })
      : null;

    if (existing && !["DRAFT", "IN_PROGRESS"].includes(existing.status)) {
      throw new Error("Vistoria finalizada nao pode ser editada por este fluxo.");
    }

    const contract = input.contractId
      ? await tx.contract.findFirst({
          where: { id: input.contractId, companyId: input.companyId, deletedAt: null },
          include: { customer: true, motorcycle: true }
        })
      : null;

    if ((input.type === "DELIVERY" || input.type === "RETURN") && !contract) {
      throw new Error("Vistoria de entrega ou devolucao exige contrato valido.");
    }

    if (contract && contract.motorcycleId !== input.motorcycleId) {
      throw new Error("Moto informada nao pertence ao contrato.");
    }

    if (contract && input.customerId && contract.customerId !== input.customerId) {
      throw new Error("Cliente informado nao pertence ao contrato.");
    }

    const motorcycle = await tx.motorcycle.findFirst({
      where: { id: input.motorcycleId, companyId: input.companyId, deletedAt: null }
    });

    if (!motorcycle) {
      throw new Error("Moto nao encontrada para esta empresa.");
    }

    const customerId = (contract?.customerId ?? input.customerId) || null;
    const completed = input.submitIntent === "COMPLETE";

    if (completed && input.type === "DELIVERY" && contract) {
      const existingDeliveries = await tx.inspection.count({
        where: {
          companyId: input.companyId,
          contractId: contract.id,
          type: "DELIVERY",
          status: "COMPLETED",
          ...(existing ? { id: { not: existing.id } } : {})
        }
      });

      if (!deliveryInspectionAllowed({
        contractStatus: contract.status,
        existingCompletedDeliveries: existingDeliveries
      })) {
        throw new Error("Este contrato ja possui vistoria de entrega concluida ou nao aceita entrega.");
      }
    }

    const deliveryInspection = input.type === "RETURN" && contract
      ? await tx.inspection.findFirst({
          where: {
            companyId: input.companyId,
            contractId: contract.id,
            type: "DELIVERY",
            status: "COMPLETED"
          },
          include: { items: true }
        })
      : null;

    if (completed && input.type === "RETURN" && contract) {
      if (!returnInspectionAllowed({
        contractStatus: contract.status,
        hasCompletedDelivery: Boolean(deliveryInspection)
      })) {
        throw new Error("Devolucao exige contrato elegivel e vistoria de entrega concluida.");
      }
    }

    let mileageDriven: number | null = null;
    let mileageExcess: number | null = null;
    let mileageExcessCharge = new Prisma.Decimal(0);

    if (completed && input.type === "RETURN" && deliveryInspection) {
      const mileage = calculateMileage({
        initialMileage: deliveryInspection.mileage,
        finalMileage: input.mileage,
        mileageLimit: contract?.mileageLimit,
        excessKmPrice: input.mileageExcessKmPrice
      });
      mileageDriven = mileage.mileageDriven;
      mileageExcess = mileage.mileageExcess;
      mileageExcessCharge = new Prisma.Decimal(mileage.mileageExcessCharge).toDecimalPlaces(2);
    }

    const inspection = existing
      ? await tx.inspection.update({
          where: { id: existing.id },
          data: {
            contractId: contract?.id ?? null,
            motorcycleId: input.motorcycleId,
            customerId,
            type: input.type,
            status: completed ? "COMPLETED" : "DRAFT",
            inspectionDate: input.inspectionDate,
            mileage: input.mileage,
            fuelLevel: input.fuelLevel,
            generalCondition: input.generalCondition,
            generalDamages: input.generalDamages,
            location: input.location,
            notes: input.notes,
            administrativeNotes: input.administrativeNotes,
            customerPresent: input.customerPresent,
            customerRefusedSignature: input.customerRefusedSignature,
            refusalReason: input.refusalReason,
            completedAt: completed ? new Date() : null,
            completedByUserId: completed ? input.userId : null,
            deliveryConfirmedAt: completed && input.type === "DELIVERY" ? new Date() : null,
            returnedAt: completed && input.type === "RETURN" ? new Date() : null,
            destinationStatus: input.type === "RETURN" ? input.destinationStatus : null,
            mileageDriven,
            mileageExcess,
            mileageExcessCharge
          }
        })
      : await tx.inspection.create({
          data: {
            id: inspectionId,
            companyId: input.companyId,
            contractId: contract?.id ?? null,
            motorcycleId: input.motorcycleId,
            customerId,
            createdByUserId: input.userId,
            code: await generateInspectionCode(tx, input.companyId),
            type: input.type,
            status: completed ? "COMPLETED" : "DRAFT",
            inspectionDate: input.inspectionDate,
            mileage: input.mileage,
            fuelLevel: input.fuelLevel,
            generalCondition: input.generalCondition,
            generalDamages: input.generalDamages,
            location: input.location,
            notes: input.notes,
            administrativeNotes: input.administrativeNotes,
            customerPresent: input.customerPresent,
            customerRefusedSignature: input.customerRefusedSignature,
            refusalReason: input.refusalReason,
            completedAt: completed ? new Date() : null,
            completedByUserId: completed ? input.userId : null,
            deliveryConfirmedAt: completed && input.type === "DELIVERY" ? new Date() : null,
            returnedAt: completed && input.type === "RETURN" ? new Date() : null,
            destinationStatus: input.type === "RETURN" ? input.destinationStatus : null,
            mileageDriven,
            mileageExcess,
            mileageExcessCharge
          }
        });

    if (existing) {
      await Promise.all([
        tx.inspectionDamage.deleteMany({ where: { companyId: input.companyId, inspectionId: existing.id } }),
        tx.inspectionItem.deleteMany({ where: { companyId: input.companyId, inspectionId: existing.id } }),
        tx.inspectionAccessory.deleteMany({ where: { companyId: input.companyId, inspectionId: existing.id } })
      ]);
    }

    const itemRows = defaultItems(input.items);
    await tx.inspectionItem.createMany({
      data: itemRows.map((item) => ({
        companyId: input.companyId,
        inspectionId: inspection.id,
        category: item.category,
        itemKey: item.itemKey,
        itemLabel: item.itemLabel,
        condition: item.condition,
        notes: item.notes,
        estimatedCost: item.estimatedCost,
        preExisting: item.preExisting,
        newDamage: item.newDamage,
        chargeCustomer: item.chargeCustomer,
        evaluatorUserId: input.userId
      }))
    });

    const savedItems = await tx.inspectionItem.findMany({
      where: { companyId: input.companyId, inspectionId: inspection.id }
    });
    const comparison = deliveryInspection
      ? compareInspectionItems(deliveryInspection.items, savedItems)
      : [];
    const comparisonByKey = new Map(comparison.map((item) => [item.itemKey, item]));

    const damageInputs = savedItems
      .filter((item) =>
        ["DAMAGED", "MISSING", "NEEDS_MAINTENANCE"].includes(item.condition) ||
        item.preExisting ||
        item.newDamage ||
        item.chargeCustomer
      )
      .map((item) => {
        const compared = comparisonByKey.get(item.itemKey);
        const newDamage = input.type === "RETURN"
          ? Boolean(compared?.newDamage || item.newDamage)
          : Boolean(item.newDamage);

        return {
          companyId: input.companyId,
          inspectionId: inspection.id,
          inspectionItemId: item.id,
          title: item.itemLabel,
          description: item.notes,
          severity: item.condition === "MISSING" ? "HIGH" as DamageSeverity : "LOW" as DamageSeverity,
          preExisting: input.type === "DELIVERY" ? true : item.preExisting,
          newDamage,
          chargeCustomer: item.chargeCustomer,
          estimatedCost: item.estimatedCost,
          approvedChargeAmount: item.chargeCustomer ? item.estimatedCost : new Prisma.Decimal(0),
          status: (item.chargeCustomer ? "APPROVED" : "OPEN") as DamageStatus,
          responsibleParty: item.chargeCustomer ? "CUSTOMER" as DamageResponsibleParty : "UNDEFINED" as DamageResponsibleParty
        };
      });

    for (const damage of damageInputs) {
      const createdDamage = await tx.inspectionDamage.create({ data: damage });

      if (damage.chargeCustomer && createdDamage.approvedChargeAmount.gt(0) && contract) {
        await tx.additionalCharge.create({
          data: {
            companyId: input.companyId,
            contractId: contract.id,
            customerId: contract.customerId,
            motorcycleId: contract.motorcycleId,
            inspectionId: inspection.id,
            inspectionDamageId: createdDamage.id,
            createdByUserId: input.userId,
            code: await generateChargeCode(tx, input.companyId),
            type: "DAMAGE",
            description: `Avaria: ${createdDamage.title}`,
            amount: createdDamage.approvedChargeAmount,
            dueDate: normalizeDateOnly(new Date())
          }
        });
      }
    }

    const accessories = defaultAccessories(input.accessories);
    await tx.inspectionAccessory.createMany({
      data: accessories.map((accessory) => ({
        companyId: input.companyId,
        inspectionId: inspection.id,
        name: accessory.name,
        delivered: accessory.delivered,
        returned: accessory.returned,
        condition: accessory.condition,
        notes: accessory.notes,
        replacementCost: accessory.replacementCost,
        chargeCustomer: accessory.chargeCustomer
      }))
    });

    if (contract) {
      for (const accessory of accessories.filter((item) => item.chargeCustomer && item.replacementCost.gt(0))) {
        await tx.additionalCharge.create({
          data: {
            companyId: input.companyId,
            contractId: contract.id,
            customerId: contract.customerId,
            motorcycleId: contract.motorcycleId,
            inspectionId: inspection.id,
            createdByUserId: input.userId,
            code: await generateChargeCode(tx, input.companyId),
            type: "MISSING_ACCESSORY",
            description: `Acessorio: ${accessory.name}`,
            amount: accessory.replacementCost,
            dueDate: normalizeDateOnly(new Date())
          }
        });
      }
    }

    if (contract && mileageExcessCharge.gt(0)) {
      await tx.additionalCharge.create({
        data: {
          companyId: input.companyId,
          contractId: contract.id,
          customerId: contract.customerId,
          motorcycleId: contract.motorcycleId,
          inspectionId: inspection.id,
          createdByUserId: input.userId,
          code: await generateChargeCode(tx, input.companyId),
          type: "MILEAGE_EXCESS",
          description: `Excesso de quilometragem: ${mileageExcess ?? 0} km`,
          amount: mileageExcessCharge,
          dueDate: normalizeDateOnly(new Date())
        }
      });
    }

    for (const [index, photo] of uploaded.photos.entries()) {
      await tx.inspectionPhoto.create({
        data: {
          companyId: input.companyId,
          inspectionId: inspection.id,
          type: photo.type,
          url: photo.stored.url,
          storageKey: photo.stored.storageKey,
          contentType: photo.stored.contentType,
          sizeBytes: photo.stored.sizeBytes,
          caption: photo.caption,
          sortOrder: photo.sortOrder ?? index,
          uploadedByUserId: input.userId
        }
      });
    }

    for (const signature of uploaded.signatures) {
      await tx.inspectionSignature.create({
        data: {
          companyId: input.companyId,
          inspectionId: inspection.id,
          type: signature.type,
          imageUrl: signature.stored.url,
          storageKey: signature.stored.storageKey,
          signedByName: signature.signedByName,
          signedAt: new Date()
        }
      });
    }

    if (completed) {
      const targetMileage = Math.max(motorcycle.currentMileage, input.mileage);
      await tx.motorcycle.update({
        where: { id: input.motorcycleId },
        data: {
          currentMileage: targetMileage,
          ...(input.type === "RETURN" && input.destinationStatus
            ? { status: input.destinationStatus, currentCustomerId: null }
            : {})
        }
      });

      if (input.createMaintenance) {
        const maintenanceItems = savedItems.filter((item) => item.condition === "NEEDS_MAINTENANCE");
        for (const item of maintenanceItems) {
          await tx.maintenance.create({
            data: {
              companyId: input.companyId,
              motorcycleId: input.motorcycleId,
              inspectionId: inspection.id,
              type: "INSPECTION",
              description: `Vistoria ${inspection.code}: ${item.itemLabel}`,
              date: input.inspectionDate,
              mileage: input.mileage,
              status: "SCHEDULED",
              notes: item.notes
            }
          });
        }

        if (maintenanceItems.length) {
          await tx.motorcycle.update({
            where: { id: input.motorcycleId },
            data: { status: "MAINTENANCE" }
          });
        }
      }
    }

    await recordAudit(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: completed ? "INSPECTION_COMPLETED" : existing ? "INSPECTION_UPDATED" : "INSPECTION_CREATED",
      entity: "Inspection",
      entityId: inspection.id,
      description: `Vistoria ${inspection.code} ${completed ? "concluida" : existing ? "atualizada" : "criada"}.`,
      after: {
        type: inspection.type,
        status: inspection.status,
        mileage: inspection.mileage
      }
    });

    if (contract) {
      await recordContractEvent(tx, {
        companyId: input.companyId,
        contractId: contract.id,
        userId: input.userId,
        type: completed ? "INSPECTION_COMPLETED" : "INSPECTION_CREATED",
        title: completed ? "Vistoria concluida" : "Vistoria criada",
        description: `Vistoria ${inspection.code} vinculada ao contrato ${contract.code}.`,
        metadata: {
          inspectionId: inspection.id,
          inspectionType: inspection.type,
          status: inspection.status
        }
      });
    }

    return inspection;
  });
}

export async function cancelInspection(input: {
  companyId: string;
  inspectionId: string;
  userId: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Informe o motivo do cancelamento.");
  }

  return prisma.$transaction(async (tx) => {
    const inspection = await tx.inspection.findFirst({
      where: { id: input.inspectionId, companyId: input.companyId }
    });

    if (!inspection) {
      throw new Error("Vistoria nao encontrada.");
    }

    if (inspection.status === "CANCELLED") {
      throw new Error("Vistoria ja esta cancelada.");
    }

    const updated = await tx.inspection.update({
      where: { id: inspection.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledByUserId: input.userId,
        cancellationReason: reason
      }
    });

    await recordAudit(tx, {
      companyId: input.companyId,
      userId: input.userId,
      action: "INSPECTION_CANCELLED",
      entity: "Inspection",
      entityId: inspection.id,
      description: `Vistoria ${inspection.code} cancelada.`,
      before: { status: inspection.status },
      after: { status: updated.status, reason }
    });

    if (inspection.contractId) {
      await recordContractEvent(tx, {
        companyId: input.companyId,
        contractId: inspection.contractId,
        userId: input.userId,
        type: "INSPECTION_CANCELLED",
        title: "Vistoria cancelada",
        description: `Vistoria ${inspection.code} cancelada por ${reason}.`,
        metadata: { inspectionId: inspection.id }
      });
    }

    return updated;
  });
}

export async function getInspectionComparison(companyId: string, inspectionId: string) {
  const inspection = await prisma.inspection.findFirst({
    where: { id: inspectionId, companyId },
    include: {
      items: true,
      contract: true,
      motorcycle: true,
      customer: true
    }
  });

  if (!inspection || inspection.type !== "RETURN" || !inspection.contractId) {
    return { inspection, delivery: null, comparison: [] };
  }

  const delivery = await prisma.inspection.findFirst({
    where: {
      companyId,
      contractId: inspection.contractId,
      type: "DELIVERY",
      status: "COMPLETED"
    },
    include: { items: true }
  });

  return {
    inspection,
    delivery,
    comparison: delivery ? compareInspectionItems(delivery.items, inspection.items) : []
  };
}
