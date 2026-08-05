import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelContractAction, registerPaymentAction } from "@/app/actions";
import { ContractStatusBadge, InstallmentStatusBadge, MotorcycleStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { requireCompanyRole } from "@/lib/auth";
import {
  billingFrequencyLabels,
  contractTypeLabels,
  formatCurrency,
  formatDate,
  paymentMethodLabels,
  weekDayLabels
} from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { installmentBalance } from "@/services/installments";

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCompanyRole();
  const contract = await prisma.contract.findFirst({
    where: { id, companyId: user.companyId!, deletedAt: null },
    include: {
      customer: true,
      motorcycle: true,
      installments: { orderBy: { number: "asc" }, include: { payments: true } },
      payments: { orderBy: { paymentDate: "desc" }, include: { registeredBy: true } }
    }
  });

  if (!contract) {
    notFound();
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: { companyId: user.companyId!, entity: "Contract", entityId: contract.id },
    orderBy: { createdAt: "desc" },
    take: 8
  });

  const totalPaid = contract.payments.reduce((sum, payment) => sum + payment.amountPaid.toNumber(), 0);
  const totalAmount = contract.totalAmount.toNumber();
  const remaining = Math.max(totalAmount - totalPaid, 0);
  const paidInstallments = contract.installments.filter((installment) => installment.status === "PAID").length;
  const overdueInstallments = contract.installments.filter((installment) => installment.status === "OVERDUE").length;
  const pendingInstallments = contract.installments.filter((installment) =>
    ["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(installment.status)
  ).length;
  const progress = totalAmount ? (totalPaid / totalAmount) * 100 : 0;

  return (
    <>
      <PageHeader
        title={contract.code}
        description="Detalhes do contrato, parcelas, pagamentos e historico."
        breadcrumbs={[{ label: "Contratos", href: "/contracts" }, { label: contract.code }]}
        action={
          user.role === "COMPANY_ADMIN" && ["ACTIVE", "OVERDUE", "SUSPENDED", "DRAFT"].includes(contract.status) ? (
            <form action={cancelContractAction}>
              <input type="hidden" name="contractId" value={contract.id} />
              <ConfirmSubmitButton label="Cancelar contrato" message="Cancelar este contrato sem apagar historico financeiro?" />
            </form>
          ) : null
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader title="Resumo" />
          <CardContent className="grid gap-4 text-sm">
            <div className="flex items-center justify-between">
              <ContractStatusBadge status={contract.status} />
              <MotorcycleStatusBadge status={contract.motorcycle.status} />
            </div>
            <Info label="Cliente" value={contract.customer.fullName} href={`/customers/${contract.customerId}`} />
            <Info label="Moto" value={`${contract.motorcycle.brand} ${contract.motorcycle.model} - ${contract.motorcycle.plate}`} href={`/motorcycles/${contract.motorcycleId}`} />
            <Info label="Tipo" value={contractTypeLabels[contract.type]} />
            <Info label="Frequencia" value={billingFrequencyLabels[contract.billingFrequency]} />
            <Info label="Inicio" value={formatDate(contract.startDate)} />
            <Info label="Primeiro vencimento" value={formatDate(contract.firstDueDate)} />
            <Info label="Dia semanal" value={contract.weeklyDueDay ? weekDayLabels[contract.weeklyDueDay] : null} />
            <Info label="Dia mensal" value={contract.monthlyDueDay} />
            <Info label="Valor parcela" value={formatCurrency(contract.installmentAmount)} />
            <Info label="Total contrato" value={formatCurrency(contract.totalAmount)} />
            <Info label="Entrada" value={formatCurrency(contract.downPayment)} />
            <Info label="Caucao" value={formatCurrency(contract.depositAmount)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Progresso financeiro" />
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Pago" value={formatCurrency(totalPaid)} />
              <Metric label="Restante" value={formatCurrency(remaining)} />
              <Metric label="Concluido" value={`${progress.toFixed(0)}%`} />
              <Metric label="Parcelas pagas" value={`${paidInstallments}/${contract.totalInstallments}`} />
              <Metric label="Pendentes" value={pendingInstallments} />
              <Metric label="Atrasadas" value={overdueInstallments} />
            </div>
            <div className="mt-5">
              <ProgressBar value={progress} />
              {contract.type === "RENT_TO_OWN" ? (
                <p className="mt-2 text-sm text-slate-500">
                  {paidInstallments} de {contract.totalInstallments} parcelas pagas no contrato com intencao de compra.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Parcelas" description="Registre pagamentos completos ou parciais." />
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Numero</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Pago</th>
                <th className="px-3 py-2">Saldo</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Registrar pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contract.installments.map((installment) => {
                const balance = installmentBalance(installment).toNumber();
                return (
                  <tr key={installment.id}>
                    <td className="px-3 py-3">{installment.number}</td>
                    <td className="px-3 py-3">{formatDate(installment.dueDate)}</td>
                    <td className="px-3 py-3">{formatCurrency(installment.finalAmount)}</td>
                    <td className="px-3 py-3">{formatCurrency(installment.paidAmount)}</td>
                    <td className="px-3 py-3">{formatCurrency(balance)}</td>
                    <td className="px-3 py-3"><InstallmentStatusBadge status={installment.status} /></td>
                    <td className="px-3 py-3">
                      {balance > 0 && contract.status !== "CANCELLED" ? (
                        <form action={registerPaymentAction} className="grid gap-2 md:grid-cols-[110px_130px_130px_auto]">
                          <input type="hidden" name="installmentId" value={installment.id} />
                          <input name="amountPaid" type="number" min="0.01" max={balance} step="0.01" defaultValue={balance.toFixed(2)} className="h-9 rounded-md border border-slate-200 px-2 text-sm" />
                          <input name="paymentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="h-9 rounded-md border border-slate-200 px-2 text-sm" />
                          <select name="method" defaultValue="PIX" className="h-9 rounded-md border border-slate-200 px-2 text-sm">
                            {Object.entries(paymentMethodLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                          <Button type="submit" size="sm" variant="secondary">Registrar</Button>
                        </form>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Pagamentos" />
          <CardContent className="grid gap-3">
            {contract.payments.map((payment) => (
              <Link key={payment.id} href={`/payments/${payment.id}`} className="rounded-md border border-slate-100 p-3 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{payment.code}</p>
                  <p className="font-semibold text-petrol">{formatCurrency(payment.amountPaid)}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(payment.paymentDate)} | {payment.registeredBy?.name || "Responsavel nao informado"}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Historico" />
          <CardContent className="grid gap-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-md border border-slate-100 p-3">
                <p className="font-medium">{log.description}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(log.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Info({ label, value, href }: { label: string; value?: string | number | null; href?: string }) {
  const content = <p className="mt-1 text-sm text-asphalt">{value || "-"}</p>;
  return (
    <div>
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      {href && value ? (
        <Link href={href} className="hover:text-petrol hover:underline">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-asphalt">{value}</p>
    </div>
  );
}
