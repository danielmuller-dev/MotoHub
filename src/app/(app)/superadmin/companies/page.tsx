import type { CompanyLicensePlan, CompanyStatus } from "@prisma/client";
import { Plus, UserPlus } from "lucide-react";
import {
  createCompanyAction,
  createCompanyAdminAction,
  toggleCompanyStatusAction,
  updateCompanyLicenseAction
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SelectField } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { daysUntilLicenseExpiration, getCompanyLicenseState } from "@/lib/company-license";
import {
  companyLicensePlanLabels,
  companyLicenseStateLabels,
  companyStatusLabels,
  formatDate,
  formatDateInput
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

const licensePlans = Object.keys(companyLicensePlanLabels) as CompanyLicensePlan[];
const companyStatuses = Object.keys(companyStatusLabels) as CompanyStatus[];

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
              <SelectField label="Licenca" name="licensePlan" defaultValue="FREE_30">
                {licensePlans.map((plan) => (
                  <option key={plan} value={plan}>
                    {companyLicensePlanLabels[plan]}
                  </option>
                ))}
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
                      <Badge tone={company.status === "ACTIVE" ? "green" : company.status === "TRIAL" ? "blue" : "red"}>
                        {companyStatusLabels[company.status]}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-5">
                      <span>{company._count.users} usuarios</span>
                      <span>{company._count.customers} clientes</span>
                      <span>{company._count.motorcycles} motos</span>
                      <LicenseSummary company={company} />
                      <span>{formatDate(company.createdAt)}</span>
                    </div>
                    <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4">
                      <LicenseEditForm company={company} />
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

function licenseTone(state: ReturnType<typeof getCompanyLicenseState>) {
  if (state === "ACTIVE" || state === "LIFETIME") {
    return "green";
  }
  if (state === "TRIAL") {
    return "blue";
  }
  if (state === "EXPIRED" || state === "BLOCKED") {
    return "red";
  }
  return "neutral";
}

function LicenseSummary({
  company
}: {
  company: {
    status: CompanyStatus;
    licensePlan: CompanyLicensePlan;
    licenseExpiresAt: Date | null;
  };
}) {
  const state = getCompanyLicenseState(company);
  const days = daysUntilLicenseExpiration(company);

  return (
    <span className="grid gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <Badge tone={licenseTone(state)}>{companyLicenseStateLabels[state]}</Badge>
        <span>{companyLicensePlanLabels[company.licensePlan]}</span>
      </span>
      <span className="text-xs text-slate-500">
        {company.licensePlan === "LIFETIME"
          ? "Sem vencimento"
          : `${formatDate(company.licenseExpiresAt)}${days !== null ? ` | ${Math.max(days, 0)} dia(s)` : ""}`}
      </span>
    </span>
  );
}

function LicenseEditForm({
  company
}: {
  company: {
    id: string;
    status: CompanyStatus;
    licensePlan: CompanyLicensePlan;
    licenseExpiresAt: Date | null;
  };
}) {
  return (
    <form action={updateCompanyLicenseAction} className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 lg:grid-cols-[180px_180px_180px_auto]">
      <input type="hidden" name="companyId" value={company.id} />
      <SelectField label="Status" name="status" defaultValue={company.status}>
        {companyStatuses.map((status) => (
          <option key={status} value={status}>
            {companyStatusLabels[status]}
          </option>
        ))}
      </SelectField>
      <SelectField label="Licenca" name="licensePlan" defaultValue={company.licensePlan}>
        {licensePlans.map((plan) => (
          <option key={plan} value={plan}>
            {companyLicensePlanLabels[plan]}
          </option>
        ))}
      </SelectField>
      <Field label="Valida ate" name="licenseExpiresAt" type="date" defaultValue={formatDateInput(company.licenseExpiresAt)} />
      <div className="flex items-end">
        <Button type="submit" variant="secondary" className="w-full">
          Atualizar licenca
        </Button>
      </div>
    </form>
  );
}
