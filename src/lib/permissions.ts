import { UserRole } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";

export function canManageCompany(user: CurrentUser) {
  return user.role === "SUPER_ADMIN" || user.role === "COMPANY_ADMIN";
}

export function canDeleteOperationalData(user: CurrentUser) {
  return user.role === "COMPANY_ADMIN";
}

export function isCompanyStaff(user: CurrentUser) {
  return user.role === "COMPANY_ADMIN" || user.role === "EMPLOYEE";
}

export function assertSameCompany(user: CurrentUser, companyId: string) {
  if (user.role === "SUPER_ADMIN") {
    return;
  }

  if (!user.companyId || user.companyId !== companyId) {
    throw new Error("Voce nao tem permissao para acessar dados desta empresa.");
  }
}

export function assertRole(user: CurrentUser, roles: UserRole[]) {
  if (!roles.includes(user.role)) {
    throw new Error("Voce nao tem permissao para executar esta acao.");
  }
}

export function assertCustomerSelf(user: CurrentUser, customerId: string) {
  if (user.role !== "CUSTOMER" || user.customerId !== customerId) {
    throw new Error("Cliente pode acessar apenas seus proprios dados.");
  }
}
