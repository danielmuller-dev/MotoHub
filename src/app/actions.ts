"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, UserRole, type InspectionPhotoType, type InspectionSignatureType } from "@prisma/client";
import {
  clearSessionCookie,
  defaultPathForRole,
  hashPassword,
  requireCompanyRole,
  requireRole,
  requireUser,
  setSessionCookie,
  verifyPassword
} from "@/lib/auth";
import {
  canCompanyAccessSystem,
  getCompanyLicenseEndDate,
  normalizeLicenseExpirationForInput,
  subscriptionStatusForPlan
} from "@/lib/company-license";
import { prisma } from "@/lib/prisma";
import {
  companyLicenseSchema,
  companySchema,
  contractCancellationSchema,
  contractResumeSchema,
  contractSchema,
  contractSuspensionSchema,
  contractTerminationSchema,
  contractUpdateSchema,
  customerSchema,
  documentSchema,
  installmentRenegotiationSchema,
  inspectionCancelSchema,
  inspectionItemSchema,
  inspectionSchema,
  loginSchema,
  maintenanceSchema,
  motorcycleSchema,
  notificationSchema,
  passwordChangeSchema,
  paymentReversalSchema,
  paymentSchema,
  settingsSchema,
  userCreateSchema
} from "@/lib/schemas";
import { dateFromInput, nullableString, slugify } from "@/lib/utils";
import { appendFlashParam } from "@/lib/contract-installments";
import { inspectionChecklist, requiredInspectionPhotoTypes, defaultInspectionAccessories } from "@/lib/inspection-checklist";
import {
  cancelContract,
  createActiveContract,
  renegotiateInstallment,
  resumeContract,
  suspendContract,
  terminateContract,
  updateContractDetails
} from "@/services/contracts";
import { cancelInspection, upsertInspection } from "@/services/inspections";
import { registerPayment, reversePayment } from "@/services/payments";
import { recordAudit } from "@/services/audit";

function formToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function messageFromError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Nao foi possivel concluir a acao.";
}

function redirectWith(path: string, key: "success" | "error", message: string): never {
  redirect(appendFlashParam(path, key, message));
}

function valueOrNull<T>(value: T | "" | undefined | null): T | null {
  return value === "" || value === undefined || value === null ? null : value;
}

function nullableNumber(value: number | "" | undefined | null) {
  return value === "" || value === undefined || value === null ? null : Number(value);
}

function checked(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1";
}

function safeReturnPath(formData: FormData, fallback: string) {
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  return returnTo.startsWith("/contracts/") ||
    returnTo.startsWith("/payments") ||
    returnTo.startsWith("/inspections") ||
    returnTo.startsWith("/motorcycles/") ||
    returnTo.startsWith("/customers/")
    ? returnTo
    : fallback;
}

function moneyField(formData: FormData, name: string) {
  return String(formData.get(name) ?? "0").replace(",", ".").trim() || "0";
}

function optionalFile(formData: FormData, name: string) {
  const file = formData.get(name);
  return file instanceof File && file.size > 0 ? file : null;
}

function parseInspectionItems(formData: FormData) {
  return inspectionChecklist.map((item) => {
    const parsed = inspectionItemSchema.safeParse({
      itemKey: item.key,
      condition: formData.get(`item_${item.key}_condition`) ?? "NOT_CHECKED",
      notes: formData.get(`item_${item.key}_notes`),
      estimatedCost: moneyField(formData, `item_${item.key}_estimatedCost`),
      preExisting: checked(formData.get(`item_${item.key}_preExisting`)),
      newDamage: checked(formData.get(`item_${item.key}_newDamage`)),
      chargeCustomer: checked(formData.get(`item_${item.key}_chargeCustomer`))
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? `Item ${item.label} invalido.`);
    }

    return parsed.data;
  });
}

function parseInspectionAccessories(formData: FormData) {
  return defaultInspectionAccessories.map((name, index) => ({
    name,
    delivered: checked(formData.get(`accessory_${index}_delivered`)),
    returned: checked(formData.get(`accessory_${index}_returned`)),
    condition: String(formData.get(`accessory_${index}_condition`) ?? "NOT_CHECKED") as never,
    notes: nullableString(formData.get(`accessory_${index}_notes`)),
    replacementCost: Number(moneyField(formData, `accessory_${index}_replacementCost`)),
    chargeCustomer: checked(formData.get(`accessory_${index}_chargeCustomer`))
  }));
}

function parseInspectionPhotos(formData: FormData) {
  const photoTypes = [
    ...requiredInspectionPhotoTypes,
    "DAMAGE",
    "ACCESSORY",
    "OTHER"
  ] as InspectionPhotoType[];

  return photoTypes.flatMap((type, index) => {
    const file = optionalFile(formData, `photo_${type}`);
    return file
      ? [{
          type,
          file,
          caption: nullableString(formData.get(`photo_${type}_caption`)),
          sortOrder: index
        }]
      : [];
  });
}

