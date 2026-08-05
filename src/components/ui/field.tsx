import { cn } from "@/lib/utils";

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
  className?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
};

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  className,
  min,
  max,
  step
}: FieldProps) {
  return (
    <label className={cn("grid gap-1.5 text-sm font-medium text-slate-700", className)}>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        step={step}
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-asphalt outline-none transition placeholder:text-slate-400 focus:border-petrol focus:ring-2 focus:ring-petrol/15"
      />
    </label>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  placeholder,
  className,
  rows = 4
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  className?: string;
  rows?: number;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm font-medium text-slate-700", className)}>
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        rows={rows}
        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-asphalt outline-none transition placeholder:text-slate-400 focus:border-petrol focus:ring-2 focus:ring-petrol/15"
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  children,
  required,
  className
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm font-medium text-slate-700", className)}>
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-asphalt outline-none transition focus:border-petrol focus:ring-2 focus:ring-petrol/15"
      >
        {children}
      </select>
    </label>
  );
}
