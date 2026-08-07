import Link from "next/link";
import { Bell, CalendarClock, CreditCard } from "lucide-react";
import { ContractStatusBadge, InstallmentStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { getCustomerPortalData, maskPlate } from "@/lib/customer-data";
import { formatCurrency, formatDate } from "@/lib/format";
import { sumConfirmedPayments } from "@/lib/payment-totals";

export default async function CustomerHomePage() {
  const { customer, activeContract } = await getCustomerPortalData();
  const installments = activeContract?.installments ?? [];
  const payments = activeContract?.payments ?? [];
  const totalPaid = sumConfirmedPayments(payments);
  const total = activeContract?.totalAmount.toNumber() ?? 0;
  const progress = total ? (totalPaid / total) * 100 : 0;
  const nextInstallment = installments.find((installment) =>
    ["PENDING", "PARTIALLY_PAID", "OVERDUE"].includes(installment.status)
  );
  const overdue = installments.filter((installment) => installment.status === "OVERDUE");
  const unread = customer.notificationRecipients.filter((recipient) => !recipient.readAt).length;

  return (
    <>
      <PageHeader
        title={`Ola, ${customer.fullName.split(" ")[0]}`}
        description="Aqui estao seus dados de contrato, pagamentos e avisos."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Proximo vencimento" value={nextInstallment ? formatDate(nextInstallment.dueDate) : "-"} icon={CalendarClock} />
        <StatCard label="Valor da proxima parcela" value={nextInstallment ? formatCurrency(nextInstallment.finalAmount) : "-"} icon={CreditCard} />
        <StatCard label="Parcelas atrasadas" value={overdue.length} icon={CalendarClock} />
        <StatCard label="Avisos nao lidos" value={unread} icon={Bell} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader title="Contrato atual" />
          <CardContent>
            {activeContract ? (
              <div className="grid gap-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link href="/customer/contract" className="text-lg font-semibold text-asphalt hover:text-petrol">
                      {activeContract.code}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {activeContract.motorcycle.brand} {activeContract.motorcycle.model} | {maskPlate(activeContract.motorcycle.plate)}
                    </p>
                  </div>
                  <ContractStatusBadge status={activeContract.status} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Total pago" value={formatCurrency(totalPaid)} />
                  <Metric label="Saldo restante" value={formatCurrency(Math.max(total - totalPaid, 0))} />
                  <Metric label="Progresso" value={`${progress.toFixed(0)}%`} />
                </div>
                <ProgressBar value={progress} />
              </div>
            ) : (
              <EmptyState title="Sem contrato ativo" description="Nenhum contrato esta disponivel na sua area." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Avisos recentes" />
          <CardContent className="grid gap-3">
            {customer.notificationRecipients.slice(0, 5).map((recipient) => (
              <Link key={recipient.id} href="/customer/notifications" className="rounded-md border border-slate-100 p-3 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{recipient.notification.title}</p>
                  {!recipient.readAt ? <span className="h-2 w-2 rounded-full bg-petrol" /> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{recipient.notification.message}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {overdue.length ? (
        <Card className="mt-6 border-red-200">
          <CardHeader title="Parcelas atrasadas" />
          <CardContent className="grid gap-3">
            {overdue.map((installment) => (
              <div key={installment.id} className="rounded-md border border-red-100 bg-red-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Parcela {installment.number}</p>
                  <InstallmentStatusBadge status={installment.status} />
                </div>
                <p className="mt-1 text-sm text-red-700">
                  {formatCurrency(installment.finalAmount)} | {formatDate(installment.dueDate)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-asphalt">{value}</p>
    </div>
  );
}
