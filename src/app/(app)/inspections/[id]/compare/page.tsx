import Link from "next/link";
import { notFound } from "next/navigation";
import { InspectionStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import {
  formatCurrency,
  formatDate,
  fuelLevelLabels,
  inspectionConditionLabels,
  inspectionTypeLabels
} from "@/lib/format";
import { getInspectionComparison } from "@/services/inspections";

export default async function InspectionComparePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCompanyRole();
  const { inspection, delivery, comparison } = await getInspectionComparison(user.companyId!, id);

  if (!inspection) {
    notFound();
  }

  const changedItems = comparison.filter((item) => item.changed);
  const newDamages = comparison.filter((item) => item.newDamage);

  return (
    <>
      <PageHeader
        title={`Comparacao ${inspection.code}`}
        description="Diferencas entre vistoria de entrega e devolucao."
        breadcrumbs={[
          { label: "Vistorias", href: "/inspections" },
          { label: inspection.code, href: `/inspections/${inspection.id}` },
          { label: "Comparacao" }
        ]}
      />

      {!delivery ? (
        <Card>
          <CardHeader title="Entrega nao encontrada" />
          <CardContent>
            <EmptyState
              title="Sem base de comparacao"
              description="Esta devolucao ainda nao possui uma vistoria de entrega concluida vinculada ao mesmo contrato."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader title="Entrega" />
              <CardContent className="grid gap-2 text-sm">
                <InspectionStatusBadge status={delivery.status} />
                <p>{inspectionTypeLabels[delivery.type]} em {formatDate(delivery.inspectionDate)}</p>
                <p>{delivery.mileage} km | {fuelLevelLabels[delivery.fuelLevel]}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Devolucao" />
              <CardContent className="grid gap-2 text-sm">
                <InspectionStatusBadge status={inspection.status} />
                <p>{inspectionTypeLabels[inspection.type]} em {formatDate(inspection.inspectionDate)}</p>
                <p>{inspection.mileage} km | {fuelLevelLabels[inspection.fuelLevel]}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Resultado" />
              <CardContent className="grid gap-2 text-sm">
                <p><strong>{changedItems.length}</strong> item(ns) com diferenca.</p>
                <p><strong>{newDamages.length}</strong> nova(s) avaria(s).</p>
                <p>Km excedente: <strong>{inspection.mileageExcess ?? 0} km</strong></p>
                <p>Valor por excesso: <strong>{formatCurrency(inspection.mileageExcessCharge)}</strong></p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Itens comparados"
              description={`${comparison.length} item(ns) analisado(s).`}
              action={
                <Link href={`/inspections/${inspection.id}`} className="text-sm font-medium text-petrol hover:underline">
                  Voltar para vistoria
                </Link>
              }
            />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Entrega</th>
                      <th className="px-3 py-2">Devolucao</th>
                      <th className="px-3 py-2">Resultado</th>
                      <th className="px-3 py-2">Observacoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparison.map((item) => (
                      <tr key={item.itemKey} className={item.newDamage ? "bg-amber-50/60" : undefined}>
                        <td className="px-3 py-3 font-medium text-slate-700">{item.itemKey}</td>
                        <td className="px-3 py-3">{inspectionConditionLabels[item.deliveryCondition]}</td>
                        <td className="px-3 py-3">{inspectionConditionLabels[item.returnCondition]}</td>
                        <td className="px-3 py-3">
                          {item.newDamage ? "Nova avaria" : item.changed ? "Alterado" : "Sem mudanca"}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {item.deliveryNotes ? `Entrega: ${item.deliveryNotes}` : ""}
                          {item.returnNotes ? `${item.deliveryNotes ? " | " : ""}Devolucao: ${item.returnNotes}` : ""}
                          {!item.deliveryNotes && !item.returnNotes ? "-" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
