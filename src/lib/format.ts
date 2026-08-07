import type {
  BillingFrequency,
  CompanyStatus,
  ContractStatus,
  ContractType,
  AdditionalChargeStatus,
  AdditionalChargeType,
  DamageResponsibleParty,
  DamageSeverity,
  DamageStatus,
  DocumentStatus,
  FuelLevel,
  InstallmentStatus,
  InspectionItemCondition,
  InspectionPhotoType,
  InspectionSignatureType,
  InspectionStatus,
  InspectionType,
  MaintenanceStatus,
  MaintenanceType,
  MotorcycleStatus,
  NotificationPriority,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  UserRole,
  UserStatus,
  WeekDay
} from "@prisma/client";

export const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

export const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "short"
});

export const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

export function formatCurrency(value: number | string | { toNumber(): number } | null | undefined) {
  if (value === null || value === undefined) {
    return currencyFormatter.format(0);
  }
  if (typeof value === "object" && "toNumber" in value) {
    return currencyFormatter.format(value.toNumber());
  }
  return currencyFormatter.format(Number(value));
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }
  return dateTimeFormatter.format(new Date(value));
}

export function formatDateInput(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: "Superadmin",
  COMPANY_ADMIN: "Administrador",
  EMPLOYEE: "Funcionario",
  CUSTOMER: "Cliente"
};

export const userStatusLabels: Record<UserStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo"
};

export const companyStatusLabels: Record<CompanyStatus, string> = {
  ACTIVE: "Ativa",
  INACTIVE: "Inativa",
  TRIAL: "Teste",
  BLOCKED: "Bloqueada"
};

export const customerStatusLabels = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo"
} as const;

export const motorcycleStatusLabels: Record<MotorcycleStatus, string> = {
  AVAILABLE: "Disponivel",
  RENTED: "Alugada",
  MAINTENANCE: "Manutencao",
  BLOCKED: "Bloqueada",
  SOLD: "Vendida",
  INACTIVE: "Inativa"
};

export const contractStatusLabels: Record<ContractStatus, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  OVERDUE: "Atrasado",
  SUSPENDED: "Suspenso",
  COMPLETED: "Concluido",
  CANCELLED: "Cancelado",
  TERMINATED: "Encerrado"
};

export const inspectionTypeLabels: Record<InspectionType, string> = {
  DELIVERY: "Entrega",
  PERIODIC: "Periodica",
  RETURN: "Devolucao",
  EXTRAORDINARY: "Extraordinaria"
};

export const inspectionStatusLabels: Record<InspectionStatus, string> = {
  DRAFT: "Rascunho",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluida",
  CANCELLED: "Cancelada"
};

export const inspectionConditionLabels: Record<InspectionItemCondition, string> = {
  OK: "OK",
  DAMAGED: "Avariado",
  MISSING: "Ausente",
  NEEDS_MAINTENANCE: "Precisa manutencao",
  NOT_APPLICABLE: "Nao aplicavel",
  NOT_CHECKED: "Nao verificado"
};

export const fuelLevelLabels: Record<FuelLevel, string> = {
  EMPTY: "Vazio",
  RESERVE: "Reserva",
  ONE_QUARTER: "1/4",
  HALF: "1/2",
  THREE_QUARTERS: "3/4",
  FULL: "Cheio"
};

export const inspectionPhotoTypeLabels: Record<InspectionPhotoType, string> = {
  FRONT: "Frente",
  REAR: "Traseira",
  LEFT_SIDE: "Lateral esquerda",
  RIGHT_SIDE: "Lateral direita",
  ODOMETER: "Hodometro",
  PLATE: "Placa",
  ENGINE: "Motor",
  FRONT_TIRE: "Pneu dianteiro",
  REAR_TIRE: "Pneu traseiro",
  DAMAGE: "Avaria",
  ACCESSORY: "Acessorio",
  SIGNATURE: "Assinatura",
  OTHER: "Outro"
};

export const inspectionSignatureTypeLabels: Record<InspectionSignatureType, string> = {
  CUSTOMER: "Cliente",
  EMPLOYEE: "Responsavel"
};

export const damageSeverityLabels: Record<DamageSeverity, string> = {
  LOW: "Baixa",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Critica"
};

export const damageStatusLabels: Record<DamageStatus, string> = {
  OPEN: "Aberta",
  UNDER_REVIEW: "Em analise",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  CHARGED: "Cobrada",
  REPAIRED: "Reparada",
  CANCELLED: "Cancelada"
};

export const damageResponsiblePartyLabels: Record<DamageResponsibleParty, string> = {
  CUSTOMER: "Cliente",
  COMPANY: "Empresa",
  THIRD_PARTY: "Terceiro",
  UNDEFINED: "Nao definido"
};

export const additionalChargeTypeLabels: Record<AdditionalChargeType, string> = {
  DAMAGE: "Avaria",
  MISSING_ACCESSORY: "Acessorio ausente",
  MILEAGE_EXCESS: "Excesso de km",
  FUEL_DIFFERENCE: "Diferenca de combustivel",
  FINE: "Multa",
  OTHER: "Outro"
};

export const additionalChargeStatusLabels: Record<AdditionalChargeStatus, string> = {
  PENDING: "Pendente",
  PARTIALLY_PAID: "Parcialmente paga",
  PAID: "Paga",
  CANCELLED: "Cancelada",
  OVERDUE: "Vencida"
};

export const installmentStatusLabels: Record<InstallmentStatus, string> = {
  PENDING: "Pendente",
  PAID: "Paga",
  OVERDUE: "Atrasada",
  PARTIALLY_PAID: "Parcial",
  CANCELLED: "Cancelada"
};

export const contractTypeLabels: Record<ContractType, string> = {
  RENTAL: "Aluguel comum",
  RENT_TO_OWN: "Aluguel com compra"
};

export const billingFrequencyLabels: Record<BillingFrequency, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal"
};

export const weekDayLabels: Record<WeekDay, string> = {
  SUNDAY: "Domingo",
  MONDAY: "Segunda-feira",
  TUESDAY: "Terca-feira",
  WEDNESDAY: "Quarta-feira",
  THURSDAY: "Quinta-feira",
  FRIDAY: "Sexta-feira",
  SATURDAY: "Sabado"
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CASH: "Dinheiro",
  TRANSFER: "Transferencia",
  CARD: "Cartao",
  BOLETO: "Boleto",
  OTHER: "Outro"
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  CONFIRMED: "Confirmado",
  REVERSED: "Estornado"
};

export const maintenanceTypeLabels: Record<MaintenanceType, string> = {
  PREVENTIVE: "Preventiva",
  CORRECTIVE: "Corretiva",
  OIL_CHANGE: "Troca de oleo",
  TIRES: "Pneus",
  BRAKES: "Freios",
  CHAIN: "Relacao",
  ELECTRICAL: "Eletrica",
  INSPECTION: "Revisao",
  OTHER: "Outro"
};

export const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  SCHEDULED: "Agendada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluida",
  CANCELLED: "Cancelada"
};

export const documentStatusLabels: Record<DocumentStatus, string> = {
  VALID: "Valido",
  EXPIRING_SOON: "Vencendo",
  EXPIRED: "Vencido",
  ARCHIVED: "Arquivado"
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  PAYMENT: "Pagamento",
  MAINTENANCE: "Manutencao",
  DOCUMENT: "Documento",
  CONTRACT: "Contrato",
  GENERAL: "Comunicado"
};

export const priorityLabels: Record<NotificationPriority, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente"
};
