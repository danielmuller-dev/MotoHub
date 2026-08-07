import Link from "next/link";
import type { InspectionStatus, InspectionType, Prisma } from "@prisma/client";
import { Search, Plus } from "lucide-react";
import { InspectionStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import {
  formatCurrency,
  formatDate,
  inspectionStatusLabels,
  inspectionTypeLabels
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

const statuses = Object.keys(inspectionStatusLabels) as InspectionStatus[];
const types = Object.keys(inspectionTypeLabels) as InspectionType[];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined) {
  const parsed = Number.parseInt(firstParam(value) ?? "1", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function buildHref(input: {
  page: number;
  status?: InspectionStatus;
  type?: InspectionType;
  search?: string;
}) {
  const params = new URLSearchParams();
  params.set("page", String(input.page));
  if (input.status) {
    params.set("status", input.status);
  }
  if (input.type) {
    params.set("type", input.type);
  }
  if (input.search) {
    params.set("search", input.search);
  }
  return `/inspections?${params.toString()}`;
}

export default async function InspectionsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireCompanyRole();
  const pageSize = 20;
  const requestedPage = parsePage(params.page);
  const statusParam = firstParam(params.status) as InspectionStatus | undefined;
  const typeParam = firstParam(params.type) as InspectionType | undefined;
  const status = statusParam && statuses.includes(statusParam) ? statusParam : undefined;
  const type = typeParam && types.includes(typeParam) ? typeParam : undefined;
  const search = (firstParam(params.search) ?? "").trim();

  const where: Prisma.InspectionWhereInput = {
    companyId: user.companyId!,
    ...(status ? { status } : {}),
    ...(type ? { type } : {})
  };

  if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { contract: { code: { contains: search, mode: "insensitive" } } },
      { customer: { fullName: { contains: search, mode: "insensitive" } } },
      { motorcycle: { plate: { contains: search, mode: "insensitive" } } }
    ];
  }

  const total = await prisma.inspection.count({ where });
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const page = Math.min(requestedPage, totalPages);
  const inspections = await prisma.inspection.findMany({
    where,
    orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      contract: true,
      customer: true,
      motorcycle: true,
      _count: {
        select: {
          damages: true,
          photos: true,
          charges: true
        }
      }
    }
  });

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <>
      <PageHeader
        title="Vistorias"
        description="Controle entregas, devolucoes, vistorias periodicas, fotos, avarias e cobrancas."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Vistorias" }]}
        action={
          <Link
            href="/inspections/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-asphalt px-4 text-sm font-medium text-white hover:bg-graphite"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova vistoria
          </Link>
        }
      />

      <Card>
        <CardHeader title="Vistorias da empresa" description={`${total} registro(s) encontrado(s).`} />
        <CardContent>
          <form className="mb-5 grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 lg:grid-cols-[180px_180px_minmax(220px,1fr)_auto_auto]">
            <input type="hidden" name="page" value="1" />
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Tipo
              <select
                name="type"
                defaultValue={type ?? ""}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Todos</option>
                {types.map((value) => (
                  <option key={value} value={value}>
                    {inspectionTypeLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Status
              <select
                name="status"
                defaultValue={status ?? ""}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Todos</option>
                {statuses.map((value) => (
                  <option key={value} value={value}>
                    {inspectionStatusLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-slate-700">
              Busca
              <input
                name="search"
                defaultValue={search}
                placeholder="Codigo, cliente, contrato ou placa"
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              />
            </label>
            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="w-full">
                <Search className="h-4 w-4" aria-hidden="true" />
                Filtrar
              </Button>
            </div>
            <div className="flex items-end">
              <Link
                href="/inspections"
                className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-asphalt hover:bg-slate-50"
              >
                Limpar
              </Link>
            </div>
          </form>

          {inspections.length ? (
            <>
              <div className="mb-4 flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <p>Exibindo {start}-{end} de {total} vistoria(s)</p>
                <p>Pagina {page} de {totalPages}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Codigo</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Moto</th>
                      <th className="px-3 py-2">Contrato</th>
                      <th className="px-3 py-2">Resumo</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {inspections.map((inspection) => (
                      <tr key={inspection.id} className="align-top">
                        <td className="px-3 py-3">
                          <Link href={`/inspections/${inspection.id}`} className="font-medium text-petrol hover:underline">
                            {inspection.code}
                          </Link>
                        </td>
                        <td className="px-3 py-3">{inspectionTypeLabels[inspection.type]}</td>
                        <td className="px-3 py-3">{formatDate(inspection.inspectionDate)}</td>
                        <td className="px-3 py-3">{inspection.customer?.fullName ?? "-"}</td>
                        <td className="px-3 py-3">{inspection.motorcycle.plate}</td>
                        <td className="px-3 py-3">
                          {inspection.contract ? (
                            <Link href={`/contracts/${inspection.contract.id}`} className="text-petrol hover:underline">
                              {inspection.contract.code}
                            </Link>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {inspection._count.damages} avaria(s), {inspection._count.photos} foto(s), {inspection._count.charges} cobranca(s)
                          {inspection.mileageExcessCharge.toNumber() > 0 ? (
                            <span className="block text-xs text-slate-500">
                              Excesso: {formatCurrency(inspection.mileageExcessCharge)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <InspectionStatusBadge status={inspection.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <Link
                  href={buildHref({ page: Math.max(page - 1, 1), status, type, search })}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-asphalt hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  aria-disabled={page <= 1}
                >
                  Anterior
                </Link>
                <div className="hidden gap-2 sm:flex">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 8).map((number) => (
                    <Link
                      key={number}
                      href={buildHref({ page: number, status, type, search })}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium ${
                        number === page
                          ? "border-asphalt bg-asphalt text-white"
                          : "border-slate-200 bg-white text-asphalt hover:bg-slate-50"
                      }`}
                    >
                      {number}
                    </Link>
                  ))}
                </div>
                <Link
                  href={buildHref({ page: Math.min(page + 1, totalPages), status, type, search })}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-asphalt hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  aria-disabled={page >= totalPages}
                >
                  Proxima
                </Link>
              </div>
            </>
          ) : (
            <EmptyState
              title="Nenhuma vistoria encontrada"
              description="Crie a primeira vistoria de entrega, devolucao ou acompanhamento da frota."
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
