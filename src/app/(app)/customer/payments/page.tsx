import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCustomerPortalData } from "@/lib/customer-data";
import { formatCurrency, formatDate, paymentMethodLabels } from "@/lib/format";

export default async function CustomerPaymentsPage() {
  const { activeContract } = await getCustomerPortalData();
  const payments = activeContract?.payments ?? [];

  return (
    <>
      <PageHeader title="Pagamentos" description="Historico de pagamentos e recibos do seu contrato." />
      <Card>
        <CardHeader title="Historico" />
        <CardContent>
          {payments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Valor</th>
                    <th className="px-3 py-2">Forma</th>
                    <th className="px-3 py-2">Recibo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-3 py-3 font-medium">{payment.code}</td>
                      <td className="px-3 py-3">{formatDate(payment.paymentDate)}</td>
                      <td className="px-3 py-3">{formatCurrency(payment.amountPaid)}</td>
                      <td className="px-3 py-3">{paymentMethodLabels[payment.method]}</td>
                      <td className="px-3 py-3">
                        <Link href={`/payments/${payment.id}`} className="text-petrol hover:underline">
                          Abrir recibo
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Sem pagamentos" description="Nenhum pagamento aparece para este contrato." />
          )}
        </CardContent>
      </Card>
    </>
  );
}
