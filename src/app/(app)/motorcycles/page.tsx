import Link from "next/link";
import { Bike, Plus, Search } from "lucide-react";
import { createMotorcycleAction, updateMotorcycleStatusAction } from "@/app/actions";
import { MotorcycleStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SelectField, TextArea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const pageSize = 10;

export default async function MotorcyclesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireCompanyRole();
  const page = Math.max(Number(params.page ?? "1"), 1);
  const q = params.q?.trim();
  const status = params.status;
  const view = params.view === "cards" ? "cards" : "table";

  const where = {
    companyId: user.companyId!,
    deletedAt: null,
    ...(status ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { brand: { contains: q, mode: "insensitive" as const } },
            { model: { contains: q, mode: "insensitive" as const } },
            { plate: { contains: q.toUpperCase() } },
            { renavam: { contains: q } },
            { chassis: { contains: q } }
          ]
        }
      : {})
  };

  const [motorcycles, total] = await Promise.all([
    prisma.motorcycle.findMany({
      where,
      orderBy: [{ status: "asc" }, { brand: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        currentCustomer: true,
        contracts: {
          where: { status: { in: ["ACTIVE", "OVERDUE", "SUSPENDED"] } },
          take: 1
        }
      }
    }),
    prisma.motorcycle.count({ where })
  ]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <>
      <PageHeader
        title="Motos"
        description="Controle frota, disponibilidade, documentos e manutencoes."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Motos" }]}
      />

      <div className="grid gap-6 2xl:grid-cols-[0.78fr_1.22fr]">
        <Card>
          <CardHeader title="Cadastrar moto" description="Placa, Renavam e chassi nao podem repetir na empresa." />
          <CardContent>
            <form action={createMotorcycleAction} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Marca" name="brand" required />
                <Field label="Modelo" name="model" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Ano fabricacao" name="manufactureYear" type="number" />
                <Field label="Ano modelo" name="modelYear" type="number" />
                <Field label="Cor" name="color" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Placa" name="plate" placeholder="ABC1D23" required />
                <Field label="Renavam" name="renavam" />
                <Field label="Chassi" name="chassis" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Cilindrada" name="engineCapacity" type="number" />
                <Field label="Quilometragem atual" name="currentMileage" type="number" defaultValue={0} />
                <Field label="Valor de aquisicao" name="acquisitionValue" type="number" step="0.01" />
              </div>
              <Field label="Data de aquisicao" name="acquisitionDate" type="date" />
              <Field label="Foto principal por URL" name="photoUrl" type="url" />
              <SelectField label="Status" name="status" defaultValue="AVAILABLE">
                <option value="AVAILABLE">Disponivel</option>
                <option value="MAINTENANCE">Manutencao</option>
                <option value="BLOCKED">Bloqueada</option>
                <option value="INACTIVE">Inativa</option>
              </SelectField>
              <TextArea label="Observacoes" name="notes" />
              <Button type="submit">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Cadastrar moto
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Frota" description={`${total} moto(s) encontrada(s).`} />
          <CardContent>
            <form className="mb-4 grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 md:grid-cols-[1fr_180px_140px_auto]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input
                  name="q"
                  defaultValue={params.q ?? ""}
                  placeholder="Buscar por marca, modelo, placa, Renavam ou chassi"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-petrol"
                />
              </label>
              <select name="status" defaultValue={status ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">Todos</option>
                <option value="AVAILABLE">Disponiveis</option>
                <option value="RENTED">Alugadas</option>
                <option value="MAINTENANCE">Manutencao</option>
                <option value="BLOCKED">Bloqueadas</option>
                <option value="SOLD">Vendidas</option>
                <option value="INACTIVE">Inativas</option>
              </select>
              <select name="view" defaultValue={view} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="table">Tabela</option>
                <option value="cards">Cards</option>
              </select>
              <Button type="submit" variant="secondary">Filtrar</Button>
            </form>

            {!motorcycles.length ? (
              <EmptyState title="Nenhuma moto encontrada" description="Cadastre a frota ou ajuste os filtros." />
            ) : view === "cards" ? (
              <div className="grid gap-4 md:grid-cols-2">
                {motorcycles.map((motorcycle) => (
                  <article key={motorcycle.id} className="rounded-lg border border-slate-200 p-4">
                    {motorcycle.photoUrl ? (
                      <div
                        role="img"
                        aria-label={`${motorcycle.brand} ${motorcycle.model}`}
                        className="mb-4 aspect-video w-full rounded-md bg-cover bg-center"
                        style={{ backgroundImage: `url(${motorcycle.photoUrl})` }}
                      />
                    ) : (
                      <div className="mb-4 flex aspect-video items-center justify-center rounded-md bg-slate-100">
                        <Bike className="h-10 w-10 text-slate-400" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link href={`/motorcycles/${motorcycle.id}`} className="font-semibold text-asphalt hover:text-petrol">
                          {motorcycle.brand} {motorcycle.model}
                        </Link>
                        <p className="text-sm text-slate-500">{motorcycle.plate}</p>
                      </div>
                      <MotorcycleStatusBadge status={motorcycle.status} />
                    </div>
                    <p className="mt-3 text-sm text-slate-500">
                      {motorcycle.currentMileage.toLocaleString("pt-BR")} km | {motorcycle.color || "sem cor"}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Moto</th>
                      <th className="px-3 py-2">Placa</th>
                      <th className="px-3 py-2">Km</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2">Cliente atual</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {motorcycles.map((motorcycle) => (
                      <tr key={motorcycle.id}>
                        <td className="px-3 py-3">
                          <Link href={`/motorcycles/${motorcycle.id}`} className="font-medium text-asphalt hover:text-petrol">
                            {motorcycle.brand} {motorcycle.model}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {motorcycle.manufactureYear || "-"} / {motorcycle.modelYear || "-"} | {motorcycle.color || "-"}
                          </p>
                        </td>
                        <td className="px-3 py-3">{motorcycle.plate}</td>
                        <td className="px-3 py-3">{motorcycle.currentMileage.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-3">{formatCurrency(motorcycle.acquisitionValue)}</td>
                        <td className="px-3 py-3">{motorcycle.currentCustomer?.fullName || "-"}</td>
                        <td className="px-3 py-3"><MotorcycleStatusBadge status={motorcycle.status} /></td>
                        <td className="px-3 py-3">
                          {user.role === "COMPANY_ADMIN" ? (
                            <form action={updateMotorcycleStatusAction} className="flex gap-2">
                              <input type="hidden" name="motorcycleId" value={motorcycle.id} />
                              <select name="status" defaultValue={motorcycle.status} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs">
                                <option value="AVAILABLE">Disponivel</option>
                                <option value="MAINTENANCE">Manutencao</option>
                                <option value="BLOCKED">Bloqueada</option>
                                <option value="INACTIVE">Inativa</option>
                              </select>
                              <ConfirmSubmitButton label="Salvar" message="Confirmar alteracao da moto?" variant="secondary" />
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span>
                    Pagina {page} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Link href={`/motorcycles?page=${Math.max(page - 1, 1)}`} className="rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50">
                      Anterior
                    </Link>
                    <Link href={`/motorcycles?page=${Math.min(page + 1, totalPages)}`} className="rounded-md border border-slate-200 px-3 py-2 hover:bg-slate-50">
                      Proxima
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