function parseInspectionSignatures(formData: FormData) {
  const signatures: Array<{
    type: InspectionSignatureType;
    dataUrl: string;
    signedByName: string;
  }> = [];

  const customerSignature = String(formData.get("customerSignatureDataUrl") ?? "").trim();
  const customerName = String(formData.get("customerSignatureName") ?? "").trim();
  if (customerSignature && customerName) {
    signatures.push({
      type: "CUSTOMER",
      dataUrl: customerSignature,
      signedByName: customerName
    });
  }

  const employeeSignature = String(formData.get("employeeSignatureDataUrl") ?? "").trim();
  const employeeName = String(formData.get("employeeSignatureName") ?? "").trim();
  if (employeeSignature && employeeName) {
    signatures.push({
      type: "EMPLOYEE",
      dataUrl: employeeSignature,
      signedByName: employeeName
    });
  }

  return signatures;
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    redirectWith("/login", "error", parsed.error.issues[0]?.message ?? "Dados invalidos.");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: {
      company: {
        select: {
          id: true,
          status: true,
          licensePlan: true,
          licenseStartsAt: true,
          licenseExpiresAt: true
        }
      }
    }
  });

  if (!user || user.status !== "ACTIVE") {
    redirectWith("/login", "error", "E-mail ou senha invalidos.");
  }

  if (user.company && user.role !== "SUPER_ADMIN") {
    const access = canCompanyAccessSystem(user.company);
    if (!access.allowed) {
      redirectWith("/login", "error", access.reason ?? "Acesso da empresa indisponivel.");
    }
  }

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!validPassword) {
    redirectWith("/login", "error", "E-mail ou senha invalidos.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  await setSessionCookie(user);
  redirect(defaultPathForRole(user.role));
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login?success=Sessao encerrada.");
}

export async function createCompanyAction(formData: FormData) {
  const user = await requireRole(["SUPER_ADMIN"]);
  const data = formToObject(formData);
  const suggestedSlug = String(data.slug ?? "").trim() || slugify(String(data.tradeName || data.legalName));
  const parsed = companySchema.safeParse({ ...data, slug: suggestedSlug });

  if (!parsed.success) {
    redirectWith("/superadmin/companies", "error", parsed.error.issues[0]?.message ?? "Empresa invalida.");
  }

  try {
    const licenseStartsAt = new Date();
    const licenseExpiresAt = getCompanyLicenseEndDate(parsed.data.licensePlan, licenseStartsAt);
    const status = parsed.data.licensePlan === "FREE_30" && parsed.data.status === "ACTIVE"
      ? "TRIAL"
      : parsed.data.status;
    const company = await prisma.company.create({
      data: {
        ...parsed.data,
        status,
        licenseStartsAt,
        licenseExpiresAt,
        licenseUpdatedAt: licenseStartsAt,
        subscriptionStatus: subscriptionStatusForPlan(parsed.data.licensePlan, licenseExpiresAt, licenseStartsAt),
        trialEndsAt: parsed.data.licensePlan === "FREE_30" ? licenseExpiresAt : null,
        settings: {
          create: {}
        }
      }
    });

    await recordAudit(prisma, {
      companyId: company.id,
      userId: user.id,
      action: "COMPANY_CREATED",
      entity: "Company",
      entityId: company.id,
      description: `Empresa ${company.legalName} cadastrada.`,
      after: {
        legalName: company.legalName,
        slug: company.slug,
        status: company.status,
        licensePlan: company.licensePlan,
        licenseExpiresAt: company.licenseExpiresAt
      }
    });

    revalidatePath("/superadmin/companies");
    redirectWith("/superadmin/companies", "success", "Empresa cadastrada.");
  } catch (error) {
    redirectWith("/superadmin/companies", "error", messageFromError(error));
  }
}

export async function toggleCompanyStatusAction(formData: FormData) {
  const user = await requireRole(["SUPER_ADMIN"]);
  const companyId = String(formData.get("companyId") ?? "");
  const status = String(formData.get("status") ?? "ACTIVE") === "ACTIVE" ? "ACTIVE" : "INACTIVE";

  try {
    const company = await prisma.company.update({
      where: { id: companyId },
      data: { status }
    });

    await recordAudit(prisma, {
      companyId,
      userId: user.id,
      action: "COMPANY_STATUS_CHANGED",
      entity: "Company",
      entityId: companyId,
      description: `Empresa ${company.legalName} alterada para ${status}.`,
      after: { status }
    });

    revalidatePath("/superadmin/companies");
    redirectWith("/superadmin/companies", "success", "Status da empresa atualizado.");
  } catch (error) {
    redirectWith("/superadmin/companies", "error", messageFromError(error));
  }
}

export async function updateCompanyLicenseAction(formData: FormData) {
  const user = await requireRole(["SUPER_ADMIN"]);
  const parsed = companyLicenseSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    redirectWith("/superadmin/companies", "error", parsed.error.issues[0]?.message ?? "Licenca invalida.");
  }

  try {
    const licenseStartsAt = new Date();
    const customExpiresAt = parsed.data.licenseExpiresAt
      ? normalizeLicenseExpirationForInput(dateFromInput(parsed.data.licenseExpiresAt))
      : null;
    const licenseExpiresAt = getCompanyLicenseEndDate(
      parsed.data.licensePlan,
      licenseStartsAt,
      customExpiresAt
    );
    const status = parsed.data.licensePlan === "FREE_30" && parsed.data.status === "ACTIVE"
      ? "TRIAL"
      : parsed.data.status;

    const company = await prisma.company.update({
      where: { id: parsed.data.companyId },
      data: {
        status,
        licensePlan: parsed.data.licensePlan,
        licenseStartsAt,
        licenseExpiresAt,
        licenseUpdatedAt: licenseStartsAt,
        subscriptionStatus: subscriptionStatusForPlan(parsed.data.licensePlan, licenseExpiresAt, licenseStartsAt),
        trialEndsAt: parsed.data.licensePlan === "FREE_30" ? licenseExpiresAt : null
      }
    });

    await recordAudit(prisma, {
      companyId: company.id,
      userId: user.id,
      action: "COMPANY_LICENSE_UPDATED",
      entity: "Company",
      entityId: company.id,
      description: `Licenca da empresa ${company.legalName} atualizada.`,
      after: {
        status: company.status,
        licensePlan: company.licensePlan,
        licenseExpiresAt: company.licenseExpiresAt
      }
    });

    revalidatePath("/superadmin/companies");
    redirectWith("/superadmin/companies", "success", "Licenca da empresa atualizada.");
  } catch (error) {
    redirectWith("/superadmin/companies", "error", messageFromError(error));
  }
}

