import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { InspectionStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { formatDate, inspectionTypeLabels } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function ContractInspectionsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCompanyRole();
  const contract = await prisma.contract.findFirst({
    where: { id, companyId: user.companyId!, deletedAt: null },
    include: { customer: true, motorcycle: true }
  });

  if (!contract) {
    notFound();
  }

  const inspections = await prisma.inspection.findMany({
    where: { companyId: user.companyId!, contractId: contract.id },
    orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { damages: true, photos: true, charges: true } } }
  });

  return (
    <>
      <PageHeader
        title={`Vistorias do contrato ${contract.code}`}
        description={`${contract.customer.fullName} | ${contract.motorcycle.plate}`}
        breadcrumbs={[
          { label: "Contratos", href: "/contracts" },
          { label: contract.code, href: `/contracts/${contract.id}` },
          { label: "Vistorias" }
        ]}
        action={
          <Link
            href={`/inspections/new?contractId=${contract.id}&type=DELIVERY`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-asphalt px-4 text-sm font-medium text-white hover:bg-graphite"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova vistoria
          </Link>
        }
      />

      <InspectionTable inspections={inspections} emptyDescription="Este contrato ainda nao possui vistorias." />
    </>
  );
}

function InspectionTable({
  inspections,
  emptyDescription
}: {
  inspections: Array<{
    id: string;
    code: string;
    type: keyof typeof inspectionTypeLabels;
    inspectionDate: Date;
    mileage: number;
    status: Parameters<typeof InspectionStatusBadge>[0]["status"];
    _count: { damages: number; photos: number; charges: number };
  }>;
  emptyDescription: string;
}) {
  return (
    <Card>
      <CardHeader title="Historico de vistorias" description={`${inspections.length} registro(s).`} />
      <CardContent>
        {inspections.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
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
                {inspections.map((inspection) => (
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
                      {inspection._count.damages} avaria(s), {inspection._count.photos} foto(s), {inspection._count.charges} cobranca(s)
                    </td>
                    <td className="px-3 py-3"><InspectionStatusBadge status={inspection.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Sem vistorias" description={emptyDescription} />
        )}
      </CardContent>
    </Card>
  );
}
