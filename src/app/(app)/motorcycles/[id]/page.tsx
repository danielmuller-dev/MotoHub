import Link from "next/link";
import { Bike } from "lucide-react";
import { notFound } from "next/navigation";
import { ContractStatusBadge, InspectionStatusBadge, MotorcycleStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { formatCurrency, formatDate, inspectionTypeLabels } from "@/lib/format";
import { sumConfirmedPayments } from "@/lib/payment-totals";
import { prisma } from "@/lib/prisma";

export default async function MotorcycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCompanyRole();
  const motorcycle = await prisma.motorcycle.findFirst({
    where: { id, companyId: user.companyId!, deletedAt: null },
    include: {
      currentCustomer: true,
      contracts: {
        orderBy: { createdAt: "desc" },
        include: { customer: true, payments: true }
      },
      maintenances: {
        orderBy: { date: "desc" }
      },
      documents: {
        orderBy: { expirationDate: "asc" }
      },
      inspections: {
        orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
        take: 5
      }
    }
  });

  if (!motorcycle) {
    notFound();
  }

  const activeContract = motorcycle.contracts.find((contract) =>
    ["ACTIVE", "OVERDUE", "SUSPENDED"].includes(contract.status)
  );
  const maintenanceCost = motorcycle.maintenances.reduce(
    (sum, maintenance) => sum + maintenance.amount.toNumber(),
    0
  );

  return (
    <>
      <PageHeader
        title={`${motorcycle.brand} ${motorcycle.model}`}
        description="Historico operacional, contrato atual, documentos e manutencoes."
        breadcrumbs={[{ label: "Motos", href: "/motorcycles" }, { label: motorcycle.plate }]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardContent className="p-0">
            {motorcycle.photoUrl ? (
              <div
                role="img"
                aria-label={`${motorcycle.brand} ${motorcycle.model}`}
                className="aspect-video w-full rounded-t-lg bg-cover bg-center"
                style={{ backgroundImage: `url(${motorcycle.photoUrl})` }}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-t-lg bg-slate-100">
                <Bike className="h-14 w-14 text-slate-400" aria-hidden="true" />
              </div>
            )}
            <div className="grid gap-3 p-5 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-lg font-semibold">{motorcycle.plate}</p>
                <MotorcycleStatusBadge status={motorcycle.status} />
              </div>
              <Info label="Ano" value={`${motorcycle.manufactureYear || "-"} / ${motorcycle.modelYear || "-"}`} />
              <Info label="Renavam" value={motorcycle.renavam} />
              <Info label="Chassi" value={motorcycle.chassis} />
              <Info label="Cor" value={motorcycle.color} />
              <Info label="Cilindrada" value={motorcycle.engineCapacity ? `${motorcycle.engineCapacity} cc` : null} />
              <Info label="Quilometragem" value={`${motorcycle.currentMileage.toLocaleString("pt-BR")} km`} />
              <Info label="Valor aquisicao" value={formatCurrency(motorcycle.acquisitionValue)} />
              <Info label="Data aquisicao" value={formatDate(motorcycle.acquisitionDate)} />
              <Info label="Custos de manutencao" value={formatCurrency(maintenanceCost)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Situacao atual" />
          <CardContent>
            {activeContract ? (
              <div className="grid gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Link href={`/contracts/${activeContract.id}`} className="text-lg font-semibold text-petrol hover:underline">
                      {activeContract.code}
                    </Link>
                    <p className="text-sm text-slate-500">{activeContract.customer.fullName}</p>
                  </div>
                  <ContractStatusBadge status={activeContract.status} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Info label="Inicio" value={formatDate(activeContract.startDate)} />
                  <Info label="Total" value={formatCurrency(activeContract.totalAmount)} />
                  <Info label="Pagamentos" value={formatCurrency(sumConfirmedPayments(activeContract.payments))} />
                </div>
              </div>
            ) : (
              <EmptyState title="Sem contrato ativo" description="A moto esta sem contrato ativo vinculado." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Vistorias"
          description="Ultimas entregas, devolucoes e acompanhamentos desta moto."
          action={
            <Link href={`/motorcycles/${motorcycle.id}/inspections`} className="text-sm font-medium text-petrol hover:underline">
              Ver todas
            </Link>
          }
        />
        <CardContent>
          {motorcycle.inspections.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Km</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {motorcycle.inspections.map((inspection) => (
                    <tr key={inspection.id}>
                      <td className="px-3 py-3">
                        <Link href={`/inspections/${inspection.id}`} className="font-medium text-petrol hover:underline">
                          {inspection.code}
                        </Link>
                      </td>
                      <td className="px-3 py-3">{inspectionTypeLabels[inspection.type]}</td>
                      <td className="px-3 py-3">{formatDate(inspection.inspectionDate)}</td>
                      <td className="px-3 py-3">{inspection.mileage} km</td>
                      <td className="px-3 py-3"><InspectionStatusBadge status={inspection.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Sem vistorias" description="Nenhuma vistoria foi registrada para esta moto." />
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Historico de contratos" />
          <CardContent className="grid gap-3">
            {motorcycle.contracts.map((contract) => (
              <Link key={contract.id} href={`/contracts/${contract.id}`} className="rounded-md border border-slate-100 p-3 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{contract.code}</p>
                  <ContractStatusBadge status={contract.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{contract.customer.fullName}</p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Manutencoes" />
          <CardContent className="grid gap-3">
            {motorcycle.maintenances.length ? (
              motorcycle.maintenances.map((maintenance) => (
                <div key={maintenance.id} className="rounded-md border border-slate-100 p-3">
                  <p className="font-medium">{maintenance.description}</p>
                  <p className="text-sm text-slate-500">
                    {formatDate(maintenance.date)} | {formatCurrency(maintenance.amount)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState title="Sem manutencoes" description="Nenhuma manutencao foi registrada para esta moto." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Documentos" />
          <CardContent className="grid gap-3">
            {motorcycle.documents.length ? (
              motorcycle.documents.map((document) => (
                <a key={document.id} href={document.fileUrl} target="_blank" className="rounded-md border border-slate-100 p-3 hover:bg-slate-50">
                  <p className="font-medium">{document.name}</p>
                  <p className="text-sm text-slate-500">Validade: {formatDate(document.expirationDate)}</p>
                </a>
              ))
            ) : (
              <EmptyState title="Sem documentos" description="Nenhum documento foi vinculado a esta moto." />
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
