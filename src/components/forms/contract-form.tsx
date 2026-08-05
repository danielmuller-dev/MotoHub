"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { ClipboardCheck } from "lucide-react";
import { createContractAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  BillingFrequency,
  MonthlyOverflowRule,
  WeekDay,
  generateInstallmentPreview
} from "@/lib/due-dates";
import { formatCurrency, formatDate, weekDayLabels } from "@/lib/format";

type Option = {
  id: string;
  label: string;
  helper?: string;
};

type ContractFormValues = {
  customerId: string;
  motorcycleId: string;
  type: "RENTAL" | "RENT_TO_OWN";
  startDate: string;
  expectedEndDate: string;
  billingFrequency: BillingFrequency;
  firstDueDate: string;
  weeklyDueDay: WeekDay | "";
  monthlyDueDay: number | "";
  monthlyOverflowRule: MonthlyOverflowRule;
  installmentAmount: number;
  totalInstallments: number;
  downPayment: number;
  lateInterestAmount: number;
  lateFeeAmount: number;
  gracePeriodDays: number;
  initialMileage: number | "";
  mileageLimit: number | "";
  depositAmount: number | "";
  notes: string;
  customTerms: string;
};

const inputClass =
  "h-10 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-petrol focus:ring-2 focus:ring-petrol/15";
const labelClass = "grid gap-1.5 text-sm font-medium text-slate-700";

export function ContractForm({
  customers,
  motorcycles
}: {
  customers: Option[];
  motorcycles: Option[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const { register, watch } = useForm<ContractFormValues>({
    defaultValues: {
      type: "RENT_TO_OWN",
      billingFrequency: "WEEKLY",
      weeklyDueDay: "THURSDAY",
      monthlyOverflowRule: "LAST_VALID_DAY",
      startDate: today,
      firstDueDate: today,
      installmentAmount: 370,
      totalInstallments: 100,
      downPayment: 0,
      lateInterestAmount: 0,
      lateFeeAmount: 0,
      gracePeriodDays: 0
    }
  });

  const frequency = watch("billingFrequency");
  const firstDueDate = watch("firstDueDate");
  const amount = Number(watch("installmentAmount") || 0);
  const total = Number(watch("totalInstallments") || 0);
  const weeklyDueDay = watch("weeklyDueDay");
  const monthlyDueDay = watch("monthlyDueDay");
  const monthlyOverflowRule = watch("monthlyOverflowRule");

  const preview = useMemo(() => {
    try {
      if (!firstDueDate || !total || !amount) {
        return [];
      }

      return generateInstallmentPreview({
        billingFrequency: frequency,
        firstDueDate,
        totalInstallments: total,
        amount,
        limit: 8,
        weeklyDueDay: frequency === "WEEKLY" ? weeklyDueDay || undefined : undefined,
        monthlyDueDay: frequency === "MONTHLY" ? Number(monthlyDueDay) : undefined,
        monthlyOverflowRule
      });
    } catch {
      return [];
    }
  }, [amount, firstDueDate, frequency, monthlyDueDay, monthlyOverflowRule, total, weeklyDueDay]);

  return (
    <form action={createContractAction} className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className={labelClass}>
          Cliente
          <select {...register("customerId")} className={inputClass} required>
            <option value="">Selecione</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Moto disponivel
          <select {...register("motorcycleId")} className={inputClass} required>
            <option value="">Selecione</option>
            {motorcycles.map((motorcycle) => (
              <option key={motorcycle.id} value={motorcycle.id}>
                {motorcycle.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className={labelClass}>
          Tipo
          <select {...register("type")} className={inputClass}>
            <option value="RENTAL">Aluguel comum</option>
            <option value="RENT_TO_OWN">Aluguel com intencao de compra</option>
          </select>
        </label>
        <label className={labelClass}>
          Inicio
          <input {...register("startDate")} type="date" className={inputClass} required />
        </label>
        <label className={labelClass}>
          Termino previsto
          <input {...register("expectedEndDate")} type="date" className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <label className={labelClass}>
          Frequencia
          <select {...register("billingFrequency")} className={inputClass}>
            <option value="WEEKLY">Semanal</option>
            <option value="BIWEEKLY">Quinzenal</option>
            <option value="MONTHLY">Mensal</option>
          </select>
        </label>
        <label className={labelClass}>
          Primeiro vencimento
          <input {...register("firstDueDate")} type="date" className={inputClass} required />
        </label>
        {frequency === "WEEKLY" ? (
          <label className={labelClass}>
            Dia da semana
            <select {...register("weeklyDueDay")} className={inputClass} required>
              {Object.entries(weekDayLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {frequency === "MONTHLY" ? (
          <>
            <label className={labelClass}>
              Dia do mes
              <input {...register("monthlyDueDay")} type="number" min={1} max={31} className={inputClass} required />
            </label>
            <label className={labelClass}>
              Mes sem o dia
              <select {...register("monthlyOverflowRule")} className={inputClass}>
                <option value="LAST_VALID_DAY">Ultimo dia valido</option>
                <option value="NEXT_MONTH_FIRST_DAY">Primeiro dia seguinte</option>
              </select>
            </label>
          </>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <label className={labelClass}>
          Valor da parcela
          <input {...register("installmentAmount", { valueAsNumber: true })} type="number" min="0.01" step="0.01" className={inputClass} required />
        </label>
        <label className={labelClass}>
          Total de parcelas
          <input {...register("totalInstallments", { valueAsNumber: true })} type="number" min={1} max={260} className={inputClass} required />
        </label>
        <label className={labelClass}>
          Entrada
          <input {...register("downPayment", { valueAsNumber: true })} type="number" min={0} step="0.01" className={inputClass} />
        </label>
        <label className={labelClass}>
          Caucao
          <input {...register("depositAmount", { valueAsNumber: true })} type="number" min={0} step="0.01" className={inputClass} />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <label className={labelClass}>
          Multa atraso
          <input {...register("lateFeeAmount", { valueAsNumber: true })} type="number" min={0} step="0.01" className={inputClass} />
        </label>
        <label className={labelClass}>
          Juros atraso
          <input {...register("lateInterestAmount", { valueAsNumber: true })} type="number" min={0} step="0.01" className={inputClass} />
        </label>
        <label className={labelClass}>
          Tolerancia
          <input {...register("gracePeriodDays", { valueAsNumber: true })} type="number" min={0} className={inputClass} />
        </label>
        <label className={labelClass}>
          Km inicial
          <input {...register("initialMileage", { valueAsNumber: true })} type="number" min={0} className={inputClass} />
        </label>
      </div>

      <label className={labelClass}>
        Limite de quilometragem
        <input {...register("mileageLimit", { valueAsNumber: true })} type="number" min={0} className={inputClass} />
      </label>
      <label className={labelClass}>
        Observacoes
        <textarea {...register("notes")} rows={3} className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-petrol focus:ring-2 focus:ring-petrol/15" />
      </label>
      <label className={labelClass}>
        Termos personalizados
        <textarea {...register("customTerms")} rows={4} className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-petrol focus:ring-2 focus:ring-petrol/15" />
      </label>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-asphalt">Previa das primeiras parcelas</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Parcela</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Dia</th>
                <th className="px-3 py-2">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {preview.map((item) => (
                <tr key={item.number}>
                  <td className="px-3 py-2">{item.number}</td>
                  <td className="px-3 py-2">{formatDate(item.dueDate)}</td>
                  <td className="px-3 py-2">{weekDayLabels[item.weekday]}</td>
                  <td className="px-3 py-2">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Button type="submit">
        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
        Criar e ativar contrato
      </Button>
    </form>
  );
}
