import Link from "next/link";
import { notFound } from "next/navigation";
import { InspectionStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import {
  formatCurrency,
  formatDate,
  fuelLevelLabels,
  inspectionConditionLabels,
  inspectionPhotoTypeLabels,
  inspectionTypeLabels
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function CustomerPortalInspectionDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole(["CUSTOMER"]);
  const inspection = await prisma.inspection.findFirst({
    where: {
      id,
      companyId: user.companyId!,
      customerId: user.customerId!,
      status: { in: ["COMPLETED", "CANCELLED"] }
    },
    include: {
      contract: true,
      motorcycle: true,
      items: { orderBy: [{ category: "asc" }, { itemLabel: "asc" }] },
      photos: { where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      damages: { orderBy: { createdAt: "asc" } },
      charges: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!inspection) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title={inspection.code}
        description={`${inspectionTypeLabels[inspection.type]} da moto ${inspection.motorcycle.plate}.`}
        breadcrumbs={[
          { label: "Minhas vistorias", href: "/customer/inspections" },
          { label: inspection.code }
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader title="Resumo" />
          <CardContent className="grid gap-3 text-sm">
            <InspectionStatusBadge status={inspection.status} />
            <Info label="Tipo" value={inspectionTypeLabels[inspection.type]} />
            <Info label="Data" value={formatDate(inspection.inspectionDate)} />
            <Info label="Moto" value={`${inspection.motorcycle.brand} ${inspection.motorcycle.model} - ${inspection.motorcycle.plate}`} />
            <Info label="Contrato" value={inspection.contract?.code} />
            <Info label="Quilometragem" value={`${inspection.mileage} km`} />
            <Info label="Combustivel" value={fuelLevelLabels[inspection.fuelLevel]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Resultado" />
          <CardContent className="grid gap-3 text-sm">
            <Info label="Avarias" value={inspection.damages.length} />
            <Info label="Cobrancas" value={inspection.charges.length} />
            <Info label="Km rodado" value={inspection.mileageDriven !== null ? `${inspection.mileageDriven} km` : null} />
            <Info label="Km excedente" value={inspection.mileageExcess !== null ? `${inspection.mileageExcess} km` : null} />
            <Info label="Valor excedente" value={formatCurrency(inspection.mileageExcessCharge)} />
            <Info label="Observacoes" value={inspection.generalCondition || inspection.notes} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Checklist" />
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Condicao</th>
                  <th className="px-3 py-2">Observacao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inspection.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3">{item.itemLabel}</td>
                    <td className="px-3 py-3">{inspectionConditionLabels[item.condition]}</td>
                    <td className="px-3 py-3">{item.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Fotos" />
        <CardContent>
          {inspection.photos.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            <EmptyState title="Sem fotos" description="Nenhuma foto foi anexada nesta vistoria." />
          )}
        </CardContent>
      </Card>

      <div className="mt-6">
        <Link href="/customer/inspections" className="text-sm font-medium text-petrol hover:underline">
          Voltar para minhas vistorias
        </Link>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value?: React.ReactNode | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-asphalt">{value || "-"}</p>
    </div>
  );
}