export async function createCompanyAdminAction(formData: FormData) {
  const actor = await requireRole(["SUPER_ADMIN"]);
  const companyId = String(formData.get("companyId") ?? "");
  const parsed = userCreateSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: "COMPANY_ADMIN",
    status: "ACTIVE",
    phone: formData.get("phone")
  });

  if (!parsed.success) {
    redirectWith("/superadmin/companies", "error", parsed.error.issues[0]?.message ?? "Usuario invalido.");
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const created = await prisma.user.create({
      data: {
        companyId,
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: "COMPANY_ADMIN",
        status: parsed.data.status,
        phone: parsed.data.phone
      }
    });

    await recordAudit(prisma, {
      companyId,
      userId: actor.id,
      action: "USER_CREATED",
      entity: "User",
      entityId: created.id,
      description: `Administrador ${created.email} criado.`
    });

    revalidatePath("/superadmin/companies");
    redirectWith("/superadmin/companies", "success", "Administrador criado.");
  } catch (error) {
    redirectWith("/superadmin/companies", "error", messageFromError(error));
  }
}

export async function createCustomerAction(formData: FormData) {
  const user = await requireCompanyRole();
  const parsed = customerSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    redirectWith("/customers", "error", parsed.error.issues[0]?.message ?? "Cliente invalido.");
  }

  try {
    const accessPassword = nullableString(formData.get("accessPassword"));
    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          companyId: user.companyId!,
          fullName: parsed.data.fullName,
          cpf: parsed.data.cpf,
          birthDate: parsed.data.birthDate ? dateFromInput(parsed.data.birthDate) : null,
          email: parsed.data.email,
          phone: parsed.data.phone,
          whatsapp: parsed.data.whatsapp,
          address: parsed.data.address,
          number: parsed.data.number,
          complement: parsed.data.complement,
          district: parsed.data.district,
          city: parsed.data.city,
          state: parsed.data.state,
          zipCode: parsed.data.zipCode,
          driverLicenseNumber: parsed.data.driverLicenseNumber,
          driverLicenseCategory: parsed.data.driverLicenseCategory,
          driverLicenseExpiration: parsed.data.driverLicenseExpiration
            ? dateFromInput(parsed.data.driverLicenseExpiration)
            : null,
          identityNumber: parsed.data.identityNumber,
          emergencyContactName: parsed.data.emergencyContactName,
          emergencyContactPhone: parsed.data.emergencyContactPhone,
          notes: parsed.data.notes,
          status: parsed.data.status
        }
      });

      if (accessPassword && parsed.data.email) {
        if (accessPassword.length < 8) {
          throw new Error("A senha de acesso do cliente deve ter pelo menos 8 caracteres.");
        }

        await tx.user.create({
          data: {
            companyId: user.companyId,
            customerId: created.id,
            name: created.fullName,
            email: parsed.data.email,
            passwordHash: await hashPassword(accessPassword),
            role: "CUSTOMER"
          }
        });
      }

      await recordAudit(tx, {
        companyId: user.companyId,
        userId: user.id,
        action: "CUSTOMER_CREATED",
        entity: "Customer",
        entityId: created.id,
        description: `Cliente ${created.fullName} cadastrado.`
      });

      return created;
    });

    revalidatePath("/customers");
    redirectWith(`/customers/${customer.id}`, "success", "Cliente cadastrado.");
  } catch (error) {
    redirectWith("/customers", "error", messageFromError(error));
  }
}

export async function toggleCustomerStatusAction(formData: FormData) {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const customerId = String(formData.get("customerId") ?? "");
  const status = String(formData.get("status") ?? "ACTIVE") === "ACTIVE" ? "ACTIVE" : "INACTIVE";

  try {
    const activeContracts = await prisma.contract.count({
      where: {
        companyId: user.companyId!,
        customerId,
        status: { in: ["ACTIVE", "OVERDUE", "SUSPENDED"] }
      }
    });

    if (status === "INACTIVE" && activeContracts > 0) {
      throw new Error("Nao e possivel inativar cliente com contrato ativo.");
    }

    await prisma.customer.update({
      where: { id: customerId, companyId: user.companyId! },
      data: { status }
    });

    await recordAudit(prisma, {
      companyId: user.companyId,
      userId: user.id,
      action: "CUSTOMER_STATUS_CHANGED",
      entity: "Customer",
      entityId: customerId,
      description: `Status do cliente alterado para ${status}.`
    });

    revalidatePath("/customers");
    redirectWith("/customers", "success", "Cliente atualizado.");
  } catch (error) {
    redirectWith("/customers", "error", messageFromError(error));
  }
}

