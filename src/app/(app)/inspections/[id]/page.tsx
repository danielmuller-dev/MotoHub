import Link from "next/link";
import { notFound } from "next/navigation";
import { Edit, FileText, GitCompareArrows, Printer } from "lucide-react";
import { cancelInspectionAction } from "@/app/actions";
import {
  AdditionalChargeStatusBadge,
  DamageStatusBadge,
  InspectionStatusBadge,
  MotorcycleStatusBadge
} from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import {
  additionalChargeTypeLabels,
  damageResponsiblePartyLabels,
  damageSeverityLabels,
  formatCurrency,
  formatDate,
  formatDateTime,
  fuelLevelLabels,
  inspectionConditionLabels,
  inspectionPhotoTypeLabels,
  inspectionSignatureTypeLabels,
  inspectionTypeLabels
} from "@/lib/format";
import { canCancelInspection, canEditInspection } from "@/lib/inspection-rules";
import { prisma } from "@/lib/prisma";

function Info({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  return (
    <div className="grid gap-1 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
      <span className="text-xs font-medium uppercase text-slate-500">{label}</span>
      {href ? (
        <Link href={href} className="font-medium text-petrol hover:underline">
          {value}
        </Link>
      ) : (
        <span className="font-medium text-asphalt">{value ?? "-"}</span>
      )}
    </div>
  );
}

function groupedItems<T extends { category: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  }
  return Array.from(groups.entries());
}

