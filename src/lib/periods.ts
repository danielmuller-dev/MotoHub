import { normalizeDateOnly, addDaysUtc } from "@/lib/due-dates";

export type PeriodKey = "today" | "week" | "month" | "custom";

export function startOfUtcDay(date: Date) {
  return normalizeDateOnly(date);
}

export function endOfUtcDay(date: Date) {
  const normalized = normalizeDateOnly(date);
  return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), normalized.getUTCDate(), 23, 59, 59));
}

export function getPeriodRange(
  period: string | undefined,
  customStart?: string,
  customEnd?: string
) {
  const today = normalizeDateOnly(new Date());
  const key = (period || "week") as PeriodKey;

  if (key === "today") {
    return {
      key,
      start: startOfUtcDay(today),
      end: endOfUtcDay(today)
    };
  }

  if (key === "month") {
    return {
      key,
      start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12)),
      end: endOfUtcDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 12)))
    };
  }

  if (key === "custom" && customStart && customEnd) {
    return {
      key,
      start: normalizeDateOnly(customStart),
      end: endOfUtcDay(normalizeDateOnly(customEnd))
    };
  }

  return {
    key: "week" as const,
    start: addDaysUtc(today, -6),
    end: endOfUtcDay(today)
  };
}

export function enumerateDays(start: Date, end: Date) {
  const days: Date[] = [];
  let cursor = normalizeDateOnly(start);
  const last = normalizeDateOnly(end);

  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor);
    cursor = addDaysUtc(cursor, 1);
  }

  return days;
}