export async function createMotorcycleAction(formData: FormData) {
  const user = await requireCompanyRole();
  const parsed = motorcycleSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    redirectWith("/motorcycles", "error", parsed.error.issues[0]?.message ?? "Moto invalida.");
  }

  try {
    const motorcycle = await prisma.motorcycle.create({
      data: {
        companyId: user.companyId!,
        brand: parsed.data.brand,
        model: parsed.data.model,
        manufactureYear: nullableNumber(parsed.data.manufactureYear),
        modelYear: nullableNumber(parsed.data.modelYear),
        plate: parsed.data.plate.toUpperCase(),
        renavam: parsed.data.renavam,
        chassis: parsed.data.chassis,
        color: parsed.data.color,
        engineCapacity: nullableNumber(parsed.data.engineCapacity),
        currentMileage: parsed.data.currentMileage,
        acquisitionValue:
          parsed.data.acquisitionValue === "" || parsed.data.acquisitionValue === undefined
            ? undefined
            : new Prisma.Decimal(parsed.data.acquisitionValue),
        acquisitionDate: parsed.data.acquisitionDate
          ? dateFromInput(parsed.data.acquisitionDate)
          : null,
        photoUrl: parsed.data.photoUrl,
        notes: parsed.data.notes,
        status: parsed.data.status
      }
    });

    await recordAudit(prisma, {
      companyId: user.companyId,
      userId: user.id,
      action: "MOTORCYCLE_CREATED",
      entity: "Motorcycle",
      entityId: motorcycle.id,
      description: `Moto ${motorcycle.brand} ${motorcycle.model} cadastrada.`
    });

    revalidatePath("/motorcycles");
    redirectWith(`/motorcycles/${motorcycle.id}`, "success", "Moto cadastrada.");
  } catch (error) {
    redirectWith("/motorcycles", "error", messageFromError(error));
  }
}

export async function updateMotorcycleStatusAction(formData: FormData) {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const motorcycleId = String(formData.get("motorcycleId") ?? "");
  const status = String(formData.get("status") ?? "AVAILABLE");

  try {
    const activeContracts = await prisma.contract.count({
      where: {
        companyId: user.companyId!,
        motorcycleId,
        status: { in: ["ACTIVE", "OVERDUE", "SUSPENDED"] }
      }
    });

    if (status === "INACTIVE" && activeContracts > 0) {
      throw new Error("Nao e possivel inativar moto com contrato ativo.");
    }

    await prisma.motorcycle.update({
      where: { id: motorcycleId, companyId: user.companyId! },
      data: { status: status as never }
    });

    await recordAudit(prisma, {
      companyId: user.companyId,
      userId: user.id,
      action: "MOTORCYCLE_STATUS_CHANGED",
      entity: "Motorcycle",
      entityId: motorcycleId,
      description: `Status da moto alterado para ${status}.`
    });

    revalidatePath("/motorcycles");
    redirectWith("/motorcycles", "success", "Moto atualizada.");
  } catch (error) {
    redirectWith("/motorcycles", "error", messageFromError(error));
  }
}

export async function createContractAction(formData: FormData) {
  const user = await requireCompanyRole();
  const parsed = contractSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    redirectWith("/contracts", "error", parsed.error.issues[0]?.message ?? "Contrato invalido.");
  }

  try {
    const contract = await createActiveContract({
      companyId: user.companyId!,
      userId: user.id,
      customerId: parsed.data.customerId,
      motorcycleId: parsed.data.motorcycleId,
      type: parsed.data.type,
      startDate: dateFromInput(parsed.data.startDate),
      expectedEndDate: parsed.data.expectedEndDate ? dateFromInput(parsed.data.expectedEndDate) : null,
      billingFrequency: parsed.data.billingFrequency,
      firstDueDate: dateFromInput(parsed.data.firstDueDate),
      weeklyDueDay:
        parsed.data.billingFrequency === "WEEKLY"
          ? valueOrNull(parsed.data.weeklyDueDay)
          : null,
      monthlyDueDay:
        parsed.data.billingFrequency === "MONTHLY"
          ? nullableNumber(parsed.data.monthlyDueDay)
          : null,
      monthlyOverflowRule: parsed.data.monthlyOverflowRule,
      installmentAmount: parsed.data.installmentAmount,
      totalInstallments: parsed.data.totalInstallments,
      downPayment: parsed.data.downPayment,
      lateInterestAmount: parsed.data.lateInterestAmount,
      lateFeeAmount: parsed.data.lateFeeAmount,
      gracePeriodDays: parsed.data.gracePeriodDays,
      initialMileage: nullableNumber(parsed.data.initialMileage),
      mileageLimit: nullableNumber(parsed.data.mileageLimit),
      depositAmount: nullableNumber(parsed.data.depositAmount),
      notes: parsed.data.notes,
      customTerms: parsed.data.customTerms
    });

    revalidatePath("/contracts");
    redirectWith(`/contracts/${contract.id}`, "success", "Contrato ativado e parcelas geradas.");
  } catch (error) {
    redirectWith("/contracts", "error", messageFromError(error));
  }
}

