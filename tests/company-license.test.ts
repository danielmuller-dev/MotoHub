import { describe, expect, it } from "vitest";
import {
  canCompanyAccessSystem,
  daysUntilLicenseExpiration,
  getCompanyLicenseEndDate,
  getCompanyLicenseState,
  subscriptionStatusForPlan
} from "../src/lib/company-license";

const start = new Date("2026-08-07T12:00:00.000Z");

describe("company license rules", () => {
  it("calcula vencimento dos planos com prazo", () => {
    expect(getCompanyLicenseEndDate("FREE_30", start)?.toISOString()).toBe("2026-09-06T12:00:00.000Z");
    expect(getCompanyLicenseEndDate("THIRTY_DAYS", start)?.toISOString()).toBe("2026-09-06T12:00:00.000Z");
    expect(getCompanyLicenseEndDate("NINETY_DAYS", start)?.toISOString()).toBe("2026-11-05T12:00:00.000Z");
    expect(getCompanyLicenseEndDate("ANNUAL", start)?.toISOString()).toBe("2027-08-07T12:00:00.000Z");
  });

  it("plano vitalicio nao possui vencimento", () => {
    expect(getCompanyLicenseEndDate("LIFETIME", start)).toBeNull();
  });

  it("mantem customizacao manual de vencimento", () => {
    expect(
      getCompanyLicenseEndDate("THIRTY_DAYS", start, new Date("2026-12-31T23:59:59.999Z"))?.toISOString()
    ).toBe("2026-12-31T23:59:59.999Z");
  });

  it("classifica licenca gratuita como teste", () => {
    expect(
      getCompanyLicenseState({
        status: "TRIAL",
        licensePlan: "FREE_30",
        licenseExpiresAt: new Date("2026-09-06T12:00:00.000Z")
      }, start)
    ).toBe("TRIAL");
  });

  it("bloqueia empresa expirada sem apagar dados", () => {
    const access = canCompanyAccessSystem({
      status: "ACTIVE",
      licensePlan: "THIRTY_DAYS",
      licenseExpiresAt: new Date("2026-08-01T12:00:00.000Z")
    }, start);

    expect(access.allowed).toBe(false);
    expect(access.state).toBe("EXPIRED");
  });

  it("permite empresa vitalicia e empresa paga dentro do prazo", () => {
    expect(canCompanyAccessSystem({ status: "ACTIVE", licensePlan: "LIFETIME", licenseExpiresAt: null }, start).allowed).toBe(true);
    expect(
      canCompanyAccessSystem({
        status: "ACTIVE",
        licensePlan: "ANNUAL",
        licenseExpiresAt: new Date("2027-08-07T12:00:00.000Z")
      }, start).allowed
    ).toBe(true);
  });

  it("bloqueia status inativo ou bloqueado mesmo com licenca valida", () => {
    expect(canCompanyAccessSystem({ status: "INACTIVE", licensePlan: "LIFETIME", licenseExpiresAt: null }, start).allowed).toBe(false);
    expect(canCompanyAccessSystem({ status: "BLOCKED", licensePlan: "LIFETIME", licenseExpiresAt: null }, start).allowed).toBe(false);
  });

  it("calcula status legado para compatibilidade", () => {
    expect(subscriptionStatusForPlan("FREE_30", new Date("2026-09-06T12:00:00.000Z"), start)).toBe("trial");
    expect(subscriptionStatusForPlan("ANNUAL", new Date("2027-08-07T12:00:00.000Z"), start)).toBe("active");
    expect(subscriptionStatusForPlan("LIFETIME", null, start)).toBe("lifetime");
    expect(subscriptionStatusForPlan("THIRTY_DAYS", new Date("2026-08-01T12:00:00.000Z"), start)).toBe("expired");
  });

  it("mostra dias restantes ate o vencimento", () => {
    expect(daysUntilLicenseExpiration({ licenseExpiresAt: new Date("2026-08-17T12:00:00.000Z") }, start)).toBe(10);
    expect(daysUntilLicenseExpiration({ licenseExpiresAt: null }, start)).toBeNull();
  });
});
