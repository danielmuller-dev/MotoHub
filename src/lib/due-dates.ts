export type BillingFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";
export type MonthlyOverflowRule = "LAST_VALID_DAY" | "NEXT_MONTH_FIRST_DAY";
export type WeekDay =
  | "SUNDAY"
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY";

const weekDayIndex: Record<WeekDay, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
};

export type GenerateDueDatesInput = {
  billingFrequency: BillingFrequency;
  firstDueDate: Date | string;
  totalInstallments: number;
  weeklyDueDay?: WeekDay | null;
  monthlyDueDay?: number | null;
  monthlyOverflowRule?: MonthlyOverflowRule | null;
};

export type InstallmentPreviewItem = {
  number: number;
  dueDate: Date;
  weekday: WeekDay;
  amount: number;
};

export function normalizeDateOnly(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new Error("Data invalida.");
  }
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12)
  );
}

export function addDaysUtc(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return normalizeDateOnly(next);
}

export function getWeekDay(date: Date): WeekDay {
  const index = date.getUTCDay();
  return (Object.keys(weekDayIndex) as WeekDay[]).find(
    (day) => weekDayIndex[day] === index
  )!;
}

export function nextWeekdayAfter(date: Date, target: WeekDay) {
  const targetIndex = weekDayIndex[target];
  let diff = (targetIndex - date.getUTCDay() + 7) % 7;
  if (diff === 0) {
    diff = 7;
  }
  return addDaysUtc(date, diff);
}

export function daysInMonth(year: number, zeroBasedMonth: number) {
  return new Date(Date.UTC(year, zeroBasedMonth + 1, 0)).getUTCDate();
}

function dateFromYearMonthDay(year: number, zeroBasedMonth: number, day: number) {
  return normalizeDateOnly(new Date(Date.UTC(year, zeroBasedMonth, day, 12)));
}

export function monthlyDueDate(
  baseYear: number,
  baseZeroBasedMonth: number,
  dueDay: number,
  overflowRule: MonthlyOverflowRule
) {
  const year = baseYear + Math.floor(baseZeroBasedMonth / 12);
  const month = ((baseZeroBasedMonth % 12) + 12) % 12;
  const maxDay = daysInMonth(year, month);

  if (dueDay <= maxDay) {
    return dateFromYearMonthDay(year, month, dueDay);
  }

  if (overflowRule === "NEXT_MONTH_FIRST_DAY") {
    return dateFromYearMonthDay(year, month + 1, 1);
  }

  return dateFromYearMonthDay(year, month, maxDay);
}

export function validateDueDateRule(input: GenerateDueDatesInput) {
  if (!Number.isInteger(input.totalInstallments) || input.totalInstallments <= 0) {
    throw new Error("A quantidade de parcelas deve ser maior que zero.");
  }

  if (input.billingFrequency === "WEEKLY" && !input.weeklyDueDay) {
    throw new Error("Contrato semanal exige o dia da semana do vencimento.");
  }

  if (input.billingFrequency === "BIWEEKLY" && !input.firstDueDate) {
    throw new Error("Contrato quinzenal exige a primeira data de vencimento.");
  }

  if (input.billingFrequency === "MONTHLY") {
    if (!input.monthlyDueDay || input.monthlyDueDay < 1 || input.monthlyDueDay > 31) {
      throw new Error("Contrato mensal exige um dia do mes entre 1 e 31.");
    }
  }

  if (input.billingFrequency !== "WEEKLY" && input.weeklyDueDay) {
    throw new Error("Dia da semana so pode ser usado em contrato semanal.");
  }

  if (input.billingFrequency !== "MONTHLY" && input.monthlyDueDay) {
    throw new Error("Dia do mes so pode ser usado em contrato mensal.");
  }
}

export function generateDueDates(input: GenerateDueDatesInput) {
  validateDueDateRule(input);

  const first = normalizeDateOnly(input.firstDueDate);
  const dates: Date[] = [first];

  if (input.billingFrequency === "WEEKLY") {
    for (let index = 1; index < input.totalInstallments; index += 1) {
      dates.push(nextWeekdayAfter(dates[index - 1], input.weeklyDueDay!));
    }
  }

  if (input.billingFrequency === "BIWEEKLY") {
    for (let index = 1; index < input.totalInstallments; index += 1) {
      dates.push(addDaysUtc(dates[index - 1], 14));
    }
  }

  if (input.billingFrequency === "MONTHLY") {
    const rule = input.monthlyOverflowRule ?? "LAST_VALID_DAY";
    let monthCursor = first.getUTCMonth() + 1;
    const baseYear = first.getUTCFullYear();

    while (dates.length < input.totalInstallments) {
      const candidate = monthlyDueDate(
        baseYear,
        monthCursor,
        input.monthlyDueDay!,
        rule
      );
      monthCursor += 1;

      if (candidate.getTime() > dates[dates.length - 1].getTime()) {
        dates.push(candidate);
      }
    }
  }

  return dates;
}

export function generateInstallmentPreview(
  input: GenerateDueDatesInput & { amount: number; limit?: number }
): InstallmentPreviewItem[] {
  return generateDueDates({
    billingFrequency: input.billingFrequency,
    firstDueDate: input.firstDueDate,
    totalInstallments: Math.min(input.totalInstallments, input.limit ?? 6),
    weeklyDueDay: input.weeklyDueDay,
    monthlyDueDay: input.monthlyDueDay,
    monthlyOverflowRule: input.monthlyOverflowRule
  }).map((dueDate, index) => ({
    number: index + 1,
    dueDate,
    weekday: getWeekDay(dueDate),
    amount: input.amount
  }));
}
