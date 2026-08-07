import type { CompanyLicensePlan, CompanyStatus } from "@prisma/client";

export type CompanyLicenseInput = {
  status: CompanyStatus;
  licensePlan: CompanyLicensePlan;
  licenseStartsAt?: Date | string | null;
  licenseExpiresAt?: Date | string | null;
};

export type CompanyLicenseState = "ACTIVE" | "TRIAL" | "EXPIRED" | "LIFETIME" | "INACTIVE" | "BLOCKED";

export const companyLicensePlanDays: Record<Exclude<CompanyLicensePlan, "LIFETIME">, number> = {
  FREE_30: 30,
  THIRTY_DAYS: 30,
  NINETY_DAYS: 90,
  ANNUAL: 365
};

function asDate(value: Date | string | null | undefined) {
  return value ? new Date(value) : null;
}

export function getCompanyLicenseEndDate(
  plan: CompanyLicensePlan,
  startsAt: Date,
  customExpiresAt?: Date | string | null
) {
  if (plan === "LIFETIME") {
    return null;
  }

  const custom = asDate(customExpiresAt);
  if (custom) {
    return custom;
  }

  const expiresAt = new Date(startsAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + companyLicensePlanDays[plan]);
  return expiresAt;
}

export function normalizeLicenseExpirationForInput(value: Date | string | null | undefined) {
  const date = asDate(value);
  if (!date) {
    return null;
  }

  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23,
    59,
    59,
    999
  ));
}

export function subscriptionStatusForPlan(plan: CompanyLicensePlan, expiresAt: Date | null, at = new Date()) {
  if (plan === "LIFETIME") {
    return "lifetime";
  }
  if (expiresAt && expiresAt.getTime() < at.getTime()) {
    return "expired";
  }
  return plan === "FREE_30" ? "trial" : "active";
}

export function getCompanyLicenseState(company: CompanyLicenseInput, at = new Date()): CompanyLicenseState {
  if (company.status === "BLOCKED") {
    return "BLOCKED";
  }

  if (company.status === "INACTIVE") {
    return "INACTIVE";
  }

  if (company.licensePlan === "LIFETIME") {
    return "LIFETIME";
  }

  const expiresAt = asDate(company.licenseExpiresAt);
  if (expiresAt && expiresAt.getTime() < at.getTime()) {
    return "EXPIRED";
  }

  return company.licensePlan === "FREE_30" || company.status === "TRIAL" ? "TRIAL" : "ACTIVE";
}

export function canCompanyAccessSystem(company: CompanyLicenseInput, at = new Date()) {
  const state = getCompanyLicenseState(company, at);

  if (state === "BLOCKED") {
    return { allowed: false, state, reason: "Empresa bloqueada. Fale com o administrador." };
  }

  if (state === "INACTIVE") {
    return { allowed: false, state, reason: "Empresa inativa. Fale com o administrador." };
  }

  if (state === "EXPIRED") {
    return { allowed: false, state, reason: "Licenca vencida. Fale com o administrador." };
  }

  return { allowed: true, state, reason: null };
}

export function daysUntilLicenseExpiration(company: Pick<CompanyLicenseInput, "licenseExpiresAt">, at = new Date()) {
  const expiresAt = asDate(company.licenseExpiresAt);
  if (!expiresAt) {
    return null;
  }

  return Math.ceil((expiresAt.getTime() - at.getTime()) / (1000 * 60 * 60 * 24));
}