export async function updateContractAction(formData: FormData) {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const parsed = contractUpdateSchema.safeParse(formToObject(formData));
  const fallback = `/contracts/${String(formData.get("contractId") ?? "")}`;
  const returnPath = safeReturnPath(formData, fallback);

  if (!parsed.success) {
    redirectWith(returnPath, "error", parsed.error.issues[0]?.message ?? "Edicao invalida.");
  }

  try {
    await updateContractDetails({
      companyId: user.companyId!,
      contractId: parsed.data.contractId,
      userId: user.id,
      expectedEndDate: parsed.data.expectedEndDate ? dateFromInput(parsed.data.expectedEndDate) : null,
      lateInterestAmount: parsed.data.lateInterestAmount,
      lateFeeAmount: parsed.data.lateFeeAmount,
      gracePeriodDays: parsed.data.gracePeriodDays,
      mileageLimit: nullableNumber(parsed.data.mileageLimit),
      notes: parsed.data.notes,
      customTerms: parsed.data.customTerms
    });
    revalidatePath("/contracts");
    revalidatePath(`/contracts/${parsed.data.contractId}`);
    redirectWith(returnPath, "success", "Contrato atualizado.");
  } catch (error) {
    redirectWith(returnPath, "error", messageFromError(error));
  }
}

export async function cancelContractAction(formData: FormData) {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const parsed = contractCancellationSchema.safeParse(formToObject(formData));
  const fallback = `/contracts/${String(formData.get("contractId") ?? "")}`;
  const returnPath = safeReturnPath(formData, fallback);

  if (!parsed.success) {
    redirectWith(returnPath, "error", parsed.error.issues[0]?.message ?? "Cancelamento invalido.");
  }

  try {
    await cancelContract({
      companyId: user.companyId!,
      contractId: parsed.data.contractId,
      userId: user.id,
      cancelledAt: dateFromInput(parsed.data.cancelledAt),
      reason: parsed.data.cancellationReason,
      notes: parsed.data.cancellationNotes,
      cancelFutureInstallments: checked(formData.get("cancelFutureInstallments")),
      releaseMotorcycle: checked(formData.get("releaseMotorcycle"))
    });
    revalidatePath("/contracts");
    revalidatePath(`/contracts/${parsed.data.contractId}`);
    redirectWith(returnPath, "success", "Contrato cancelado.");
  } catch (error) {
    redirectWith(returnPath, "error", messageFromError(error));
  }
}

export async function terminateContractAction(formData: FormData) {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const parsed = contractTerminationSchema.safeParse(formToObject(formData));
  const fallback = `/contracts/${String(formData.get("contractId") ?? "")}`;
  const returnPath = safeReturnPath(formData, fallback);

  if (!parsed.success) {
    redirectWith(returnPath, "error", parsed.error.issues[0]?.message ?? "Encerramento invalido.");
  }

  try {
    await terminateContract({
      companyId: user.companyId!,
      contractId: parsed.data.contractId,
      userId: user.id,
      terminatedAt: dateFromInput(parsed.data.terminatedAt),
      reason: parsed.data.terminationReason,
      notes: parsed.data.terminationNotes,
      cancelFutureInstallments: checked(formData.get("cancelFutureInstallments")),
      motorcycleDisposition: parsed.data.motorcycleDisposition
    });
    revalidatePath("/contracts");
    revalidatePath(`/contracts/${parsed.data.contractId}`);
    redirectWith(returnPath, "success", "Contrato encerrado.");
  } catch (error) {
    redirectWith(returnPath, "error", messageFromError(error));
  }
}

export async function suspendContractAction(formData: FormData) {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const parsed = contractSuspensionSchema.safeParse(formToObject(formData));
  const fallback = `/contracts/${String(formData.get("contractId") ?? "")}`;
  const returnPath = safeReturnPath(formData, fallback);

  if (!parsed.success) {
    redirectWith(returnPath, "error", parsed.error.issues[0]?.message ?? "Suspensao invalida.");
  }

  try {
    await suspendContract({
      companyId: user.companyId!,
      contractId: parsed.data.contractId,
      userId: user.id,
      suspendedAt: dateFromInput(parsed.data.suspendedAt),
      expectedResumeAt: parsed.data.expectedResumeAt ? dateFromInput(parsed.data.expectedResumeAt) : null,
      reason: parsed.data.suspensionReason,
      notes: parsed.data.suspensionNotes,
      freezeDueDates: checked(formData.get("freezeDueDates"))
    });
    revalidatePath("/contracts");
    revalidatePath(`/contracts/${parsed.data.contractId}`);
    redirectWith(returnPath, "success", "Contrato suspenso.");
  } catch (error) {
    redirectWith(returnPath, "error", messageFromError(error));
  }
}

export async function resumeContractAction(formData: FormData) {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const parsed = contractResumeSchema.safeParse(formToObject(formData));
  const fallback = `/contracts/${String(formData.get("contractId") ?? "")}`;
  const returnPath = safeReturnPath(formData, fallback);

  if (!parsed.success) {
    redirectWith(returnPath, "error", parsed.error.issues[0]?.message ?? "Retomada invalida.");
  }

  try {
    await resumeContract({
      companyId: user.companyId!,
      contractId: parsed.data.contractId,
      userId: user.id,
      resumedAt: dateFromInput(parsed.data.resumedAt),
      notes: parsed.data.resumeNotes
    });
    revalidatePath("/contracts");
    revalidatePath(`/contracts/${parsed.data.contractId}`);
    redirectWith(returnPath, "success", "Contrato retomado.");
  } catch (error) {
    redirectWith(returnPath, "error", messageFromError(error));
  }
}

