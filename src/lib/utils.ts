import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function onlyDigits(value: FormDataEntryValue | string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

export function nullableString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

export function requiredString(value: FormDataEntryValue | null, field: string) {
  const text = nullableString(value);
  if (!text) {
    throw new Error(`${field} e obrigatorio.`);
  }
  return text;
}

export function numberFromForm(value: FormDataEntryValue | null, field: string) {
  const text = String(value ?? "").replace(",", ".").trim();
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${field} deve ser um numero valido.`);
  }
  return parsed;
}

export function intFromForm(value: FormDataEntryValue | null, field: string) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${field} deve ser um numero inteiro valido.`);
  }
  return parsed;
}

export function optionalIntFromForm(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  const parsed = Number.parseInt(text, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

export function dateFromInput(value: FormDataEntryValue | string | null, field = "Data") {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`${field} deve estar preenchida.`);
  }
  const [year, month, day] = text.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function optionalDateFromInput(value: FormDataEntryValue | string | null) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  return dateFromInput(text);
}
