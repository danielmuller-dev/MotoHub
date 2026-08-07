import type { InspectionType } from "@prisma/client";
import { InspectionForm } from "@/components/forms/inspection-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { inspectionTypeLabels } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const inspectionTypes = Object.keys(inspectionTypeLabels) as InspectionType[];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewInspectionPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireCompanyRole();
  const requestedType = firstParam(params.type) as InspectionType | undefined;
  const defaultType = requestedType && inspectionTypes.includes(requestedType)
    ? requestedType
    : "DELIVERY";
  const defaultContractId = firstParam(params.contractId) ?? "";
  const defaultMotorcycleId = firstParam(params.motorcycleId) ?? "";
  const defaultCustomerId = firstParam(params.customerId) ?? "";

  const [contracts, motorcycles, customers] = await Promise.all([
    prisma.contract.findMany({
      where: {
        companyId: user.companyId!,
        deletedAt: null,
        status: { in: ["DRAFT", "ACTIVE", "OVERDUE", "SUSPENDED", "TERMINATED"] }
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { fullName: true, cpf: true } },
        motorcycle: { select: { brand: true, model: true, plate: true, currentMileage: true } }
      }
    }),
    prisma.motorcycle.findMany({
      where: {
        companyId: user.companyId!,
        deletedAt: null,
        status: { notIn: ["SOLD", "INACTIVE"] }
      },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
      select: {
        id: true,
        brand: true,
        model: true,
        plate: true,
        currentMileage: true,
        status: true
      }
    }),
    prisma.customer.findMany({
      where: { companyId: user.companyId!, deletedAt: null },
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        cpf: true
      }
    })
  ]);

  return (
    <>
      <PageHeader
        title="Nova vistoria"
        description="Registre entrega, devolucao, acompanhamento periodico ou ocorrencia extraordinaria."
        breadcrumbs={[{ label: "Vistorias", href: "/inspections" }, { label: "Nova vistoria" }]}
      />

      {!motorcycles.length ? (
        <Card>
          <CardHeader title="Nenhuma moto disponivel" />
          <CardContent className="text-sm text-slate-500">
            Cadastre uma moto ativa antes de iniciar uma vistoria.
          </CardContent>
        </Card>
      ) : (
        <InspectionForm
          contracts={contracts}
          motorcycles={motorcycles}
          customers={customers}
          defaultContractId={defaultContractId}
          defaultMotorcycleId={defaultMotorcycleId}
          defaultCustomerId={defaultCustomerId}
          defaultType={defaultType}
          returnTo={`/inspections/new?type=${defaultType}${defaultContractId ? `&contractId=${defaultContractId}` : ""}${defaultMotorcycleId ? `&motorcycleId=${defaultMotorcycleId}` : ""}${defaultCustomerId ? `&customerId=${defaultCustomerId}` : ""}`}
          currentUserName={user.name}
        />
      )}
    </>
  );
}
