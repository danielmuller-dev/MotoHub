import Link from "next/link";
import { ContractForm } from "@/components/forms/contract-form";
import { ContractStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import {
  billingFrequencyLabels,
  contractTypeLabels,
  formatCurrency,
  formatDate
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function ContractsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireCompanyRole();
  const status = params.status;
  const type = params.type;

  const [customers, motorcycles, contracts] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: user.companyId!, status: "ACTIVE", deletedAt: null },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, cpf: true }
    }),
    prisma.motorcycle.findMany({
      where: { companyId: user.companyId!, status: { in: ["AVAILABLE", "BLOCKED"] }, deletedAt: null },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
      select: { id: true, brand: true, model: true, plate: true }
    }),
    prisma.contract.findMany({
      where: {
        companyId: user.companyId!,
        deletedAt: null,
        ...(status ? { status: status as never } : {}),
        ...(type ? { type: type as never } : {})
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        motorcycle: true,
        installments: true,
        payments: true
      }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Contratos"
        description="Crie contratos, gere parcelas e acompanhe o progresso de compra."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Contratos" }]}
      />

      <div className="grid gap-6 2xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Novo contrato" description="A moto e reservada ao ativar o contrato." />
          <CardContent>
            <ContractForm
              customers={customers.map((customer) => ({
                id: customer.id,
                label: `${customer.fullName} - ${customer.cpf}`
              }))}
              motorcycles={motorcycles.map((motorcycle) => ({
                id: motorcycle.id,
                label: `${motorcycle.brand} ${motorcycle.model} - ${motorcycle.plate}`
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Contratos cadastrados" description={`${contracts.length} contrato(s) no filtro atual.`} />
          <CardContent>
            <form className="mb-4 grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[180px_220px_auto]">
              <select name="status" defaultValue={status ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Todos os status</option>
                <option value="ACTIVE">Ativos</option>
                <option value="OVERDUE">Atrasados</option>
                <option value="COMPLETED">Concluidos</option>
                <option value="CANCELLED">Cancelados</option>
              </select>
              <select name="type" defaultValue={type ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Todos os tipos</option>
                <option value="RENTAL">Aluguel comum</option>
                <option value="RENT_TO_OWN">Aluguel com compra</option>
              </select>
              <button className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium hover:bg-slate-50">
                Filtrar
              </button>
            </form>

            {contracts.length ? (
              <div className="grid gap-3">
                {contracts.map((contract) => {
                  const paid = contract.payments.reduce((sum, payment) => sum + payment.amountPaid.toNumber(), 0);
                  const progress = contract.totalAmount.toNumber()
                    ? Math.min((paid / contract.totalAmount.toNumber()) * 100, 100)
                    : 0;

                  return (
                    <Link
                      key={contract.id}
                      href={`/contracts/${contract.id}`}
                      className="rounded-lg border border-slate-200 p-4 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-asphalt">{contract.code}</p>
                          <p className="text-sm text-slate-500">
                            {contract.customer.fullName} | {contract.motorcycle.plate}
                          </p>
                        </div>
                        <ContractStatusBadge status={contract.status} />
                      </div>
                      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                        <span>{contractTypeLabels[contract.type]}</span>
                        <span>{billingFrequencyLabels[contract.billingFrequency]}</span>
                        <span>{formatCurrency(contract.installmentAmount)}</span>
                        <span>{formatDate(contract.startDate)}</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-100">
                        <span className="block h-2 rounded-full bg-petrol" style={{ width: `${progress}%` }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Nenhum contrato encontrado"
                description="Crie um contrato para gerar parcelas e iniciar a operacao."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
