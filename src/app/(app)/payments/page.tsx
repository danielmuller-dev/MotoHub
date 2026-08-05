import Link from "next/link";
import { CreditCard } from "lucide-react";
import { registerPaymentAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SelectField, TextArea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { formatCurrency, formatDate, paymentMethodLabels } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { installmentBalance } from "@/services/installments";

export default async function PaymentsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireCompanyRole();
  const method = params.method;

  const [installments, payments] = await Promise.all([
    prisma.installment.findMany({
      where: {
        companyId: user.companyId!,
        status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] }
      },
      orderBy: { dueDate: "asc" },
      take: 80,
      include: {
        contract: {
          include: { customer: true, motorcycle: true }
        }
      }
    }),
    prisma.payment.findMany({
      where: {
        companyId: user.companyId!,
        ...(method ? { method: method as never } : {})
      },
      orderBy: { paymentDate: "desc" },
      take: 50,
      include: {
        customer: true,
        contract: true,
        installment: true,
        registeredBy: true
      }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Pagamentos"
        description="Registre recebimentos e acesse recibos simples para impressao."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Pagamentos" }]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card>
          <CardHeader title="Registrar pagamento" description="Pagamentos parciais sao aceitos ate o saldo da parcela." />
          <CardContent>
            <form action={registerPaymentAction} className="grid gap-4">
              <SelectField label="Parcela" name="installmentId" defaultValue={params.installmentId ?? ""} required>
                <option value="">Selecione</option>
                {installments.map((installment) => {
                  const balance = installmentBalance(installment).toNumber();
                  return (
                    <option key={installment.id} value={installment.id}>
                      {installment.contract.customer.fullName} | {installment.contract.code} | Parcela {installment.number} | {formatCurrency(balance)}
                    </option>
                  );
                })}
              </SelectField>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Valor pago" name="amountPaid" type="number" step="0.01" required />
                <Field label="Data do pagamento" name="paymentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
              </div>
              <SelectField label="Forma de pagamento" name="method" defaultValue="PIX">
                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </SelectField>
              <Field label="Referencia" name="reference" />
              <Field label="Comprovante por URL" name="receiptUrl" type="url" />
              <TextArea label="Observacao" name="note" />
              <Button type="submit">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Registrar pagamento
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Historico de pagamentos" />
          <CardContent>
            <form className="mb-4 flex flex-wrap gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
              <select name="method" defaultValue={method ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Todas as formas</option>
                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <Button type="submit" variant="secondary">Filtrar</Button>
            </form>

            {payments.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Codigo</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Contrato</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2">Forma</th>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Recibo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-3 py-3 font-medium">{payment.code}</td>
                        <td className="px-3 py-3">{payment.customer.fullName}</td>
                        <td className="px-3 py-3">
                          <Link href={`/contracts/${payment.contractId}`} className="text-petrol hover:underline">
                            {payment.contract.code}
                          </Link>
                        </td>
                        <td className="px-3 py-3">{formatCurrency(payment.amountPaid)}</td>
                        <td className="px-3 py-3">{paymentMethodLabels[payment.method]}</td>
                        <td className="px-3 py-3">{formatDate(payment.paymentDate)}</td>
                        <td className="px-3 py-3">
                          <Link href={`/payments/${payment.id}`} className="text-petrol hover:underline">
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sem pagamentos" description="Nenhum pagamento foi registrado no filtro atual." />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