export async function renegotiateInstallmentAction(formData: FormData) {
  const user = await requireCompanyRole(["COMPANY_ADMIN", "EMPLOYEE"]);
  const parsed = installmentRenegotiationSchema.safeParse(formToObject(formData));
  const fallback = `/contracts/${String(formData.get("contractId") ?? "")}`;
  const returnPath = safeReturnPath(formData, fallback);

  if (!parsed.success) {
    redirectWith(returnPath, "error", parsed.error.issues[0]?.message ?? "Renegociacao invalida.");
  }

  try {
    await renegotiateInstallment({
      companyId: user.companyId!,
      contractId: parsed.data.contractId,
      installmentId: parsed.data.installmentId,
      userId: user.id,
      newDueDate: dateFromInput(parsed.data.newDueDate),
      discountAmount: parsed.data.discountAmount,
      penaltyAmount: parsed.data.penaltyAmount,
      interestAmount: parsed.data.interestAmount,
      reason: parsed.data.renegotiationReason,
      notes: parsed.data.renegotiationNotes
    });
    revalidatePath(`/contracts/${parsed.data.contractId}`);
    redirectWith(returnPath, "success", "Parcela renegociada.");
  } catch (error) {
    redirectWith(returnPath, "error", messageFromError(error));
  }
}

export async function registerPaymentAction(formData: FormData) {
  const user = await requireCompanyRole();
  const parsed = paymentSchema.safeParse(formToObject(formData));
  const returnTo = String(formData.get("returnTo") ?? "").trim();
  const paymentReturnPath = returnTo.startsWith("/contracts/") ? returnTo : "/payments";

  if (!parsed.success) {
    redirectWith(paymentReturnPath, "error", parsed.error.issues[0]?.message ?? "Pagamento invalido.");
  }

  try {
    const payment = await registerPayment({
      companyId: user.companyId!,
      installmentId: parsed.data.installmentId,
      amountPaid: parsed.data.amountPaid,
      paymentDate: dateFromInput(parsed.data.paymentDate),
      method: parsed.data.method,
      reference: parsed.data.reference,
      note: parsed.data.note,
      receiptUrl: parsed.data.receiptUrl,
      registeredByUserId: user.id
    });

    revalidatePath("/payments");
    if (paymentReturnPath !== "/payments") {
      revalidatePath(paymentReturnPath.split("?")[0]);
      redirectWith(paymentReturnPath, "success", "Pagamento registrado.");
    }
    redirectWith(`/payments/${payment.id}`, "success", "Pagamento registrado.");
  } catch (error) {
    redirectWith(paymentReturnPath, "error", messageFromError(error));
  }
}

export async function reversePaymentAction(formData: FormData) {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const parsed = paymentReversalSchema.safeParse(formToObject(formData));
  const fallback = `/payments/${String(formData.get("paymentId") ?? "")}`;
  const returnPath = safeReturnPath(formData, fallback);

  if (!parsed.success) {
    redirectWith(returnPath, "error", parsed.error.issues[0]?.message ?? "Estorno invalido.");
  }

  try {
    const payment = await reversePayment({
      companyId: user.companyId!,
      paymentId: parsed.data.paymentId,
      reversedByUserId: user.id,
      reason: parsed.data.reversalReason,
      notes: parsed.data.reversalNotes
    });

    revalidatePath("/payments");
    revalidatePath(`/payments/${payment.id}`);
    revalidatePath(`/contracts/${payment.contractId}`);
    redirectWith(returnPath, "success", "Pagamento estornado.");
  } catch (error) {
    redirectWith(returnPath, "error", messageFromError(error));
  }
}

export async function upsertInspectionAction(formData: FormData) {
  const user = await requireCompanyRole();
  const fallback = String(formData.get("inspectionId") ?? "").trim()
    ? `/inspections/${String(formData.get("inspectionId"))}/edit`
    : "/inspections/new";
  const returnTo = safeReturnPath(formData, fallback);
  const parsed = inspectionSchema.safeParse({
    ...formToObject(formData),
    customerPresent: checked(formData.get("customerPresent")),
    customerRefusedSignature: checked(formData.get("customerRefusedSignature")),
    createMaintenance: checked(formData.get("createMaintenance")),
    mileageExcessKmPrice: moneyField(formData, "mileageExcessKmPrice")
  });

  if (!parsed.success) {
    redirectWith(returnTo, "error", parsed.error.issues[0]?.message ?? "Vistoria invalida.");
  }

  try {
    const items = parseInspectionItems(formData);
    const inspection = await upsertInspection({
      companyId: user.companyId!,
      userId: user.id,
      inspectionId: valueOrNull(parsed.data.inspectionId),
      contractId: valueOrNull(parsed.data.contractId),
      motorcycleId: parsed.data.motorcycleId,
      customerId: valueOrNull(parsed.data.customerId),
      type: parsed.data.type,
      submitIntent: parsed.data.submitIntent,
      inspectionDate: dateFromInput(parsed.data.inspectionDate),
      mileage: parsed.data.mileage,
      fuelLevel: parsed.data.fuelLevel,
      generalCondition: parsed.data.generalCondition,
      generalDamages: parsed.data.generalDamages,
      location: parsed.data.location,
      notes: parsed.data.notes,
      administrativeNotes: parsed.data.administrativeNotes,
      customerPresent: parsed.data.customerPresent,
      customerRefusedSignature: parsed.data.customerRefusedSignature,
      refusalReason: parsed.data.refusalReason,
      destinationStatus: valueOrNull(parsed.data.destinationStatus),
      mileageExcessKmPrice: parsed.data.mileageExcessKmPrice,
      createMaintenance: parsed.data.createMaintenance,
      items,
      accessories: parseInspectionAccessories(formData),
      photos: parseInspectionPhotos(formData),
      signatures: parseInspectionSignatures(formData)
    });

    revalidatePath("/inspections");
    revalidatePath(`/inspections/${inspection.id}`);
    if (inspection.contractId) {
      revalidatePath(`/contracts/${inspection.contractId}`);
    }
    revalidatePath(`/motorcycles/${inspection.motorcycleId}`);
    if (inspection.customerId) {
      revalidatePath(`/customers/${inspection.customerId}`);
    }

    redirectWith(
      `/inspections/${inspection.id}`,
      "success",
      parsed.data.submitIntent === "COMPLETE" ? "Vistoria concluida." : "Vistoria salva como rascunho."
    );
  } catch (error) {
    redirectWith(returnTo, "error", messageFromError(error));
  }
}

