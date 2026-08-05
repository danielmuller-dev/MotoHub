import { Building2, ClipboardList, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { companyStatusLabels, formatDate } from "@/lib/format";

export default async function SuperAdminDashboardPage() {
  await requireRole(["SUPER_ADMIN"]);

  const [
    totalCompanies,
    activeCompanies,
    inactiveCompanies,
    totalUsers,
    totalMotorcycles,
    activeContracts,
    recentCompanies
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { status: "ACTIVE" } }),
    prisma.company.count({ where: { status: { in: ["INACTIVE", "BLOCKED"] } } }),
    prisma.user.count(),
    prisma.motorcycle.count(),
    prisma.contract.count({ where: { status: { in: ["ACTIVE", "OVERDUE", "SUSPENDED"] } } }),
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        _count: {
          select: {
            users: true,
            customers: true,
            motorcycles: true
          }
        }
      }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Painel do superadmin"
        description="Visao geral da plataforma SaaS e empresas cadastradas."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Empresas" value={totalCompanies} icon={Building2} />
        <StatCard label="Ativas" value={activeCompanies} icon={Building2} helper={`${inactiveCompanies} inativas ou bloqueadas`} />
        <StatCard label="Usuarios" value={totalUsers} icon={Users} />
        <StatCard label="Contratos ativos" value={activeContracts} icon={ClipboardList} helper={`${totalMotorcycles} motos cadastradas`} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Empresas recentes" description="Ultimas locadoras cadastradas na plataforma." />
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Usuarios</th>
                <th className="px-3 py-2">Clientes</th>
                <th className="px-3 py-2">Motos</th>
                <th className="px-3 py-2">Criada em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentCompanies.map((company) => (
                <tr key={company.id}>
                  <td className="px-3 py-3">
                    <p className="font-medium text-asphalt">{company.tradeName || company.legalName}</p>
                    <p className="text-xs text-slate-500">{company.slug}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={company.status === "ACTIVE" ? "green" : "red"}>
                      {companyStatusLabels[company.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">{company._count.users}</td>
                  <td className="px-3 py-3">{company._count.customers}</td>
                  <td className="px-3 py-3">{company._count.motorcycles}</td>
                  <td className="px-3 py-3">{formatDate(company.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