export default async function InspectionDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCompanyRole();
  const inspection = await prisma.inspection.findFirst({
    where: { id, companyId: user.companyId! },
    include: {
      company: true,
      contract: true,
      customer: true,
      motorcycle: true,
      createdBy: true,
      completedBy: true,
      cancelledBy: true,
      items: { orderBy: [{ category: "asc" }, { itemLabel: "asc" }] },
      photos: { where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      damages: { include: { item: true }, orderBy: { createdAt: "asc" } },
      accessories: { orderBy: { name: "asc" } },
      signatures: { orderBy: { createdAt: "asc" } },
      charges: { orderBy: { createdAt: "asc" } },
      maintenances: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!inspection) {
    notFound();
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      companyId: user.companyId!,
      entity: "Inspection",
      entityId: inspection.id
    },
    orderBy: { createdAt: "desc" },
    take: 8
  });

  const canEdit = canEditInspection(inspection.status, user.role);
  const canCancel = canCancelInspection(inspection.status, user.role);

  return (
    <>
      <PageHeader
        title={inspection.code}
        description={`${inspectionTypeLabels[inspection.type]} da moto ${inspection.motorcycle.plate}.`}
        breadcrumbs={[{ label: "Vistorias", href: "/inspections" }, { label: inspection.code }]}
        action={
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Link
                href={`/inspections/${inspection.id}/edit`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-asphalt hover:bg-slate-50"
              >
                <Edit className="h-4 w-4" aria-hidden="true" />
                Editar
              </Link>
            ) : null}
            {inspection.type === "RETURN" ? (
              <Link
                href={`/inspections/${inspection.id}/compare`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-asphalt hover:bg-slate-50"
              >
                <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                Comparar
              </Link>
            ) : null}
            <Link
              href={`/inspections/${inspection.id}/print`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-asphalt px-4 text-sm font-medium text-white hover:bg-graphite"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Imprimir
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader title="Resumo" />
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <InspectionStatusBadge status={inspection.status} />
              <MotorcycleStatusBadge status={inspection.motorcycle.status} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Tipo" value={inspectionTypeLabels[inspection.type]} />
              <Info label="Data" value={formatDate(inspection.inspectionDate)} />
              <Info label="Moto" value={`${inspection.motorcycle.brand} ${inspection.motorcycle.model} - ${inspection.motorcycle.plate}`} href={`/motorcycles/${inspection.motorcycleId}`} />
              <Info label="Cliente" value={inspection.customer?.fullName ?? "-"} href={inspection.customerId ? `/customers/${inspection.customerId}` : undefined} />
              <Info label="Contrato" value={inspection.contract?.code ?? "-"} href={inspection.contractId ? `/contracts/${inspection.contractId}` : undefined} />
              <Info label="Quilometragem" value={`${inspection.mileage} km`} />
              <Info label="Combustivel" value={fuelLevelLabels[inspection.fuelLevel]} />
              <Info label="Local" value={inspection.location ?? "-"} />
              <Info label="Responsavel" value={inspection.completedBy?.name ?? inspection.createdBy?.name ?? "-"} />
              <Info label="Concluida em" value={formatDateTime(inspection.completedAt)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Resultado operacional" />
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Info label="Avarias" value={inspection.damages.length} />
              <Info label="Cobrancas" value={inspection.charges.length} />
              <Info label="Fotos" value={inspection.photos.length} />
              <Info label="Km rodado" value={inspection.mileageDriven !== null ? `${inspection.mileageDriven} km` : "-"} />
              <Info label="Km excedente" value={inspection.mileageExcess !== null ? `${inspection.mileageExcess} km` : "-"} />
              <Info label="Valor excedente" value={formatCurrency(inspection.mileageExcessCharge)} />
            </div>
            {inspection.generalCondition ? (
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                <strong className="text-asphalt">Condicao geral:</strong> {inspection.generalCondition}
              </div>
            ) : null}
            {inspection.generalDamages ? (
              <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-sm text-amber-800">
                <strong>Avarias gerais:</strong> {inspection.generalDamages}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Checklist" description={`${inspection.items.length} item(s) verificado(s).`} />
        <CardContent className="grid gap-5">
          {groupedItems(inspection.items).map(([category, items]) => (
            <div key={category} className="overflow-hidden rounded-lg border border-slate-100">
              <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-asphalt">{category}</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Condicao</th>
                      <th className="px-3 py-2">Marcacoes</th>
                      <th className="px-3 py-2">Custo</th>
                      <th className="px-3 py-2">Observacao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-3 font-medium text-slate-700">{item.itemLabel}</td>
                        <td className="px-3 py-3">{inspectionConditionLabels[item.condition]}</td>
                        <td className="px-3 py-3 text-xs text-slate-500">
                          {[
                            item.preExisting ? "Preexistente" : null,
                            item.newDamage ? "Nova avaria" : null,
                            item.chargeCustomer ? "Cobrar cliente" : null
                          ].filter(Boolean).join(" | ") || "-"}
                        </td>
                        <td className="px-3 py-3">{formatCurrency(item.estimatedCost)}</td>
                        <td className="px-3 py-3">{item.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Avarias" />
          <CardContent>
            {inspection.damages.length ? (
              <div className="grid gap-3">
                {inspection.damages.map((damage) => (
                  <div key={damage.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-asphalt">{damage.title}</p>
                      <DamageStatusBadge status={damage.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{damage.description ?? "Sem observacao."}</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                      <span>Gravidade: {damageSeverityLabels[damage.severity]}</span>
                      <span>Responsavel: {damageResponsiblePartyLabels[damage.responsibleParty]}</span>
                      <span>Valor: {formatCurrency(damage.approvedChargeAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Sem avarias" description="Nenhuma avaria registrada nesta vistoria." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Cobrancas adicionais" />
          <CardContent>
            {inspection.charges.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Codigo</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2">Vencimento</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspection.charges.map((charge) => (
                      <tr key={charge.id}>
                        <td className="px-3 py-3">{charge.code}</td>
                        <td className="px-3 py-3">{additionalChargeTypeLabels[charge.type]}</td>
                        <td className="px-3 py-3">{formatCurrency(charge.amount)}</td>
                        <td className="px-3 py-3">{formatDate(charge.dueDate)}</td>
                        <td className="px-3 py-3"><AdditionalChargeStatusBadge status={charge.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sem cobrancas" description="Nenhuma cobranca adicional foi gerada." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Fotos" />
          <CardContent>
            {inspection.photos.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {inspection.photos.map((photo) => (
                  <figure key={photo.id} className="overflow-hidden rounded-lg border border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.caption ?? inspectionPhotoTypeLabels[photo.type]} className="h-48 w-full object-cover" />
                    <figcaption className="p-3 text-sm text-slate-600">
                      {inspectionPhotoTypeLabels[photo.type]}{photo.caption ? ` | ${photo.caption}` : ""}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <EmptyState title="Sem fotos" description="Nenhuma foto anexada nesta vistoria." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Assinaturas e historico" />
          <CardContent className="grid gap-5">
            {inspection.signatures.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {inspection.signatures.map((signature) => (
                  <figure key={signature.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={signature.imageUrl} alt={signature.signedByName} className="h-28 w-full rounded-md bg-white object-contain" />
                    <figcaption className="mt-2 text-sm text-slate-600">
                      {inspectionSignatureTypeLabels[signature.type]}: {signature.signedByName}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <EmptyState title="Sem assinaturas" description="Nenhuma assinatura registrada nesta vistoria." />
            )}
            <div className="grid gap-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex gap-3 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                  <FileText className="mt-0.5 h-4 w-4 text-petrol" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-asphalt">{log.description}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {canCancel ? (
        <Card className="mt-6 border-red-100">
          <CardHeader title="Cancelar vistoria" description="Use apenas para correcoes administrativas ou erro operacional." />
          <CardContent>
            <form action={cancelInspectionAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input type="hidden" name="inspectionId" value={inspection.id} />
              <input type="hidden" name="returnTo" value={`/inspections/${inspection.id}`} />
              <Field label="Motivo do cancelamento" name="cancellationReason" required />
              <div className="flex items-end">
                <Button type="submit" variant="danger" className="w-full">
                  Cancelar vistoria
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
