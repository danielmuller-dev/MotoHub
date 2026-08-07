import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cancelContractAction,
  registerPaymentAction,
  renegotiateInstallmentAction,
  resumeContractAction,
  reversePaymentAction,
  suspendContractAction,
  terminateContractAction,
  updateContractAction
} from "@/app/actions";
import {
  ContractStatusBadge,
  InstallmentStatusBadge,
  InspectionStatusBadge,
  MotorcycleStatusBadge,
  PaymentStatusBadge
} from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SelectField, TextArea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { requireCompanyRole } from "@/lib/auth";
import { getContractActionsForStatus, isFinalContractStatus } from "@/lib/contract-lifecycle";
import {
  billingFrequencyLabels,
  contractTypeLabels,
  formatCurrency,
  formatDate,
  formatDateInput,
  formatDateTime,
  inspectionTypeLabels,
  paymentMethodLabels,
  weekDayLabels
} from "@/lib/format";
import { sumConfirmedPayments } from "@/lib/payment-totals";
import { prisma } from "@/lib/prisma";
import { installmentBalance } from "@/services/installments";
import {
  buildContractInstallmentWhere,
  buildContractInstallmentsHref,
  contractInstallmentPageSizes,
  contractInstallmentStatuses,
  getContractInstallmentOrderBy,
  getContractInstallmentPagination,
  getVisiblePageNumbers,
  parseContractInstallmentQuery
} from "@/lib/contract-installments";

const statusFilterLabels = {
  PENDING: "Pendentes",
  OVERDUE: "Atrasadas",
  PARTIALLY_PAID: "Parcialmente pagas",
  PAID: "Pagas",
  CANCELLED: "Canceladas"
};

const sortLabels = {
  "number-asc": "Parcela mais antiga",
  "number-desc": "Parcela mais recente",
  "due-asc": "Vencimento crescente",
  "due-desc": "Vencimento decrescente",
  status: "Status"
};

const terminationReasons = [
  "Acordo entre as partes",
  "Devolucao voluntaria",
  "Troca de moto",
  "Inadimplencia",
  "Venda direta",
  "Encerramento administrativo",
  "Outro"
];

const cancellationReasons = [
  "Erro no cadastro",
  "Desistencia antes da operacao",
  "Acordo administrativo",
  "Inadimplencia",
  "Outro"
];

const suspensionReasons = [
  "Analise administrativa",
  "Inadimplencia temporaria",
  "Moto indisponivel",
  "Acordo entre as partes",
  "Outro"
];

