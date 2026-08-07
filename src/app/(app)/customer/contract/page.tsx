import { ContractStatusBadge, InstallmentStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { getCustomerPortalData } from "@/lib/customer-data";
import {
  billingFrequencyLabels,
  contractTypeLabels,
  formatCurrency,
  formatDate
} from "@/lib/format";
import { sumConfirmedPayments } from "@/lib/payment-totals";

export default async function CustomerContractPage() {
  const { activeContract } = await getCustomerPortalData();

  if (!activeContract) {
    return (
      <>
        <PageHeader title="Meu contrato" />
        <EmptyState title="Sem contrato" description="Nenhum contrato esta disponivel para sua conta." />
      </>
    );
  }

  const totalPaid = sumConfirmedPayments(activeContract.payments);
  const total = activeContract.totalAmount.toNumber();
  const progress = total ? (totalPaid / total) * 100 : 0;

  return (
    <>
      <PageHeader title="Meu contrato" description={activeContract.code} />
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader title="Dados principais" />
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <ContractStatusBadge status={activeContract.status} />
            </div>
            <Info label="Tipo" value={contractTypeLabels[activeContract.type]} />
            <Info label="Inicio" value={formatDate(activeContract.startDate)} />
            <Info label="Termino previsto" value={formatDate(activeContract.expectedEndDate)} />
            <Info label="Frequencia" value={billingFrequencyLabels[activeContract.billingFrequency]} />
            <Info label="Valor da parcela" value={formatCurrency(activeContract.installmentAmount)} />
            <Info label="Total de parcelas" value={activeContract.totalInstallments} />
            <Info label="Termos principais" value={activeContract.customTerms || activeContract.notes} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Progresso de compra" />
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              <Info label="Valor total" value={formatCurrency(total)} />
              <Info label="Total pago" value={formatCurrency(totalPaid)} />
              <Info label="Saldo restante" value={formatCurrency(Math.max(total - totalPaid, 0))} />
            </div>
            <div className="mt-5">
              <ProgressBar value={progress} />
              <p className="mt-2 text-sm text-slate-500">{progress.toFixed(0)}% concluido</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Parcelas" />
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Numero</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Pago</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeContract.installments.map((installment) => (
                <tr key={installment.id}>
                  <td className="px-3 py-3">{installment.number}</td>
                  <td className="px-3 py-3">{formatDate(installment.dueDate)}</td>
                  <td className="px-3 py-3">{formatCurrency(installment.finalAmount)}</td>
                  <td className="px-3 py-3">{formatCurrency(installment.paidAmount)}</td>
                  <td className="px-3 py-3"><InstallmentStatusBadge status={installment.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-asphalt">{value || "-"}</p>
    </div>
  );
}