export async function cancelInspectionAction(formData: FormData) {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const parsed = inspectionCancelSchema.safeParse(formToObject(formData));
  const returnTo = safeReturnPath(formData, "/inspections");

  if (!parsed.success) {
    redirectWith(returnTo, "error", parsed.error.issues[0]?.message ?? "Cancelamento invalido.");
  }

  try {
    const inspection = await cancelInspection({
      companyId: user.companyId!,
      userId: user.id,
      inspectionId: parsed.data.inspectionId,
      reason: parsed.data.cancellationReason
    });

    revalidatePath("/inspections");
    revalidatePath(`/inspections/${inspection.id}`);
    if (inspection.contractId) {
      revalidatePath(`/contracts/${inspection.contractId}`);
    }

    redirectWith(`/inspections/${inspection.id}`, "success", "Vistoria cancelada.");
  } catch (error) {
    redirectWith(returnTo, "error", messageFromError(error));
  }
}

export async function createMaintenanceAction(formData: FormData) {
  const user = await requireCompanyRole();
  const parsed = maintenanceSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    redirectWith("/maintenance", "error", parsed.error.issues[0]?.message ?? "Manutencao invalida.");
  }

  try {
    const maintenance = await prisma.$transaction(async (tx) => {
      const created = await tx.maintenance.create({
        data: {
          companyId: user.companyId!,
          motorcycleId: parsed.data.motorcycleId,
          type: parsed.data.type,
          description: parsed.data.description,
          date: dateFromInput(parsed.data.date),
          mileage: nullableNumber(parsed.data.mileage),
          amount: new Prisma.Decimal(parsed.data.amount),
          workshop: parsed.data.workshop,
          nextMaintenanceDate: parsed.data.nextMaintenanceDate
            ? dateFromInput(parsed.data.nextMaintenanceDate)
            : null,
          nextMaintenanceMileage: nullableNumber(parsed.data.nextMaintenanceMileage),
          status: parsed.data.status,
          notes: parsed.data.notes
        }
      });

      if (["SCHEDULED", "IN_PROGRESS"].includes(parsed.data.status)) {
        await tx.motorcycle.update({
          where: { id: parsed.data.motorcycleId, companyId: user.companyId! },
          data: { status: "MAINTENANCE" }
        });
      }

      await recordAudit(tx, {
        companyId: user.companyId,
        userId: user.id,
        action: "MAINTENANCE_CREATED",
        entity: "Maintenance",
        entityId: created.id,
        description: `Manutencao ${created.description} cadastrada.`
      });

      return created;
    });

    revalidatePath("/maintenance");
    redirectWith("/maintenance", "success", `Manutencao ${maintenance.description} cadastrada.`);
  } catch (error) {
    redirectWith("/maintenance", "error", messageFromError(error));
  }
}

export async function createDocumentAction(formData: FormData) {
  const user = await requireCompanyRole();
  const parsed = documentSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    redirectWith("/documents", "error", parsed.error.issues[0]?.message ?? "Documento invalido.");
  }

  try {
    const document = await prisma.document.create({
      data: {
        companyId: user.companyId!,
        customerId: valueOrNull(parsed.data.customerId),
        motorcycleId: valueOrNull(parsed.data.motorcycleId),
        contractId: valueOrNull(parsed.data.contractId),
        name: parsed.data.name,
        type: parsed.data.type,
        number: parsed.data.number,
        issueDate: parsed.data.issueDate ? dateFromInput(parsed.data.issueDate) : null,
        expirationDate: parsed.data.expirationDate ? dateFromInput(parsed.data.expirationDate) : null,
        fileUrl: parsed.data.fileUrl,
        note: parsed.data.note,
        visibleToCustomer: parsed.data.visibleToCustomer
      }
    });

    await recordAudit(prisma, {
      companyId: user.companyId,
      userId: user.id,
      action: "DOCUMENT_CREATED",
      entity: "Document",
      entityId: document.id,
      description: `Documento ${document.name} cadastrado.`
    });

    revalidatePath("/documents");
    redirectWith("/documents", "success", "Documento cadastrado.");
  } catch (error) {
    redirectWith("/documents", "error", messageFromError(error));
  }
}

