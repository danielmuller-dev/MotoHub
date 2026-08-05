import Link from "next/link";
import {
  Bike,
  CalendarClock,
  ClipboardList,
  CreditCard,
  Plus,
  ReceiptText,
  Users,
  Wrench
} from "lucide-react";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { InstallmentStatusBadge, MotorcycleStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { requireCompanyRole } from "@/lib/auth";
import { formatCurrency, formatDate, shortDateFormatter } from "@/lib/format";
import { enumerateDays, getPeriodRange } from "@/lib/periods";
import { prisma } from "@/lib/prisma";
import { updateOverdueInstallments } from "@/services/installments";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireCompanyRole();
  await updateOverdueInstallments(user.companyId!);
  const period = getPeriodRange(params.period, params.start, params.end);
  const today = new Date();
  const documentsSoon = new Date(today);
  documentsSoon.setUTCDate(documentsSoon.getUTCDate() + 30);

  const [
    totalMotorcycles,
    availableMotorcycles,
    rentedMotorcycles,
    maintenanceMotorcycles,
    activeCustomers,
    activeContracts,
    overdueContracts,
    dueToday,
    overdueInstallments,
    expectedPeriod,
    receivedPeriod,
    receivedMonth,
    recentPayments,
    overdueList,
    upcomingInstallments,
    upcomingMaintenances,
    expiringDocuments,
    periodPayments
  ] = await Promise.all([
    prisma.motorcycle.count({ where: { companyId: user.companyId!, deletedAt: null } }),
    prisma.motorcycle.count({ where: { companyId: user.companyId!, status: "AVAILABLE", deletedAt: null } }),
    prisma.motorcycle.count({ where: { companyId: user.companyId!, status: "RENTED", deletedAt: null } }),
    prisma.motorcycle.count({ where: { companyId: user.companyId!, status: "MAINTENANCE", deletedAt: null } }),
    prisma.customer.count({ where: { companyId: user.companyId!, status: "ACTIVE", deletedAt: null } }),
    prisma.contract.count({ where: { companyId: user.companyId!, status: { in: ["ACTIVE", "OVERDUE", "SUSPENDED"] } } }),
    prisma.contract.count({ where: { companyId: user.companyId!, status: "OVERDUE" } }),
    prisma.installment.count({
      where: {
        companyId: user.companyId!,
        dueDate: {
          gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0)),
          lte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59))
        },
        status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] }
      }
    }),
    prisma.installment.count({
      where: {
        companyId: user.companyId!,
        dueDate: { lt: new Date() },
        status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] }
      }
    }),
    prisma.installment.aggregate({
      where: {
        companyId: user.companyId!,
        dueDate: { gte: period.start, lte: period.end },
        status: { not: "CANCELLED" }
      },
      _sum: { finalAmount: true }
    }),
    prisma.payment.aggregate({
      where: {
        companyId: user.companyId!,
        paymentDate: { gte: period.start, lte: period.end }
      },
      _sum: { amountPaid: true }
    }),
    prisma.payment.aggregate({
      where: {
        companyId: user.companyId!,
        paymentDate: {
          gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12)),
          lte: new Date()
        }
      },
      _sum: { amountPaid: true }
    }),
    prisma.payment.findMany({
      where: { companyId: user.companyId! },
      orderBy: { paymentDate: "desc" },
      take: 6,
      include: { customer: true, installment: true }
    }),
    prisma.installment.findMany({
      where: {
        companyId: user.companyId!,
        dueDate: { lt: new Date() },
        status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] }
      },
      orderBy: { dueDate: "asc" },
      take: 6,
      include: { contract: { include: { customer: true, motorcycle: true } } }
    }),
    prisma.installment.findMany({
      where: {
        companyId: user.companyId!,
        dueDate: { gte: new Date() },
        status: { in: ["PENDING", "PARTIALLY_PAID"] }
      },
      orderBy: { dueDate: "asc" },
      take: 6,
      include: { contract: { include: { customer: true, motorcycle: true } } }
    }),
    prisma.maintenance.findMany({
      where: {
        companyId: user.companyId!,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] }
      },
      orderBy: { date: "asc" },
      take: 5,
      include: { motorcycle: true }
    }),
    prisma.document.findMany({
      where: {
        companyId: user.companyId!,
        expirationDate: {
          gte: new Date(),
          lte: documentsSoon
        }
      },
      orderBy: { expirationDate: "asc" },
      take: 5
    }),
    prisma.payment.findMany({
      where: {
        companyId: user.companyId!,
        paymentDate: { gte: period.start, lte: period.end }
      },
      select: { amountPaid: true, paymentDate: true }
    })
  ]);

  const days = enumerateDays(period.start, period.end).slice(-14);
  const chartData = days.map((day) => {
    const total = periodPayments
      .filter((payment) => {
        const paidAt = payment.paymentDate;
        return (
          paidAt.getUTCFullYear() === day.getUTCFullYear() &&
          paidAt.getUTCMonth() === day.getUTCMonth() &&
          paidAt.getUTCDate() === day.getUTCDate()
        );
      })
      .reduce((sum, payment) => sum + payment.amountPaid.toNumber(), 0);

    return {
      label: shortDateFormatter.format(day),
      value: total
    };
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Indicadores de ${user.company?.tradeName || user.company?.legalName}.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex h-10 items-center gap-2 rounded-md bg-asphalt px-4 text-sm font-medium text-white hover:bg-graphite" href="/customers">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Cliente
            </Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50" href="/contracts">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Contrato
            </Link>
          </div>
        }
      />

      <form className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Periodo
          <select name="period" defaultValue={period.key} className="h-10 rounded-md border border-slate-200 px-3">
            <option value="today">Hoje</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Inicio
          <input name="start" type="date" defaultValue={params.start ?? ""} className="h-10 rounded-md border border-slate-200 px-3" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Fim
          <input name="end" type="date" defaultValue={params.end ?? ""} className="h-10 rounded-md border border-slate-200 px-3" />
        </label>
        <Button type="submit" variant="secondary">Filtrar</Button>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de motos" value={totalMotorcycles} icon={Bike} />
        <StatCard label="Disponiveis" value={availableMotorcycles} icon={Bike} />
        <StatCard label="Alugadas" value={rentedMotorcycles} icon={Bike} />
        <StatCard label="Em manutencao" value={maintenanceMotorcycles} icon={Wrench} />
        <StatCard label="Clientes ativos" value={activeCustomers} icon={Users} />
        <StatCard label="Contratos ativos" value={activeContracts} icon={ClipboardList} />
        <StatCard label="Contratos atrasados" value={overdueContracts} icon={CalendarClock} />
        <StatCard label="Parcelas vencendo hoje" value={dueToday} icon={ReceiptText} />
        <StatCard label="Parcelas atrasadas" value={overdueInstallments} icon={ReceiptText} />
        <StatCard label="Previsto no periodo" value={formatCurrency(expectedPeriod._sum.finalAmount)} icon={CreditCard} />
        <StatCard label="Recebido no periodo" value={formatCurrency(receivedPeriod._sum.amountPaid)} icon={CreditCard} />
        <StatCard label="Recebido no mes" value={formatCurrency(receivedMonth._sum.amountPaid)} icon={CreditCard} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader title="Recebimentos por periodo" />
          <CardContent>
            <RevenueChart data={chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Pagamentos recentes" />
          <CardContent className="grid gap-3">
            {recentPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-4 rounded-md border border-slate-100 p-3">
                <div>
                  <p className="font-medium text-asphalt">{payment.customer.fullName}</p>
                  <p className="text-xs text-slate-500">
                    Parcela {payment.installment?.number ?? "-"} | {formatDate(payment.paymentDate)}
                  </p>
                </div>
                <p className="font-semibold text-petrol">{formatCurrency(payment.amountPaid)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Parcelas atrasadas" />
          <CardContent className="grid gap-3">
            {overdueList.map((installment) => (
              <Link href={`/contracts/${installment.contractId}`} key={installment.id} className="rounded-md border border-slate-100 p-3 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{installment.contract.customer.fullName}</p>
                  <InstallmentStatusBadge status={installment.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {installment.contract.motorcycle.plate} | venceu em {formatDate(installment.dueDate)}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Proximos vencimentos" />
          <CardContent className="grid gap-3">
            {upcomingInstallments.map((installment) => (
              <Link href={`/contracts/${installment.contractId}`} key={installment.id} className="rounded-md border border-slate-100 p-3 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{installment.contract.customer.fullName}</p>
                  <p className="text-sm font-semibold">{formatCurrency(installment.finalAmount)}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(installment.dueDate)} | {installment.contract.motorcycle.plate}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Manutencoes e documentos" />
          <CardContent className="grid gap-3">
            {upcomingMaintenances.map((maintenance) => (
              <div key={maintenance.id} className="rounded-md border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{maintenance.motorcycle.plate}</p>
                  <MotorcycleStatusBadge status={maintenance.motorcycle.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {maintenance.description} | {formatDate(maintenance.date)}
                </p>
              </div>
            ))}
            {expiringDocuments.map((document) => (
              <div key={document.id} className="rounded-md border border-amber-100 bg-amber-50 p-3">
                <p className="font-medium text-amber-900">{document.name}</p>
                <p className="mt-1 text-xs text-amber-700">Vence em {formatDate(document.expirationDate)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
