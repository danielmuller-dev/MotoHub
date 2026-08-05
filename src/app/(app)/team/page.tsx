import { createTeamUserAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { roleLabels, userStatusLabels } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function TeamPage() {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const users = await prisma.user.findMany({
    where: {
      companyId: user.companyId!,
      role: { in: ["COMPANY_ADMIN", "EMPLOYEE"] },
      deletedAt: null
    },
    orderBy: { name: "asc" }
  });

  return (
    <>
      <PageHeader
        title="Equipe"
        description="Cadastre administradores da locadora e funcionarios."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Equipe" }]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card>
          <CardHeader title="Novo usuario" />
          <CardContent>
            <form action={createTeamUserAction} className="grid gap-4">
              <Field label="Nome" name="name" required />
              <Field label="E-mail" name="email" type="email" required />
              <Field label="Senha temporaria" name="password" type="password" required />
              <Field label="Telefone" name="phone" />
              <SelectField label="Perfil" name="role" defaultValue="EMPLOYEE">
                <option value="EMPLOYEE">Funcionario</option>
                <option value="COMPANY_ADMIN">Administrador</option>
              </SelectField>
              <SelectField label="Status" name="status" defaultValue="ACTIVE">
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </SelectField>
              <Button type="submit">Criar usuario</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Usuarios da locadora" />
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">E-mail</th>
                  <th className="px-3 py-2">Perfil</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((teamUser) => (
                  <tr key={teamUser.id}>
                    <td className="px-3 py-3 font-medium">{teamUser.name}</td>
                    <td className="px-3 py-3">{teamUser.email}</td>
                    <td className="px-3 py-3">{roleLabels[teamUser.role]}</td>
                    <td className="px-3 py-3">
                      <Badge tone={teamUser.status === "ACTIVE" ? "green" : "red"}>
                        {userStatusLabels[teamUser.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
