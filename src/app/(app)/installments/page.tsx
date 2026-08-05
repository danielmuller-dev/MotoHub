import Link from "next/link";
import { InstallmentStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { updateOverdueInstallments, installmentBalance } from "@/services/installments";

export default async function InstallmentsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireCompanyRole();
  await updateOverdueInstallments(user.companyId!);
  const status = params.status;

  const installments = await prisma.installment.findMany({
    where: {
      companyId: user.companyId!,
      ...(status ? { status: status as never } : {})
    },
    orderBy: { dueDate: "asc" },
    include: {
      contract: {
        include: { customer: true, motorcycle: true }
      }
    },
    take: 150
  });

  return (
    <>
      <PageHeader
        title="Parcelas"
        description="Acompanhe vencimentos, atrasos, pagamentos parciais e saldos."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Parcelas" }]}
      />

      <Card>
        <CardHeader title="Parcelas da empresa" />
        <CardContent>
          <form className="mb-4 flex flex-wrap gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <select name="status" defaultValue={status ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="">Todos</option>
              <option value="PENDING">Pendentes</option>
              <option value="PARTIALLY_PAID">Parciais</option>
              <option value="OVERDUE">Atrasadas</option>
              <option value="PAID">Pagas</option>
            </select>
            <Button type="submit" variant="secondary">Filtrar</Button>
          </form>

          {installments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Contrato</th>
                    <th className="px-3 py-2">Cliente</th>
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
                        <td className="px-3 py-3">{installment.contract.customer.fullName}</td>
                        <td className="px-3 py-3">{installment.contract.motorcycle.plate}</td>
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
            <EmptyState title="Sem parcelas" description="As parcelas aparecem automaticamente ao ativar contratos." />
          )}
        </CardContent>
      </Card>
    </>
  );
}
