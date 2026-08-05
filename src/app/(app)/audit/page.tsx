import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AuditPage() {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const logs = await prisma.auditLog.findMany({
    where: { companyId: user.companyId! },
    orderBy: { createdAt: "desc" },
    include: { user: true },
    take: 120
  });

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Historico de atividades sensiveis da empresa."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Auditoria" }]}
      />
      <Card>
        <CardHeader title="Eventos recentes" />
        <CardContent className="grid gap-3">
          {logs.map((log) => (
            <article key={log.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-asphalt">{log.description}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {log.action} | {log.entity} | {log.user?.name || "Sistema"}
                  </p>
                </div>
                <p className="text-sm text-slate-500">{formatDate(log.createdAt)}</p>
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
