import {
  BillingFrequency,
  CompanyStatus,
  ContractType,
  DocumentType,
  MaintenanceStatus,
  MaintenanceType,
  MonthlyOverflowRule,
  MotorcycleStatus,
  NotificationPriority,
  NotificationType,
  PaymentMethod,
  UserRole,
  UserStatus,
  WeekDay
} from "@prisma/client";
import { z } from "zod";

const moneySchema = z.coerce.number().min(0, "Valor nao pode ser negativo.");
const optionalText = z.string().trim().optional().transform((value) => value || undefined);
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data valida.");
const optionalDateText = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value : undefined));

export const loginSchema = z.object({
  email: z.string().email("Informe um e-mail valido.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.")
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres.")
});

export const companySchema = z.object({
  legalName: z.string().min(2, "Informe a razao social."),
  tradeName: optionalText,
  document: optionalText,
  email: z.string().email().optional().or(z.literal("")).transform((value) => value || undefined),
  phone: optionalText,
  whatsapp: optionalText,
  address: optionalText,
  city: optionalText,
  state: optionalText,
  zipCode: optionalText,
  logoUrl: z.string().url().optional().or(z.literal("")).transform((value) => value || undefined),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Use apenas letras minusculas, numeros e hifens."),
  status: z.nativeEnum(CompanyStatus).default("ACTIVE")
});

export const userCreateSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  email: z.string().email("Informe um e-mail valido.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus).default("ACTIVE"),
  phone: optionalText
});

export const customerSchema = z.object({
  fullName: z.string().min(2, "Informe o nome completo."),
  cpf: z.string().min(8, "Informe o CPF."),
  birthDate: optionalDateText,
  email: z.string().email().optional().or(z.literal("")).transform((value) => value || undefined),
  phone: optionalText,
  whatsapp: optionalText,
  address: optionalText,
  number: optionalText,
  complement: optionalText,
  district: optionalText,
  city: optionalText,
  state: optionalText,
  zipCode: optionalText,
  driverLicenseNumber: optionalText,
  driverLicenseCategory: optionalText,
  driverLicenseExpiration: optionalDateText,
  identityNumber: optionalText,
  emergencyContactName: optionalText,
  emergencyContactPhone: optionalText,
  notes: optionalText,
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE")
});

export const motorcycleSchema = z.object({
  brand: z.string().min(2, "Informe a marca."),
  model: z.string().min(1, "Informe o modelo."),
  manufactureYear: z.coerce.number().int().min(1900).max(2100).optional().or(z.literal("")),
  modelYear: z.coerce.number().int().min(1900).max(2100).optional().or(z.literal("")),
  plate: z.string().min(5, "Informe a placa."),
  renavam: optionalText,
  chassis: optionalText,
  color: optionalText,
  engineCapacity: z.coerce.number().int().min(0).optional().or(z.literal("")),
  currentMileage: z.coerce.number().int().min(0).default(0),
  acquisitionValue: moneySchema.optional().or(z.literal("")),
  acquisitionDate: optionalDateText,
  photoUrl: z.string().url().optional().or(z.literal("")).transform((value) => value || undefined),
  notes: optionalText,
  status: z.nativeEnum(MotorcycleStatus).default("AVAILABLE")
});

