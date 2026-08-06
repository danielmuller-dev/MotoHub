import Link from "next/link";
import type { PaymentMethod } from "@prisma/client";
import { CreditCard, Search, UserRound } from "lucide-react";
import { registerPaymentAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SelectField, TextArea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { formatCurrency, formatDate, paymentMethodLabels } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { installmentBalance } from "@/services/installments";

const paymentMethods = Object.keys(paymentMethodLabels) as PaymentMethod[];

export default async function PaymentsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireCompanyRole();
  const method = paymentMethods.includes(params.method as PaymentMethod)
    ? (params.method as PaymentMethod)
    : undefined;
  const requestedCustomerId = params.customerId?.trim() || "";
  const requestedInstallmentId = params.installmentId?.trim() || "";

  const [customers, requestedInstallment] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: user.companyId!, deletedAt: null },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        cpf: true,
        phone: true,
        whatsapp: true
      }
    }),
    requestedInstallmentId
      ? prisma.installment.findFirst({
          where: {
            id: requestedInstallmentId,
            companyId: user.companyId!,
            status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] }
          },
          select: {
            id: true,
            contract: {
              select: {
                customerId: true
              }
            }
          }
        })
      : null
  ]);

  const selectedCustomerId = requestedCustomerId || requestedInstallment?.contract.customerId || "";
  const selectedCustomer = selectedCustomerId
    ? customers.find((customer) => customer.id === selectedCustomerId) ?? null
    : null;

  const [installments, payments] = await Promise.all([
    prisma.installment.findMany({
      where: {
        companyId: user.companyId!,
        status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] },
        ...(selectedCustomer ? { contract: { customerId: selectedCustomer.id } } : { id: "__none__" })
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
        ...(selectedCustomer ? { customerId: selectedCustomer.id } : {}),
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

  const defaultInstallmentId =
    requestedInstallment && requestedInstallment.contract.customerId === selectedCustomer?.id
      ? requestedInstallment.id
      : "";

  const installmentSummary = installments.reduce(
    (acc, installment) => {
      const balance = installmentBalance(installment).toNumber();
      acc.open += 1;
      acc.openBalance += balance;
      if (installment.status === "OVERDUE") {
        acc.overdue += 1;
      }
      return acc;
    },
    {
      open: 0,
      overdue: 0,
      openBalance: 0
    }
  );

  return (
    <>
      <PageHeader
        title="Pagamentos"
        description="Registre recebimentos e acesse recibos simples para impressao."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Pagamentos" }]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card>
          <CardHeader
            title="Registrar pagamento"
            description="Selecione o cliente para carregar somente as parcelas em aberto dele."
          />
          <CardContent>
            <form className="mb-5 grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 md:grid-cols-[minmax(220px,1fr)_auto_auto]">
              <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
                Cliente
                <select
                  name="customerId"
                  defaultValue={selectedCustomer?.id ?? ""}
                  className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-asphalt outline-none focus:border-petrol"
                >
                  <option value="">Selecione um cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.fullName} | {customer.cpf}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <Button type="submit" variant="secondary" className="w-full">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Carregar parcelas
                </Button>
              </div>
              <div className="flex items-end">
                <Link
                  href="/payments"
                  className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-asphalt hover:bg-slate-50"
                >
                  Limpar
                </Link>
              </div>
            </form>

            {!customers.length ? (
              <EmptyState
                title="Nenhum cliente cadastrado"
                description="Cadastre clientes e contratos para registrar pagamentos."
              />
            ) : !selectedCustomerId ? (
              <EmptyState
                title="Selecione um cliente"
                description="Escolha o cliente acima para carregar somente as parcelas pendentes, parciais ou atrasadas dele."
              />
            ) : !selectedCustomer ? (
              <EmptyState
                title="Cliente nao encontrado"
                description="O cliente informado nao pertence a esta empresa ou foi removido. Selecione outro cliente."
              />
            ) : (
              <div className="grid gap-4">
                <div className="rounded-lg border border-slate-100 bg-white p-4">
                  <div className="flex gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-100 text-petrol">
                      <UserRound className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-asphalt">{selectedCustomer.fullName}</h2>
                        <Badge tone={installmentSummary.overdue > 0 ? "red" : "blue"}>
                          {installmentSummary.open} parcela(s) em aberto
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        CPF {selectedCustomer.cpf} | {selectedCustomer.phone || selectedCustomer.whatsapp || "sem telefone"}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        Saldo em aberto: <strong>{formatCurrency(installmentSummary.openBalance)}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {installments.length ? (
                  <form action={registerPaymentAction} className="grid gap-4">
                    <SelectField label="Parcela" name="installmentId" defaultValue={defaultInstallmentId} required>
                      <option value="">Selecione uma parcela</option>
                      {installments.map((installment) => {
                        const balance = installmentBalance(installment).toNumber();
                        return (
                          <option key={installment.id} value={installment.id}>
                            {installment.contract.code} | {installment.contract.motorcycle.plate} | Parcela {installment.number} | {formatDate(installment.dueDate)} | {formatCurrency(balance)}
                          </option>
                        );
                      })}
                    </SelectField>
                    <div className="form-grid-2">
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
                ) : (
                  <EmptyState
                    title="Sem parcelas em aberto"
                    description="Este cliente nao possui parcelas pendentes, parciais ou atrasadas para pagamento."
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Historico de pagamentos"
            description={selectedCustomer ? `Pagamentos de ${selectedCustomer.fullName}.` : "Ultimos pagamentos da empresa."}
          />
          <CardContent>
            <form className="mb-4 flex flex-wrap gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
              {selectedCustomer ? <input type="hidden" name="customerId" value={selectedCustomer.id} /> : null}
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
