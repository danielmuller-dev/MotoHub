import { describe, expect, it } from "vitest";
import { generateDueDates, getWeekDay } from "../src/lib/due-dates";

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

describe("generateDueDates", () => {
  it("gera contrato semanal toda quinta-feira", () => {
    const dates = generateDueDates({
      billingFrequency: "WEEKLY",
      firstDueDate: "2026-08-06",
      weeklyDueDay: "THURSDAY",
      totalInstallments: 4
    });

    expect(dates.map(iso)).toEqual(["2026-08-06", "2026-08-13", "2026-08-20", "2026-08-27"]);
    expect(dates.every((date) => getWeekDay(date) === "THURSDAY")).toBe(true);
  });

  it("gera semanal quando o primeiro vencimento foi escolhido apos outro dia de inicio", () => {
    const dates = generateDueDates({
      billingFrequency: "WEEKLY",
      firstDueDate: "2026-08-13",
      weeklyDueDay: "THURSDAY",
      totalInstallments: 3
    });

    expect(dates.map(iso)).toEqual(["2026-08-13", "2026-08-20", "2026-08-27"]);
  });

  it("gera contrato quinzenal", () => {
    const dates = generateDueDates({
      billingFrequency: "BIWEEKLY",
      firstDueDate: "2026-08-05",
      totalInstallments: 4
    });

    expect(dates.map(iso)).toEqual(["2026-08-05", "2026-08-19", "2026-09-02", "2026-09-16"]);
  });

  it("gera contrato mensal no dia 10", () => {
    const dates = generateDueDates({
      billingFrequency: "MONTHLY",
      firstDueDate: "2026-01-10",
      monthlyDueDay: 10,
      totalInstallments: 4
    });

    expect(dates.map(iso)).toEqual(["2026-01-10", "2026-02-10", "2026-03-10", "2026-04-10"]);
  });

  it("gera contrato mensal no dia 31 usando ultimo dia valido", () => {
    const dates = generateDueDates({
      billingFrequency: "MONTHLY",
      firstDueDate: "2026-01-31",
      monthlyDueDay: 31,
      monthlyOverflowRule: "LAST_VALID_DAY",
      totalInstallments: 4
    });

    expect(dates.map(iso)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("respeita fevereiro em ano bissexto", () => {
    const dates = generateDueDates({
      billingFrequency: "MONTHLY",
      firstDueDate: "2024-01-31",
      monthlyDueDay: 31,
      monthlyOverflowRule: "LAST_VALID_DAY",
      totalInstallments: 3
    });

    expect(dates.map(iso)).toEqual(["2024-01-31", "2024-02-29", "2024-03-31"]);
  });

  it("permite escolher primeiro dia do mes seguinte quando nao existe o dia mensal", () => {
    const dates = generateDueDates({
      billingFrequency: "MONTHLY",
      firstDueDate: "2026-01-31",
      monthlyDueDay: 31,
      monthlyOverflowRule: "NEXT_MONTH_FIRST_DAY",
      totalInstallments: 3
    });

    expect(dates.map(iso)).toEqual(["2026-01-31", "2026-03-01", "2026-03-31"]);
  });
});
