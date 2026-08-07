import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { ContractStatusBadge, InstallmentStatusBadge, InspectionStatusBadge } from "@/components/status-badge";
import { requireCompanyRole } from "@/lib/auth";
import { formatCurrency, formatDate, inspectionTypeLabels } from "@/lib/format";
import { sumConfirmedPayments } from "@/lib/payment-totals";
import { prisma } from "@/lib/prisma";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCompanyRole();
  const customer = await prisma.customer.findFirst({
    where: { id, companyId: user.companyId!, deletedAt: null },
    include: {
      contracts: {
        orderBy: { createdAt: "desc" },
        include: {
          motorcycle: true,
          installments: true,
          payments: true
        }
      },
      documents: true,
      notificationRecipients: {
        include: { notification: true },
        orderBy: { createdAt: "desc" },
        take: 6
      },
      inspections: {
        orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
        take: 5,
        include: {
          motorcycle: true,
          contract: true
        }
      }
    }
  });

  if (!customer) {
    notFound();
  }

  const activeContract = customer.contracts.find((contract) =>
    ["ACTIVE", "OVERDUE", "SUSPENDED"].includes(contract.status)
  );
  const totalPaid = sumConfirmedPayments(customer.contracts.flatMap((contract) => contract.payments));
  const currentTotal = activeContract?.totalAmount.toNumber() ?? 0;
  const currentPaid = activeContract ? sumConfirmedPayments(activeContract.payments) : 0;
  const progress = currentTotal > 0 ? (currentPaid / currentTotal) * 100 : 0;

  return (
    <>
      <PageHeader
        title={customer.fullName}
        description="Perfil, contrato atual, historico financeiro e documentos."
        breadcrumbs={[{ label: "Clientes", href: "/customers" }, { label: customer.fullName }]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader title="Informacoes pessoais" />
          <CardContent className="grid gap-3 text-sm">
            <Info label="CPF" value={customer.cpf} />
            <Info label="E-mail" value={customer.email} />
            <Info label="Telefone" value={customer.phone || customer.whatsapp} />
            <Info label="CNH" value={customer.driverLicenseNumber} />
            <Info label="Validade CNH" value={formatDate(customer.driverLicenseExpiration)} />
            <Info label="Endereco" value={[customer.address, customer.number, customer.district, customer.city, customer.state].filter(Boolean).join(", ")} />
            <Info label="Emergencia" value={[customer.emergencyContactName, customer.emergencyContactPhone].filter(Boolean).join(" - ")} />
            <Info label="Observacoes" value={customer.notes} />
            <Info label="Total ja pago" value={formatCurrency(totalPaid)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Contrato atual" />
          <CardContent>
            {activeContract ? (
              <div className="grid gap-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link href={`/contracts/${activeContract.id}`} className="text-lg font-semibold text-asphalt hover:text-petrol">
                      {activeContract.code}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {activeContract.motorcycle.brand} {activeContract.motorcycle.model} | {activeContract.motorcycle.plate}
                    </p>
                  </div>
                  <ContractStatusBadge status={activeContract.status} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Info label="Total do contrato" value={formatCurrency(activeContract.totalAmount)} />
                  <Info label="Pago" value={formatCurrency(currentPaid)} />
                  <Info label="Saldo" value={formatCurrency(Math.max(currentTotal - currentPaid, 0))} />
                </div>
                <ProgressBar value={progress} />
                <p className="text-sm text-slate-500">{progress.toFixed(0)}% concluido</p>
              </div>
            ) : (
              <EmptyState title="Sem contrato ativo" description="Este cliente nao possui contrato ativo no momento." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Contratos anteriores e atuais" />
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Contrato</th>
                  <th className="px-3 py-2">Moto</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customer.contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td className="px-3 py-3">
                      <Link href={`/contracts/${contract.id}`} className="font-medium text-petrol hover:underline">
                        {contract.code}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{contract.motorcycle.plate}</td>
                    <td className="px-3 py-3"><ContractStatusBadge status={contract.status} /></td>
                    <td className="px-3 py-3">{formatCurrency(contract.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Parcelas atrasadas" />
          <CardContent className="grid gap-3">
            {customer.contracts
              .flatMap((contract) => contract.installments.map((installment) => ({ ...installment, contract })))
              .filter((installment) => installment.status === "OVERDUE")
              .map((installment) => (
                <div key={installment.id} className="rounded-md border border-red-100 bg-red-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Parcela {installment.number}</p>
                    <InstallmentStatusBadge status={installment.status} />
                  </div>
                  <p className="mt-1 text-sm text-red-700">
                    {formatCurrency(installment.finalAmount)} | venceu em {formatDate(installment.dueDate)}
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Vistorias"
          description="Ultimas entregas, devolucoes e acompanhamentos deste cliente."
          action={
            <Link href={`/customers/${customer.id}/inspections`} className="text-sm font-medium text-petrol hover:underline">
              Ver todas
            </Link>
          }
        />
        <CardContent>
          {customer.inspections.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Moto</th>
                    <th className="px-3 py-2">Contrato</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customer.inspections.map((inspection) => (
                    <tr key={inspection.id}>
                      <td className="px-3 py-3">
                        <Link href={`/inspections/${inspection.id}`} className="font-medium text-petrol hover:underline">
                          {inspection.code}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{inspectionTypeLabels[inspection.type]}</td>
                      <td className="px-3 py-3">{formatDate(inspection.inspectionDate)}</td>
                      <td className="px-3 py-3">{inspection.motorcycle.plate}</td>
                      <td className="px-3 py-3">{inspection.contract?.code ?? "-"}</td>
                      <td className="px-3 py-3"><InspectionStatusBadge status={inspection.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Sem vistorias" description="Nenhuma vistoria foi registrada para este cliente." />
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Documentos" />
          <CardContent className="grid gap-3">
            {customer.documents.length ? (
              customer.documents.map((document) => (
                <a key={document.id} href={document.fileUrl} target="_blank" className="rounded-md border border-slate-100 p-3 hover:bg-slate-50">
                  <p className="font-medium">{document.name}</p>
                  <p className="text-xs text-slate-500">Validade: {formatDate(document.expirationDate)}</p>
                </a>
              ))
            ) : (
              <EmptyState title="Sem documentos" description="Nenhum documento foi vinculado a este cliente." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Avisos enviados" />
          <CardContent className="grid gap-3">
            {customer.notificationRecipients.length ? (
              customer.notificationRecipients.map((recipient) => (
                <div key={recipient.id} className="rounded-md border border-slate-100 p-3">
                  <p className="font-medium">{recipient.notification.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{recipient.notification.message}</p>
                  <p className="mt-2 text-xs text-slate-400">{recipient.readAt ? "Lido" : "Nao lido"}</p>
                </div>
              ))
            ) : (
              <EmptyState title="Sem avisos" description="Nenhum aviso foi enviado para este cliente." />
            )}
          </CardContent>
        </Card>
      </div>
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