export default async function ContractDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const rawSearchParams = await searchParams;
  const user = await requireCompanyRole();
  const contract = await prisma.contract.findFirst({
    where: { id, companyId: user.companyId!, deletedAt: null },
    include: {
      customer: true,
      motorcycle: true,
      payments: {
        orderBy: { paymentDate: "desc" },
        include: {
          installment: true,
          registeredBy: true,
          reversedBy: true
        }
      }
    }
  });

  if (!contract) {
    notFound();
  }

  const installmentQuery = parseContractInstallmentQuery(rawSearchParams);
  const installmentWhere = buildContractInstallmentWhere({
    companyId: user.companyId!,
    contractId: contract.id,
    query: installmentQuery
  });
  const installmentOrderBy = getContractInstallmentOrderBy(installmentQuery.sort);

  const [
    paidInstallments,
    overdueInstallments,
    pendingInstallments,
    totalFilteredInstallments,
    contractEvents,
    latestInspections
  ] = await Promise.all([
    prisma.installment.count({ where: { companyId: user.companyId!, contractId: contract.id, status: "PAID" } }),
    prisma.installment.count({ where: { companyId: user.companyId!, contractId: contract.id, status: "OVERDUE" } }),
    prisma.installment.count({
      where: {
        companyId: user.companyId!,
        contractId: contract.id,
        status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] }
      }
    }),
    prisma.installment.count({ where: installmentWhere }),
    prisma.contractEvent.findMany({
      where: { companyId: user.companyId!, contractId: contract.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { user: true }
    }),
    prisma.inspection.findMany({
      where: { companyId: user.companyId!, contractId: contract.id },
      orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
      take: 5,
      include: { _count: { select: { damages: true, photos: true } } }
    })
  ]);

  const pagination = getContractInstallmentPagination(installmentQuery, totalFilteredInstallments);
  const pagedInstallments = await prisma.installment.findMany({
    where: installmentWhere,
    orderBy: installmentOrderBy,
    skip: pagination.skip,
    take: pagination.take
  });
  const normalizedInstallmentQuery = { ...installmentQuery, page: pagination.page };
  const currentInstallmentsHref = buildContractInstallmentsHref(contract.id, normalizedInstallmentQuery);

  const paymentIds = contract.payments.map((payment) => payment.id);
  const pagedInstallmentIds = pagedInstallments.map((installment) => installment.id);
  const auditScopes = [
    { entity: "Contract", entityId: contract.id },
    ...(paymentIds.length ? [{ entity: "Payment", entityId: { in: paymentIds } }] : []),
    ...(pagedInstallmentIds.length ? [{ entity: "Installment", entityId: { in: pagedInstallmentIds } }] : [])
  ];
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      companyId: user.companyId!,
      OR: auditScopes
    },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  const totalPaid = sumConfirmedPayments(contract.payments);
  const confirmedPayments = contract.payments.filter((payment) => payment.status === "CONFIRMED");
  const reversedPayments = contract.payments.filter((payment) => payment.status === "REVERSED");
  const totalAmount = contract.totalAmount.toNumber();
  const remaining = Math.max(totalAmount - totalPaid, 0);
  const progress = totalAmount ? (totalPaid / totalAmount) * 100 : 0;
  const today = new Date();
  const todayInput = today.toISOString().slice(0, 10);
  const actions = getContractActionsForStatus(contract.status);
  const isAdmin = user.role === "COMPANY_ADMIN";
  const canRenegotiate = user.role === "COMPANY_ADMIN" || user.role === "EMPLOYEE";
  const isFinal = isFinalContractStatus(contract.status);

  return (
    <>
      <PageHeader
        title={contract.code}
        description="Detalhes do contrato, parcelas, pagamentos e historico."
        breadcrumbs={[{ label: "Contratos", href: "/contracts" }, { label: contract.code }]}
        action={
          <ContractActionBar
            actions={actions}
            contractId={contract.id}
            customerId={contract.customerId}
            motorcycleId={contract.motorcycleId}
            isAdmin={isAdmin}
          />
        }
      />

      {isAdmin && ["ACTIVE", "OVERDUE", "DRAFT"].includes(contract.status) ? (
        <EditContractPanel contract={contract} returnTo={currentInstallmentsHref} />
      ) : null}

      {isAdmin && !isFinal ? (
        <LifecyclePanels
          contractId={contract.id}
          returnTo={currentInstallmentsHref}
          status={contract.status}
          todayInput={todayInput}
          totalAmount={totalAmount}
          totalPaid={totalPaid}
          remaining={remaining}
          paidInstallments={paidInstallments}
          pendingInstallments={pendingInstallments}
          overdueInstallments={overdueInstallments}
        />
      ) : null}

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
            {contract.terminatedAt ? <Info label="Encerrado em" value={formatDate(contract.terminatedAt)} /> : null}
            {contract.cancelledAt ? <Info label="Cancelado em" value={formatDate(contract.cancelledAt)} /> : null}
            {contract.suspendedAt ? <Info label="Suspenso em" value={formatDate(contract.suspendedAt)} /> : null}
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
        <CardHeader
          title="Vistorias do contrato"
          description="Entrega, devolucao e acompanhamentos vinculados a este contrato."
          action={
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/inspections/new?contractId=${contract.id}&type=DELIVERY`}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-asphalt hover:bg-slate-50"
              >
                Entrega
              </Link>
              <Link
                href={`/inspections/new?contractId=${contract.id}&type=PERIODIC`}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-asphalt hover:bg-slate-50"
              >
                Periodica
              </Link>
              <Link
                href={`/inspections/new?contractId=${contract.id}&type=RETURN`}
                className="inline-flex h-9 items-center justify-center rounded-md bg-asphalt px-3 text-sm font-medium text-white hover:bg-graphite"
              >
                Devolucao
              </Link>
              <Link
                href={`/contracts/${contract.id}/inspections`}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-asphalt hover:bg-slate-50"
              >
                Ver todas
              </Link>
            </div>
          }
        />
        <CardContent>
          {latestInspections.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Km</th>
                    <th className="px-3 py-2">Resumo</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {latestInspections.map((inspection) => (
                    <tr key={inspection.id}>
                      <td className="px-3 py-3">
                        <Link href={`/inspections/${inspection.id}`} className="font-medium text-petrol hover:underline">
                          {inspection.code}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{inspectionTypeLabels[inspection.type]}</td>
                      <td className="px-3 py-3">{formatDate(inspection.inspectionDate)}</td>
                      <td className="px-3 py-3">{inspection.mileage} km</td>
                      <td className="px-3 py-3 text-slate-600">
                        {inspection._count.damages} avaria(s), {inspection._count.photos} foto(s)
                      </td>
                      <td className="px-3 py-3"><InspectionStatusBadge status={inspection.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Sem vistorias" description="Registre a entrega para criar o historico operacional deste contrato." />
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Parcelas"
          description={`${contract.totalInstallments} parcela(s) no contrato. Registre pagamentos completos, parciais ou renegocie saldos em aberto.`}
        />
        <CardContent>
          <form className="mb-4 grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 xl:grid-cols-[170px_minmax(210px,1fr)_210px_170px_auto]">
            <input type="hidden" name="installmentPage" value="1" />
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Status
              <select
                name="installmentStatus"
                defaultValue={installmentQuery.status ?? ""}
                className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-asphalt outline-none focus:border-petrol"
              >
                <option value="">Todas</option>
                {contractInstallmentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {statusFilterLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Busca
              <input
                name="installmentSearch"
                defaultValue={installmentQuery.search}
                placeholder="Numero ou vencimento"
                className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-asphalt outline-none focus:border-petrol"
              />
            </label>
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Ordenacao
              <select
                name="installmentSort"
                defaultValue={installmentQuery.sort}
                className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-asphalt outline-none focus:border-petrol"
              >
                {Object.entries(sortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Por pagina
              <select
                name="installmentPageSize"
                defaultValue={installmentQuery.pageSize}
                className="h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-asphalt outline-none focus:border-petrol"
              >
                {contractInstallmentPageSizes.map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="w-full">
                Filtrar
              </Button>
            </div>
          </form>

          <div className="mb-4 flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Exibindo {pagination.startItem}-{pagination.endItem} de {pagination.totalItems} parcela(s)
            </p>
            <p>Pagina {pagination.page} de {pagination.totalPages}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Numero</th>
                  <th className="px-3 py-2">Vencimento</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Pago</th>
                  <th className="px-3 py-2">Saldo</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedInstallments.map((installment) => {
                  const balance = installmentBalance(installment).toNumber();
                  const canRegisterPayment =
                    balance > 0 &&
                    actions.includes("REGISTER_PAYMENT") &&
                    installment.status !== "CANCELLED";
                  const canRenegotiateInstallment =
                    canRenegotiate &&
                    !isFinal &&
                    contract.status !== "SUSPENDED" &&
                    ["PENDING", "OVERDUE", "PARTIALLY_PAID"].includes(installment.status);

                  return (
                    <tr key={installment.id} className="align-top">
                      <td className="px-3 py-3">{installment.number}</td>
                      <td className="px-3 py-3">{formatDate(installment.dueDate)}</td>
                      <td className="px-3 py-3">{formatCurrency(installment.finalAmount)}</td>
                      <td className="px-3 py-3">{formatCurrency(installment.paidAmount)}</td>
                      <td className="px-3 py-3">{formatCurrency(balance)}</td>
                      <td className="px-3 py-3"><InstallmentStatusBadge status={installment.status} /></td>
                      <td className="px-3 py-3">
                        <div className="grid gap-2">
                          {canRegisterPayment ? (
                            <form action={registerPaymentAction} className="grid gap-2 md:grid-cols-[110px_130px_130px_auto]">
                              <input type="hidden" name="installmentId" value={installment.id} />
                              <input type="hidden" name="returnTo" value={currentInstallmentsHref} />
                              <input name="amountPaid" type="number" min="0.01" max={balance} step="0.01" defaultValue={balance.toFixed(2)} className="h-9 min-w-0 rounded-md border border-slate-200 px-2 text-sm" />
                              <input name="paymentDate" type="date" defaultValue={todayInput} className="h-9 min-w-0 rounded-md border border-slate-200 px-2 text-sm" />
                              <select name="method" defaultValue="PIX" className="h-9 min-w-0 rounded-md border border-slate-200 px-2 text-sm">
                                {Object.entries(paymentMethodLabels).map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </select>
                              <Button type="submit" size="sm" variant="secondary">Registrar</Button>
                            </form>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                          {canRenegotiateInstallment ? (
                            <RenegotiateInstallmentForm
                              contractId={contract.id}
                              installment={installment}
                              returnTo={currentInstallmentsHref}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination.totalItems === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Nenhuma parcela encontrada para os filtros selecionados.
            </div>
          ) : (
            <PaginationControls contractId={contract.id} query={normalizedInstallmentQuery} pagination={pagination} />
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Lista de pagamentos" description={`${confirmedPayments.length} pagamento(s) confirmado(s).`} />
          <CardContent className="grid gap-3">
            {contract.payments.length ? (
              contract.payments.map((payment) => (
                <div key={payment.id} className="rounded-md border border-slate-100 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <Link href={`/payments/${payment.id}`} className="font-medium text-petrol hover:underline">
                      {payment.code}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2">
                      <PaymentStatusBadge status={payment.status} />
                      <p className="font-semibold text-petrol">{formatCurrency(payment.amountPaid)}</p>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Parcela {payment.installment?.number ?? "-"} | {formatDate(payment.paymentDate)} | {payment.registeredBy?.name || "Responsavel nao informado"}
                  </p>
                  {payment.status === "REVERSED" ? (
                    <p className="mt-2 text-xs text-red-700">
                      Estornado em {formatDate(payment.reversedAt)} por {payment.reversedBy?.name || "responsavel nao informado"}.
                    </p>
                  ) : null}
                  {isAdmin && payment.status === "CONFIRMED" ? (
                    <ReversePaymentForm paymentId={payment.id} returnTo={currentInstallmentsHref} />
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState title="Sem pagamentos" description="Nenhum pagamento foi registrado neste contrato." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Lista de estornos" description={`${reversedPayments.length} estorno(s) registrado(s).`} />
          <CardContent className="grid gap-3">
            {reversedPayments.length ? (
              reversedPayments.map((payment) => (
                <div key={payment.id} className="rounded-md border border-red-100 bg-red-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-red-950">{payment.code}</p>
                    <p className="font-semibold text-red-700">{formatCurrency(payment.amountPaid)}</p>
                  </div>
                  <p className="mt-1 text-sm text-red-700">
                    {payment.reversalReason || "Motivo nao informado"} | {formatDate(payment.reversedAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState title="Sem estornos" description="Nenhum pagamento deste contrato foi estornado." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2" id="historico-contrato">
        <Card>
          <CardHeader title="Historico do contrato" />
          <CardContent className="grid gap-3">
            {contractEvents.length ? (
              contractEvents.map((event) => (
                <div key={event.id} className="rounded-md border border-slate-100 p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-medium">{event.title}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(event.createdAt)}</p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{event.description}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {event.user?.name || "Responsavel nao informado"}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState title="Sem eventos" description="As novas acoes deste contrato aparecerao aqui." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Auditoria resumida" description="Acoes relacionadas a este contrato, pagamentos e parcelas desta pagina." />
          <CardContent className="grid gap-3">
            {auditLogs.length ? (
              auditLogs.map((log) => (
                <div key={log.id} className="rounded-md border border-slate-100 p-3">
                  <p className="font-medium">{log.description}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {log.action} | {formatDateTime(log.createdAt)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState title="Sem auditoria" description="Nenhuma alteracao auditada foi encontrada para o filtro atual." />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ContractActionBar({
  actions,
  contractId,
  customerId,
  motorcycleId,
  isAdmin
}: {
  actions: ReturnType<typeof getContractActionsForStatus>;
  contractId: string;
  customerId: string;
  motorcycleId: string;
  isAdmin: boolean;
}) {
  const buttonClass =
    "inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-asphalt hover:bg-slate-50";
  const primaryClass =
    "inline-flex h-9 items-center justify-center rounded-md bg-asphalt px-3 text-sm font-medium text-white hover:bg-graphite";

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {actions.includes("EDIT") ? (
        isAdmin ? (
          <a href="#editar-contrato" className={buttonClass}>
            Editar
          </a>
        ) : (
        <span className="inline-flex h-9 items-center justify-center rounded-md border border-slate-100 px-3 text-sm font-medium text-slate-400" title="Somente administradores podem editar contratos.">
          Editar
        </span>
        )
      ) : null}
      {actions.includes("REGISTER_PAYMENT") ? (
        <Link href={`/payments?customerId=${customerId}`} className={primaryClass}>
          Registrar pagamento
        </Link>
      ) : null}
      {actions.includes("VIEW_CUSTOMER") ? (
        <Link href={`/customers/${customerId}`} className={buttonClass}>
          Ver cliente
        </Link>
      ) : null}
      {actions.includes("VIEW_MOTORCYCLE") ? (
        <Link href={`/motorcycles/${motorcycleId}`} className={buttonClass}>
          Ver moto
        </Link>
      ) : null}
      {actions.includes("PRINT") ? (
        <Link href={`/contracts/${contractId}/print`} className={buttonClass}>
          Imprimir
        </Link>
      ) : null}
      {actions.includes("VIEW_HISTORY") ? (
        <Link href="#historico-contrato" className={buttonClass}>
          Ver historico
        </Link>
      ) : null}
      {isAdmin && actions.some((action) => ["SUSPEND", "RESUME", "TERMINATE", "CANCEL"].includes(action)) ? (
        <a href="#acoes-do-contrato" className={buttonClass}>
          Acoes do contrato
        </a>
      ) : null}
    </div>
  );
}

function EditContractPanel({
  contract,
  returnTo
}: {
  contract: {
    id: string;
    expectedEndDate: Date | null;
    lateInterestAmount: { toNumber(): number };
    lateFeeAmount: { toNumber(): number };
    gracePeriodDays: number;
    mileageLimit: number | null;
    notes: string | null;
    customTerms: string | null;
  };
  returnTo: string;
}) {
  return (
    <details id="editar-contrato" className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-asphalt">Editar contrato</summary>
      <form action={updateContractAction} className="mt-4 grid gap-4">
        <input type="hidden" name="contractId" value={contract.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="form-grid-3">
          <Field label="Termino previsto" name="expectedEndDate" type="date" defaultValue={formatDateInput(contract.expectedEndDate)} />
          <Field label="Multa atraso" name="lateFeeAmount" type="number" step="0.01" defaultValue={contract.lateFeeAmount.toNumber()} />
          <Field label="Juros atraso" name="lateInterestAmount" type="number" step="0.01" defaultValue={contract.lateInterestAmount.toNumber()} />
          <Field label="Tolerancia" name="gracePeriodDays" type="number" min={0} defaultValue={contract.gracePeriodDays} />
          <Field label="Limite de km" name="mileageLimit" type="number" min={0} defaultValue={contract.mileageLimit} />
        </div>
        <TextArea label="Observacoes" name="notes" defaultValue={contract.notes} rows={3} />
        <TextArea label="Termos personalizados" name="customTerms" defaultValue={contract.customTerms} rows={4} />
        <Button type="submit" variant="secondary">Salvar alteracoes</Button>
      </form>
    </details>
  );
}

function LifecyclePanels({
  contractId,
  returnTo,
  status,
  todayInput,
  totalAmount,
  totalPaid,
  remaining,
  paidInstallments,
  pendingInstallments,
  overdueInstallments
}: {
  contractId: string;
  returnTo: string;
  status: string;
  todayInput: string;
  totalAmount: number;
  totalPaid: number;
  remaining: number;
  paidInstallments: number;
  pendingInstallments: number;
  overdueInstallments: number;
}) {
  return (
    <div id="acoes-do-contrato" className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 xl:grid-cols-2">
      {["ACTIVE", "OVERDUE"].includes(status) ? (
        <ActionDetails title="Suspender contrato">
          <form action={suspendContractAction} className="grid gap-4">
            <input type="hidden" name="contractId" value={contractId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <div className="form-grid-2">
              <Field label="Data de inicio" name="suspendedAt" type="date" defaultValue={todayInput} required />
              <Field label="Retorno previsto" name="expectedResumeAt" type="date" />
            </div>
            <SelectField label="Motivo" name="suspensionReason" required>
              {suspensionReasons.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </SelectField>
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" name="freezeDueDates" className="mt-1" />
              Congelar vencimentos futuros apenas como registro no MVP.
            </label>
            <TextArea label="Observacao" name="suspensionNotes" rows={3} />
            <Button type="submit" variant="secondary">Suspender contrato</Button>
          </form>
        </ActionDetails>
      ) : null}

      {status === "SUSPENDED" ? (
        <ActionDetails title="Retomar contrato">
          <form action={resumeContractAction} className="grid gap-4">
            <input type="hidden" name="contractId" value={contractId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <Field label="Data de retomada" name="resumedAt" type="date" defaultValue={todayInput} required />
            <TextArea label="Observacao" name="resumeNotes" rows={3} />
            <Button type="submit" variant="secondary">Retomar contrato</Button>
          </form>
        </ActionDetails>
      ) : null}

      {["ACTIVE", "OVERDUE", "SUSPENDED", "DRAFT"].includes(status) ? (
        <ActionDetails title="Encerrar contrato">
          <LifecycleSummary
            totalAmount={totalAmount}
            totalPaid={totalPaid}
            remaining={remaining}
            paidInstallments={paidInstallments}
            pendingInstallments={pendingInstallments}
            overdueInstallments={overdueInstallments}
          />
          <form action={terminateContractAction} className="mt-4 grid gap-4">
            <input type="hidden" name="contractId" value={contractId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <Field label="Data do encerramento" name="terminatedAt" type="date" defaultValue={todayInput} required />
            <SelectField label="Motivo" name="terminationReason" required>
              {terminationReasons.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </SelectField>
            <TextArea label="Observacao obrigatoria" name="terminationNotes" rows={3} />
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" name="cancelFutureInstallments" defaultChecked className="mt-1" />
              Cancelar parcelas futuras pendentes e manter parcelas vencidas em aberto.
            </label>
            <SelectField label="Situacao da moto" name="motorcycleDisposition" defaultValue="AVAILABLE">
              <option value="AVAILABLE">Tornar disponivel</option>
              <option value="MAINTENANCE">Colocar em manutencao</option>
              <option value="BLOCKED">Manter bloqueada</option>
              <option value="SOLD">Marcar como vendida</option>
            </SelectField>
            <ConfirmSubmitButton label="Encerrar contrato" message="Confirmar encerramento antecipado deste contrato?" />
          </form>
        </ActionDetails>
      ) : null}

      {["ACTIVE", "OVERDUE", "SUSPENDED", "DRAFT"].includes(status) ? (
        <ActionDetails title="Cancelar contrato">
          <LifecycleSummary
            totalAmount={totalAmount}
            totalPaid={totalPaid}
            remaining={remaining}
            paidInstallments={paidInstallments}
            pendingInstallments={pendingInstallments}
            overdueInstallments={overdueInstallments}
          />
          <form action={cancelContractAction} className="mt-4 grid gap-4">
            <input type="hidden" name="contractId" value={contractId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <Field label="Data do cancelamento" name="cancelledAt" type="date" defaultValue={todayInput} required />
            <SelectField label="Motivo" name="cancellationReason" required>
              {cancellationReasons.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </SelectField>
            <TextArea label="Observacao obrigatoria" name="cancellationNotes" rows={3} />
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" name="cancelFutureInstallments" defaultChecked className="mt-1" />
              Cancelar parcelas futuras pendentes.
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input type="checkbox" name="releaseMotorcycle" defaultChecked className="mt-1" />
              Liberar a moto como disponivel.
            </label>
            <ConfirmSubmitButton label="Cancelar contrato" message="Confirmar cancelamento sem apagar o historico financeiro?" />
          </form>
        </ActionDetails>
      ) : null}
    </div>
  );
}

function LifecycleSummary({
  totalAmount,
  totalPaid,
  remaining,
  paidInstallments,
  pendingInstallments,
  overdueInstallments
}: {
  totalAmount: number;
  totalPaid: number;
  remaining: number;
  paidInstallments: number;
  pendingInstallments: number;
  overdueInstallments: number;
}) {
  return (
    <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm sm:grid-cols-3">
      <Info label="Total" value={formatCurrency(totalAmount)} />
      <Info label="Pago" value={formatCurrency(totalPaid)} />
      <Info label="Saldo" value={formatCurrency(remaining)} />
      <Info label="Pagas" value={paidInstallments} />
      <Info label="Pendentes" value={pendingInstallments} />
      <Info label="Atrasadas" value={overdueInstallments} />
    </div>
  );
}

function RenegotiateInstallmentForm({
  contractId,
  installment,
  returnTo
}: {
  contractId: string;
  installment: {
    id: string;
    dueDate: Date;
    discountAmount: { toNumber(): number };
    penaltyAmount: { toNumber(): number };
    interestAmount: { toNumber(): number };
    finalAmount: { toNumber(): number };
    originalAmount: { toNumber(): number };
    paidAmount: { toNumber(): number };
  };
  returnTo: string;
}) {
  return (
    <details className="rounded-md border border-slate-100 bg-slate-50 p-2">
      <summary className="cursor-pointer text-sm font-medium text-petrol">Renegociar parcela</summary>
      <form action={renegotiateInstallmentAction} className="mt-3 grid gap-3">
        <input type="hidden" name="contractId" value={contractId} />
        <input type="hidden" name="installmentId" value={installment.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
          <span>Atual: {formatDate(installment.dueDate)}</span>
          <span>Original: {formatCurrency(installment.originalAmount)}</span>
          <span>Pago: {formatCurrency(installment.paidAmount)}</span>
        </div>
        <div className="form-grid-3">
          <Field label="Novo vencimento" name="newDueDate" type="date" defaultValue={formatDateInput(installment.dueDate)} required />
          <Field label="Desconto" name="discountAmount" type="number" step="0.01" defaultValue={installment.discountAmount.toNumber()} />
          <Field label="Multa" name="penaltyAmount" type="number" step="0.01" defaultValue={installment.penaltyAmount.toNumber()} />
          <Field label="Juros" name="interestAmount" type="number" step="0.01" defaultValue={installment.interestAmount.toNumber()} />
        </div>
        <Field label="Motivo" name="renegotiationReason" required />
        <TextArea label="Observacao" name="renegotiationNotes" rows={2} />
        <Button type="submit" size="sm" variant="secondary">Salvar renegociacao</Button>
      </form>
    </details>
  );
}

function ReversePaymentForm({ paymentId, returnTo }: { paymentId: string; returnTo: string }) {
  return (
    <details className="mt-3 rounded-md border border-red-100 bg-red-50 p-3">
      <summary className="cursor-pointer text-sm font-medium text-red-700">Estornar pagamento</summary>
      <form action={reversePaymentAction} className="mt-3 grid gap-3">
        <input type="hidden" name="paymentId" value={paymentId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <Field label="Motivo" name="reversalReason" required />
        <TextArea label="Observacao obrigatoria" name="reversalNotes" rows={2} />
        <ConfirmSubmitButton label="Confirmar estorno" message="Confirmar estorno deste pagamento e reabrir o saldo da parcela?" />
      </form>
    </details>
  );
}

function ActionDetails({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-lg border border-slate-100 bg-slate-50 p-3" open={false}>
      <summary className="cursor-pointer text-sm font-semibold text-asphalt">{title}</summary>
      <div className="mt-4">{children}</div>
    </details>
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

function PaginationControls({
  contractId,
  query,
  pagination
}: {
  contractId: string;
  query: ReturnType<typeof parseContractInstallmentQuery>;
  pagination: {
    page: number;
    totalPages: number;
  };
}) {
  const previousPage = Math.max(pagination.page - 1, 1);
  const nextPage = Math.min(pagination.page + 1, pagination.totalPages);
  const pages = getVisiblePageNumbers(pagination.page, pagination.totalPages);

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2">
        {pagination.page > 1 ? (
          <Link
            href={buildContractInstallmentsHref(contractId, query, { page: previousPage })}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm hover:bg-slate-50"
          >
            Anterior
          </Link>
        ) : (
          <span className="inline-flex h-9 items-center justify-center rounded-md border border-slate-100 px-3 text-sm text-slate-400">
            Anterior
          </span>
        )}
        {pagination.page < pagination.totalPages ? (
          <Link
            href={buildContractInstallmentsHref(contractId, query, { page: nextPage })}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm hover:bg-slate-50"
          >
            Proxima
          </Link>
        ) : (
          <span className="inline-flex h-9 items-center justify-center rounded-md border border-slate-100 px-3 text-sm text-slate-400">
            Proxima
          </span>
        )}
      </div>
      <div className="hidden gap-2 sm:flex">
        {pages.map((page) => (
          <Link
            key={page}
            href={buildContractInstallmentsHref(contractId, query, { page })}
            className={
              page === pagination.page
                ? "inline-flex h-9 min-w-9 items-center justify-center rounded-md bg-asphalt px-3 text-sm font-medium text-white"
                : "inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm hover:bg-slate-50"
            }
          >
            {page}
          </Link>
        ))}
      </div>
    </div>
  );
}
