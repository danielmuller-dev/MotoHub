import Link from "next/link";
import { InspectionStatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { formatDate, inspectionTypeLabels } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function CustomerPortalInspectionsPage() {
  const user = await requireRole(["CUSTOMER"]);
  const inspections = await prisma.inspection.findMany({
    where: {
      companyId: user.companyId!,
      customerId: user.customerId!,
      status: { in: ["COMPLETED", "CANCELLED"] }
    },
    orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
    include: {
      contract: true,
      motorcycle: true,
      _count: { select: { damages: true, photos: true } }
    }
  });

  return (
    <>
      <PageHeader
        title="Minhas vistorias"
        description="Consulte entregas, devolucoes e registros vinculados ao seu contrato."
        breadcrumbs={[{ label: "Area do cliente", href: "/customer" }, { label: "Vistorias" }]}
      />

      <Card>
        <CardHeader title="Historico" description={`${inspections.length} registro(s).`} />
        <CardContent>
          {inspections.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
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
                        <Link href={`/customer/inspections/${inspection.id}`} className="font-medium text-petrol hover:underline">
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
            <EmptyState title="Sem vistorias" description="Nenhuma vistoria foi liberada para o seu perfil." />
          )}
        </CardContent>
      </Card>
    </>
  );
}
