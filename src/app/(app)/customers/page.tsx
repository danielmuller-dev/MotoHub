import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { CustomerStatus, Prisma } from "@prisma/client";
import { createCustomerAction, toggleCustomerStatusAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SelectField, TextArea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { customerStatusLabels, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const pageSize = 10;

export default async function CustomersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireCompanyRole();
  const page = Math.max(Number(params.page ?? "1"), 1);
  const q = params.q?.trim();
  const status = params.status;
  const orderBy = params.sort === "oldest" ? { createdAt: "asc" as const } : { fullName: "asc" as const };

  const where: Prisma.CustomerWhereInput = {
    companyId: user.companyId!,
    deletedAt: null,
    ...(status === "ACTIVE" || status === "INACTIVE" ? { status: status as CustomerStatus } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" as const } },
            { cpf: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" as const } },
            { driverLicenseNumber: { contains: q } }
          ]
        }
      : {})
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        contracts: {
          where: { status: { in: ["ACTIVE", "OVERDUE", "SUSPENDED"] } },
          take: 1,
          include: { motorcycle: true }
        }
      }
    }),
    prisma.customer.count({ where })
  ]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastre clientes, filtre a carteira e acompanhe contratos ativos."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Clientes" }]}
      />

      <div className="grid gap-6 2xl:grid-cols-[0.82fr_1.18fr]">
        <Card>
          <CardHeader title="Cadastrar cliente" description="CPF e e-mail sao unicos dentro da empresa." />
          <CardContent>
            <form action={createCustomerAction} className="grid gap-4">
              <Field label="Nome completo" name="fullName" required />
              <div className="form-grid-2">
                <Field label="CPF" name="cpf" placeholder="000.000.000-00" required />
                <Field label="Nascimento" name="birthDate" type="date" />
              </div>
              <div className="form-grid-2">
                <Field label="E-mail" name="email" type="email" />
                <Field label="Senha para area do cliente" name="accessPassword" type="password" />
              </div>
              <div className="form-grid-2">
                <Field label="Telefone" name="phone" placeholder="(71) 99999-9999" />
                <Field label="WhatsApp" name="whatsapp" placeholder="(71) 99999-9999" />
              </div>
              <Field label="Endereco" name="address" />
              <div className="form-grid-3">
                <Field label="Numero" name="number" />
                <Field label="Bairro" name="district" />
                <Field label="CEP" name="zipCode" />
              </div>
              <div className="form-grid-3">
                <Field label="Cidade" name="city" />
                <Field label="Estado" name="state" placeholder="BA" />
                <Field label="Complemento" name="complement" />
              </div>
              <div className="form-grid-3">
                <Field label="CNH" name="driverLicenseNumber" />
                <Field label="Categoria" name="driverLicenseCategory" />
                <Field label="Validade CNH" name="driverLicenseExpiration" type="date" />
              </div>
              <Field label="Identidade" name="identityNumber" />
              <div className="form-grid-2">
                <Field label="Contato de emergencia" name="emergencyContactName" />
                <Field label="Telefone emergencia" name="emergencyContactPhone" />
              </div>
              <SelectField label="Status" name="status" defaultValue="ACTIVE">
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </SelectField>
              <TextArea label="Observacoes" name="notes" />
              <Button type="submit">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Cadastrar cliente
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Lista de clientes" description={`${total} cliente(s) encontrado(s).`} />
          <CardContent>
            <form className="mb-4 grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 md:grid-cols-[1fr_180px_160px_auto]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder="Buscar por nome, CPF, telefone, e-mail ou CNH"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-petrol"
                />
              </label>
              <select name="status" defaultValue={status ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Todos os status</option>
                <option value="ACTIVE">Ativos</option>
                <option value="INACTIVE">Inativos</option>
              </select>
              <select name="sort" defaultValue={params.sort ?? "name"} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="name">Nome</option>
                <option value="oldest">Mais antigos</option>
              </select>
              <Button type="submit" variant="secondary">Filtrar</Button>
            </form>

            {customers.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Contato</th>
                      <th className="px-3 py-2">CNH</th>
                      <th className="px-3 py-2">Contrato atual</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Cadastro</th>
                      <th className="px-3 py-2">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customers.map((customer) => {
                      const activeContract = customer.contracts[0];
                      return (
                        <tr key={customer.id}>
                          <td className="px-3 py-3">
                            <Link href={`/customers/${customer.id}`} className="font-medium text-asphalt hover:text-petrol">
                              {customer.fullName}
                            </Link>
                            <p className="text-xs text-slate-500">{customer.cpf}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p>{customer.phone || customer.whatsapp || "-"}</p>
                            <p className="text-xs text-slate-500">{customer.email || "-"}</p>
                          </td>
                          <td className="px-3 py-3">{customer.driverLicenseNumber || "-"}</td>
                          <td className="px-3 py-3">
                            {activeContract ? (
                              <Link href={`/contracts/${activeContract.id}`} className="text-petrol hover:underline">
                                {activeContract.code} | {activeContract.motorcycle.plate}
                              </Link>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone={customer.status === "ACTIVE" ? "green" : "red"}>
                              {customerStatusLabels[customer.status]}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">{formatDate(customer.createdAt)}</td>
                          <td className="px-3 py-3">
                            {user.role === "COMPANY_ADMIN" ? (
                              <form action={toggleCustomerStatusAction}>
                                <input type="hidden" name="customerId" value={customer.id} />
                                <input
                                  type="hidden"
                                  name="status"
                                  value={customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"}
                                />
                                <ConfirmSubmitButton
                                  label={customer.status === "ACTIVE" ? "Inativar" : "Ativar"}
                                  message="Confirmar alteracao de status do cliente?"
                                  variant="secondary"
                                />
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span>
                    Pagina {page} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Link
                      href={`/customers?page=${Math.max(page - 1, 1)}`}
                      className="rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50"
                    >
                      Anterior
                    </Link>
                    <Link
                      href={`/customers?page=${Math.min(page + 1, totalPages)}`}
                      className="rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50"
                    >
                      Proxima
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Nenhum cliente encontrado"
                description="Ajuste os filtros ou cadastre o primeiro cliente da locadora."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