export const contractSchema = z
  .object({
    customerId: z.string().min(1),
    motorcycleId: z.string().min(1),
    type: z.nativeEnum(ContractType),
    startDate: dateText,
    expectedEndDate: optionalDateText,
    billingFrequency: z.nativeEnum(BillingFrequency),
    firstDueDate: dateText,
    weeklyDueDay: z.nativeEnum(WeekDay).optional().or(z.literal("")),
    monthlyDueDay: z.coerce.number().int().min(1).max(31).optional().or(z.literal("")),
    monthlyOverflowRule: z.nativeEnum(MonthlyOverflowRule).default("LAST_VALID_DAY"),
    installmentAmount: moneySchema.min(0.01),
    totalInstallments: z.coerce.number().int().min(1).max(260),
    downPayment: moneySchema.default(0),
    lateInterestAmount: moneySchema.default(0),
    lateFeeAmount: moneySchema.default(0),
    gracePeriodDays: z.coerce.number().int().min(0).default(0),
    initialMileage: z.coerce.number().int().min(0).optional().or(z.literal("")),
    mileageLimit: z.coerce.number().int().min(0).optional().or(z.literal("")),
    depositAmount: moneySchema.optional().or(z.literal("")),
    notes: optionalText,
    customTerms: optionalText
  })
  .superRefine((value, context) => {
    if (value.billingFrequency === "WEEKLY" && !value.weeklyDueDay) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["weeklyDueDay"],
        message: "Contrato semanal exige dia da semana."
      });
    }

    if (value.billingFrequency === "MONTHLY" && !value.monthlyDueDay) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthlyDueDay"],
        message: "Contrato mensal exige dia fixo do mes."
      });
    }

    if (value.billingFrequency !== "WEEKLY" && value.weeklyDueDay) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["weeklyDueDay"],
        message: "Dia da semana so vale para contratos semanais."
      });
    }

    if (value.billingFrequency !== "MONTHLY" && value.monthlyDueDay) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthlyDueDay"],
        message: "Dia do mes so vale para contratos mensais."
      });
    }
  });

export const paymentSchema = z.object({
  installmentId: z.string().min(1),
  amountPaid: moneySchema.min(0.01),
  paymentDate: dateText,
  method: z.nativeEnum(PaymentMethod),
  reference: optionalText,
  note: optionalText,
  receiptUrl: z.string().url().optional().or(z.literal("")).transform((value) => value || undefined)
});

export const maintenanceSchema = z.object({
  motorcycleId: z.string().min(1),
  type: z.nativeEnum(MaintenanceType),
  description: z.string().min(2),
  date: dateText,
  mileage: z.coerce.number().int().min(0).optional().or(z.literal("")),
  amount: moneySchema.default(0),
  workshop: optionalText,
  nextMaintenanceDate: optionalDateText,
  nextMaintenanceMileage: z.coerce.number().int().min(0).optional().or(z.literal("")),
  status: z.nativeEnum(MaintenanceStatus).default("SCHEDULED"),
  notes: optionalText
});

export const documentSchema = z.object({
  customerId: z.string().optional().or(z.literal("")),
  motorcycleId: z.string().optional().or(z.literal("")),
  contractId: z.string().optional().or(z.literal("")),
  name: z.string().min(2),
  type: z.nativeEnum(DocumentType),
  number: optionalText,
  issueDate: optionalDateText,
  expirationDate: optionalDateText,
  fileUrl: z.string().url("Informe uma URL valida."),
  note: optionalText,
  visibleToCustomer: z.coerce.boolean().default(false)
});

export const notificationSchema = z.object({
  title: z.string().min(2),
  message: z.string().min(3),
  type: z.nativeEnum(NotificationType),
  priority: z.nativeEnum(NotificationPriority).default("NORMAL"),
  publishedAt: dateText,
  expiresAt: optionalDateText,
  recipientMode: z.enum(["ALL", "ONE"]).default("ALL"),
  customerId: z.string().optional().or(z.literal(""))
});

export const settingsSchema = z.object({
  legalName: z.string().min(2),
  tradeName: optionalText,
  document: optionalText,
  email: z.string().email().optional().or(z.literal("")).transform((value) => value || undefined),
  phone: optionalText,
  whatsapp: optionalText,
  address: optionalText,
  logoUrl: z.string().url().optional().or(z.literal("")).transform((value) => value || undefined),
  currency: z.string().default("BRL"),
  timezone: z.string().default("America/Bahia"),
  receiptDefaultText: optionalText,
  defaultLateFee: moneySchema.default(0),
  defaultInterest: moneySchema.default(0),
  defaultGracePeriodDays: z.coerce.number().int().min(0).default(0)
});