export async function createNotificationAction(formData: FormData) {
  const user = await requireCompanyRole();
  const parsed = notificationSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    redirectWith("/notifications", "error", parsed.error.issues[0]?.message ?? "Aviso invalido.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const notification = await tx.notification.create({
        data: {
          companyId: user.companyId!,
          createdByUserId: user.id,
          title: parsed.data.title,
          message: parsed.data.message,
          type: parsed.data.type,
          priority: parsed.data.priority,
          publishedAt: dateFromInput(parsed.data.publishedAt),
          expiresAt: parsed.data.expiresAt ? dateFromInput(parsed.data.expiresAt) : null
        }
      });

      const customers =
        parsed.data.recipientMode === "ONE" && parsed.data.customerId
          ? await tx.customer.findMany({
              where: { id: parsed.data.customerId, companyId: user.companyId!, status: "ACTIVE" },
              select: { id: true }
            })
          : await tx.customer.findMany({
              where: { companyId: user.companyId!, status: "ACTIVE", deletedAt: null },
              select: { id: true }
            });

      if (customers.length) {
        await tx.notificationRecipient.createMany({
          data: customers.map((customer) => ({
            notificationId: notification.id,
            customerId: customer.id
          }))
        });
      }

      await recordAudit(tx, {
        companyId: user.companyId,
        userId: user.id,
        action: "NOTIFICATION_CREATED",
        entity: "Notification",
        entityId: notification.id,
        description: `Aviso ${notification.title} enviado para ${customers.length} cliente(s).`
      });
    });

    revalidatePath("/notifications");
    redirectWith("/notifications", "success", "Aviso enviado.");
  } catch (error) {
    redirectWith("/notifications", "error", messageFromError(error));
  }
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireRole(["CUSTOMER"]);
  const recipientId = String(formData.get("recipientId") ?? "");

  await prisma.notificationRecipient.updateMany({
    where: {
      id: recipientId,
      customerId: user.customerId!
    },
    data: {
      readAt: new Date()
    }
  });

  revalidatePath("/customer/notifications");
  redirectWith("/customer/notifications", "success", "Aviso marcado como lido.");
}

export async function updateSettingsAction(formData: FormData) {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const parsed = settingsSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    redirectWith("/settings", "error", parsed.error.issues[0]?.message ?? "Configuracoes invalidas.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: user.companyId! },
        data: {
          legalName: parsed.data.legalName,
          tradeName: parsed.data.tradeName,
          document: parsed.data.document,
          email: parsed.data.email,
          phone: parsed.data.phone,
          whatsapp: parsed.data.whatsapp,
          address: parsed.data.address,
          logoUrl: parsed.data.logoUrl
        }
      });

      await tx.companySettings.upsert({
        where: { companyId: user.companyId! },
        update: {
          currency: parsed.data.currency,
          timezone: parsed.data.timezone,
          receiptDefaultText: parsed.data.receiptDefaultText,
          defaultLateFee: new Prisma.Decimal(parsed.data.defaultLateFee),
          defaultInterest: new Prisma.Decimal(parsed.data.defaultInterest),
          defaultGracePeriodDays: parsed.data.defaultGracePeriodDays
        },
        create: {
          companyId: user.companyId!,
          currency: parsed.data.currency,
          timezone: parsed.data.timezone,
          receiptDefaultText: parsed.data.receiptDefaultText,
          defaultLateFee: new Prisma.Decimal(parsed.data.defaultLateFee),
          defaultInterest: new Prisma.Decimal(parsed.data.defaultInterest),
          defaultGracePeriodDays: parsed.data.defaultGracePeriodDays
        }
      });

      await recordAudit(tx, {
        companyId: user.companyId,
        userId: user.id,
        action: "COMPANY_SETTINGS_UPDATED",
        entity: "CompanySettings",
        entityId: user.companyId!,
        description: "Configuracoes da empresa atualizadas."
      });
    });

    revalidatePath("/settings");
    redirectWith("/settings", "success", "Configuracoes salvas.");
  } catch (error) {
    redirectWith("/settings", "error", messageFromError(error));
  }
}

export async function createTeamUserAction(formData: FormData) {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const rawRole = String(formData.get("role") ?? "EMPLOYEE");
  const role = rawRole === "COMPANY_ADMIN" ? "COMPANY_ADMIN" : "EMPLOYEE";
  const parsed = userCreateSchema.safeParse({ ...formToObject(formData), role });

  if (!parsed.success) {
    redirectWith("/team", "error", parsed.error.issues[0]?.message ?? "Usuario invalido.");
  }

  try {
    const created = await prisma.user.create({
      data: {
        companyId: user.companyId!,
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        role: parsed.data.role as UserRole,
        status: parsed.data.status,
        phone: parsed.data.phone
      }
    });

    await recordAudit(prisma, {
      companyId: user.companyId,
      userId: user.id,
      action: "USER_CREATED",
      entity: "User",
      entityId: created.id,
      description: `Usuario ${created.email} criado.`
    });

    revalidatePath("/team");
    redirectWith("/team", "success", "Usuario criado.");
  } catch (error) {
    redirectWith("/team", "error", messageFromError(error));
  }
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser();
  const parsed = passwordChangeSchema.safeParse(formToObject(formData));

  if (!parsed.success) {
    redirectWith("/settings", "error", parsed.error.issues[0]?.message ?? "Senha invalida.");
  }

  const account = await prisma.user.findUnique({ where: { id: user.id } });
  if (!account) {
    redirectWith("/settings", "error", "Usuario nao encontrado.");
  }

  const valid = await verifyPassword(parsed.data.currentPassword, account.passwordHash);
  if (!valid) {
    redirectWith("/settings", "error", "Senha atual incorreta.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.newPassword)
    }
  });

  redirectWith("/settings", "success", "Senha alterada.");
}
