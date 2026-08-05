import { Plus, UserPlus } from "lucide-react";
import {
  createCompanyAction,
  createCompanyAdminAction,
  toggleCompanyStatusAction
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SelectField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { companyStatusLabels, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function CompaniesPage() {
  await requireRole(["SUPER_ADMIN"]);

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          users: true,
          customers: true,
          motorcycles: true
        }
      }
    }
  });

  return (
    <>
      <PageHeader
        title="Empresas"
        description="Cadastre locadoras e controle o status de cada ambiente."
        breadcrumbs={[{ label: "Superadmin", href: "/superadmin" }, { label: "Empresas" }]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Cadastrar empresa" description="Crie o ambiente da locadora." />
          <CardContent>
            <form action={createCompanyAction} className="grid gap-4">
              <Field label="Razao social" name="legalName" required />
              <Field label="Nome fantasia" name="tradeName" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="CPF/CNPJ" name="document" placeholder="00.000.000/0000-00" />
                <Field label="Slug" name="slug" placeholder="locadora-piloto" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="E-mail" name="email" type="email" />
                <Field label="Telefone" name="phone" placeholder="(71) 99999-9999" />
              </div>
              <Field label="WhatsApp" name="whatsapp" placeholder="(71) 99999-9999" />
              <Field label="Endereco" name="address" />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Cidade" name="city" />
                <Field label="Estado" name="state" placeholder="BA" />
                <Field label="CEP" name="zipCode" />
              </div>
              <Field label="Logo por URL" name="logoUrl" type="url" />
              <SelectField label="Status" name="status" defaultValue="ACTIVE">
                <option value="ACTIVE">Ativa</option>
                <option value="TRIAL">Teste</option>
                <option value="INACTIVE">Inativa</option>
              </SelectField>
              <Button type="submit">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Cadastrar empresa
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Empresas cadastradas" description="Resumo operacional por locadora." />
          <CardContent>
            {companies.length ? (
              <div className="grid gap-4">
                {companies.map((company) => (
                  <article key={company.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="font-semibold text-asphalt">{company.tradeName || company.legalName}</h2>
                        <p className="text-sm text-slate-500">{company.legalName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {company.city || "Cidade nao informada"} - {company.state || "UF"} | {company.slug}
                        </p>
                      </div>
                      <Badge tone={company.status === "ACTIVE" ? "green" : "red"}>
                        {companyStatusLabels[company.status]}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                      <span>{company._count.users} usuarios</span>
                      <span>{company._count.customers} clientes</span>
                      <span>{company._count.motorcycles} motos</span>
                      <span>{formatDate(company.createdAt)}</span>
                    </div>
                    <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-[1fr_auto]">
                      <form action={createCompanyAdminAction} className="grid gap-3 sm:grid-cols-4">
                        <input type="hidden" name="companyId" value={company.id} />
                        <Field label="Nome do admin" name="name" required />
                        <Field label="E-mail" name="email" type="email" required />
                        <Field label="Senha temporaria" name="password" type="password" required />
                        <Field label="Telefone" name="phone" />
                        <Button type="submit" variant="secondary" className="sm:col-span-4">
                          <UserPlus className="h-4 w-4" aria-hidden="true" />
                          Criar administrador
                        </Button>
                      </form>
                      <form action={toggleCompanyStatusAction} className="flex items-end gap-2">
                        <input type="hidden" name="companyId" value={company.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={company.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"}
                        />
                        <Button type="submit" variant="secondary">
                          {company.status === "ACTIVE" ? "Inativar" : "Ativar"}
                        </Button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhuma empresa cadastrada"
                description="Cadastre a primeira locadora para iniciar a operacao piloto."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
