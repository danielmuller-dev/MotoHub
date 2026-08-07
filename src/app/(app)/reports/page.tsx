import { PrintButton } from "@/components/ui/print-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { getPeriodRange } from "@/lib/periods";
import { prisma } from "@/lib/prisma";

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireCompanyRole(["COMPANY_ADMIN", "EMPLOYEE"]);
  const period = getPeriodRange(params.period, params.start, params.end);
  const now = new Date();
  const documentsSoon = new Date(now);
  documentsSoon.setUTCDate(documentsSoon.getUTCDate() + 30);

  const [
    payments,
    overdueInstallments,
    activeContracts,
    completedContracts,
    motorcycles,
    maintenanceCosts,
    expiredDocuments,
    expiringDocuments
  ] = await Promise.all([
    prisma.payment.findMany({
      where: {
        companyId: user.companyId!,
        status: "CONFIRMED",
        paymentDate: { gte: period.start, lte: period.end }
      }
    }),
    prisma.installment.findMany({
      where: { companyId: user.companyId!, status: "OVERDUE" },
      include: { contract: { include: { customer: true } } }
    }),
    prisma.contract.count({ where: { companyId: user.companyId!, status: { in: ["ACTIVE", "OVERDUE", "SUSPENDED"] } } }),
    prisma.contract.count({ where: { companyId: user.companyId!, status: "COMPLETED" } }),
    prisma.motorcycle.groupBy({ by: ["status"], where: { companyId: user.companyId!, deletedAt: null }, _count: true }),
    prisma.maintenance.aggregate({
      where: { companyId: user.companyId!, date: { gte: period.start, lte: period.end } },
      _sum: { amount: true }
    }),
    prisma.document.count({ where: { companyId: user.companyId!, expirationDate: { lt: now } } }),
    prisma.document.count({
      where: {
        companyId: user.companyId!,
        expirationDate: { gte: now, lte: documentsSoon }
      }
    })
  ]);

  const received = payments.reduce((sum, payment) => sum + payment.amountPaid.toNumber(), 0);
  const byMethod = payments.reduce<Record<string, number>>((acc, payment) => {
    acc[payment.method] = (acc[payment.method] ?? 0) + payment.amountPaid.toNumber();
    return acc;
  }, {});
  const motoCount = Object.fromEntries(motorcycles.map((item) => [item.status, item._count]));

  return (
    <>
      <PageHeader
        title="Relatorios"
        description="Relatorios simples em tela com filtros e impressao."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Relatorios" }]}
        action={<PrintButton />}
      />

      <form className="no-print mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
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
        <button className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50">Filtrar</button>
      </form>

      <div className="grid gap-6 xl:grid-cols-2">
        <ReportCard title="Recebimentos por periodo" rows={[
          ["Total recebido", formatCurrency(received)],
          ["Quantidade de pagamentos", payments.length],
          ...Object.entries(byMethod).map(([method, value]) => [`Forma ${method}`, formatCurrency(value)] as [string, string])
        ]} />
        <ReportCard title="Contratos" rows={[
          ["Ativos", activeContracts],
          ["Concluidos", completedContracts],
          ["Parcelas atrasadas", overdueInstallments.length],
          ["Clientes inadimplentes", new Set(overdueInstallments.map((item) => item.contract.customerId)).size]
        ]} />
        <ReportCard title="Motos" rows={[
          ["Disponiveis", motoCount.AVAILABLE ?? 0],
          ["Alugadas", motoCount.RENTED ?? 0],
          ["Em manutencao", motoCount.MAINTENANCE ?? 0],
          ["Vendidas", motoCount.SOLD ?? 0]
        ]} />
        <ReportCard title="Gestao e documentos" rows={[
          ["Custos de manutencao", formatCurrency(maintenanceCosts._sum.amount)],
          ["Documentos vencidos", expiredDocuments],
          ["Documentos vencendo em 30 dias", expiringDocuments]
        ]} />
      </div>
    </>
  );
}

function ReportCard({ title, rows }: { title: string; rows: Array<[string, string | number]> }) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardContent>
        <dl className="grid gap-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 text-sm last:border-0 last:pb-0">
              <dt className="text-slate-500">{label}</dt>
              <dd className="font-semibold text-asphalt">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
