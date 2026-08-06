import Link from "next/link";
import type { InstallmentStatus } from "@prisma/client";
import { Search, UserRound } from "lucide-react";
import { InstallmentStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { updateOverdueInstallments, installmentBalance } from "@/services/installments";

const installmentStatuses: InstallmentStatus[] = ["PENDING", "PARTIALLY_PAID", "OVERDUE", "PAID"];

export default async function InstallmentsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireCompanyRole();
  await updateOverdueInstallments(user.companyId!);
  const status = installmentStatuses.includes(params.status as InstallmentStatus)
    ? (params.status as InstallmentStatus)
    : undefined;
  const customerId = params.customerId?.trim() || "";

  const customers = await prisma.customer.findMany({
    where: { companyId: user.companyId!, deletedAt: null },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      cpf: true,
      phone: true,
      whatsapp: true
    }
  });

  const selectedCustomer = customerId
    ? customers.find((customer) => customer.id === customerId) ?? null
    : null;

  const installments = selectedCustomer
    ? await prisma.installment.findMany({
        where: {
          companyId: user.companyId!,
          ...(status ? { status } : {}),
          contract: {
            customerId: selectedCustomer.id
          }
        },
        orderBy: { dueDate: "asc" },
        include: {
          contract: {
            include: { customer: true, motorcycle: true }
          }
        },
        take: 150
      })
    : [];

  const summary = installments.reduce(
    (acc, installment) => {
      const balance = installmentBalance(installment).toNumber();
      acc.total += 1;
      acc.openBalance += balance;
      if (installment.status === "PAID") {
        acc.paid += 1;
      }
      if (installment.status === "OVERDUE") {
        acc.overdue += 1;
      }
      if (balance > 0) {
        acc.open += 1;
      }
      return acc;
    },
    {
      total: 0,
      paid: 0,
      overdue: 0,
      open: 0,
      openBalance: 0
    }
  );

  return (
    <>
      <PageHeader
        title="Parcelas"
        description="Acompanhe vencimentos, atrasos, pagamentos parciais e saldos."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Parcelas" }]}
      />

      <Card>
        <CardHeader
          title="Consultar parcelas por cliente"
          description="Selecione um cliente para visualizar contratos, vencimentos, pagamentos e saldos."
        />
        <CardContent>
          <form className="mb-5 grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 lg:grid-cols-[minmax(260px,1fr)_220px_auto_auto]">
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
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Status
              <select
                name="status"
                defaultValue={status ?? ""}
                className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-asphalt outline-none focus:border-petrol"
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendentes</option>
                <option value="PARTIALLY_PAID">Parciais</option>
                <option value="OVERDUE">Atrasadas</option>
                <option value="PAID">Pagas</option>
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="w-full">
                <Search className="h-4 w-4" aria-hidden="true" />
                Consultar
              </Button>
            </div>
            <div className="flex items-end">
              <Link
                href="/installments"
                className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-asphalt hover:bg-slate-50"
              >
                Limpar
              </Link>
            </div>
          </form>

          {!customers.length ? (
            <EmptyState
              title="Nenhum cliente cadastrado"
              description="Cadastre clientes e contratos para consultar parcelas por cliente."
            />
          ) : !customerId ? (
            <EmptyState
              title="Selecione um cliente"
              description="Use o filtro acima para escolher um cliente e visualizar somente as parcelas relacionadas a ele."
            />
          ) : !selectedCustomer ? (
            <EmptyState
              title="Cliente nao encontrado"
              description="O cliente informado nao pertence a esta empresa ou foi removido. Selecione outro cliente."
            />
          ) : (
            <>
              <div className="mb-5 rounded-lg border border-slate-100 bg-white p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-100 text-petrol">
                      <UserRound className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-asphalt">{selectedCustomer.fullName}</h2>
                        <Badge tone="blue">{summary.total} parcela(s)</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        CPF {selectedCustomer.cpf} | {selectedCustomer.phone || selectedCustomer.whatsapp || "sem telefone"}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[640px]">
                    {[
                      ["Em aberto", summary.open],
                      ["Atrasadas", summary.overdue],
                      ["Pagas", summary.paid],
                      ["Saldo", formatCurrency(summary.openBalance)]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="mt-1 text-base font-semibold text-asphalt">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {installments.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Contrato</th>
                        <th className="px-3 py-2">Moto</th>
                        <th className="px-3 py-2">Parcela</th>
                        <th className="px-3 py-2">Vencimento</th>
                        <th className="px-3 py-2">Valor</th>
                        <th className="px-3 py-2">Saldo</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Acao</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {installments.map((installment) => {
                        const balance = installmentBalance(installment).toNumber();
                        return (
                          <tr key={installment.id}>
                            <td className="px-3 py-3">
                              <Link href={`/contracts/${installment.contractId}`} className="text-petrol hover:underline">
                                {installment.contract.code}
                              </Link>
                            </td>
                            <td className="px-3 py-3">
                              <Link href={`/motorcycles/${installment.contract.motorcycleId}`} className="text-petrol hover:underline">
                                {installment.contract.motorcycle.plate}
                              </Link>
                            </td>
                            <td className="px-3 py-3">{installment.number}</td>
                            <td className="px-3 py-3">{formatDate(installment.dueDate)}</td>
                            <td className="px-3 py-3">{formatCurrency(installment.finalAmount)}</td>
                            <td className="px-3 py-3">{formatCurrency(balance)}</td>
                            <td className="px-3 py-3"><InstallmentStatusBadge status={installment.status} /></td>
                            <td className="px-3 py-3">
                              {balance > 0 ? (
                                <Link href={`/payments?installmentId=${installment.id}`} className="text-petrol hover:underline">
                                  Registrar
                                </Link>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="Sem parcelas para este filtro"
                  description="Este cliente nao possui parcelas com o status selecionado."
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
