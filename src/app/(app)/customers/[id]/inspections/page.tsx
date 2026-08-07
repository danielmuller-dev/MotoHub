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

export default async function CustomerInspectionsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCompanyRole();
  const customer = await prisma.customer.findFirst({
    where: { id, companyId: user.companyId!, deletedAt: null }
  });

  if (!customer) {
    notFound();
  }

  const inspections = await prisma.inspection.findMany({
    where: { companyId: user.companyId!, customerId: customer.id },
    orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
    include: { contract: true, motorcycle: true, _count: { select: { damages: true, photos: true } } }
  });

  return (
    <>
      <PageHeader
        title={`Vistorias de ${customer.fullName}`}
        description={`CPF ${customer.cpf}`}
        breadcrumbs={[
          { label: "Clientes", href: "/customers" },
          { label: customer.fullName, href: `/customers/${customer.id}` },
          { label: "Vistorias" }
        ]}
        action={
          <Link
            href={`/inspections/new?type=EXTRAORDINARY&customerId=${customer.id}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-asphalt px-4 text-sm font-medium text-white hover:bg-graphite"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova vistoria
          </Link>
        }
      />

      <Card>
        <CardHeader title="Historico do cliente" description={`${inspections.length} registro(s).`} />
        <CardContent>
          {inspections.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Codigo</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Moto</th>
                    <th className="px-3 py-2">Contrato</th>
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
                      <td className="px-3 py-3">{inspection.motorcycle.plate}</td>
                      <td className="px-3 py-3">{inspection.contract?.code ?? "-"}</td>
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
            <EmptyState title="Sem vistorias" description="Este cliente ainda nao possui vistorias registradas." />
          )}
        </CardContent>
      </Card>
    </>
  );
}
