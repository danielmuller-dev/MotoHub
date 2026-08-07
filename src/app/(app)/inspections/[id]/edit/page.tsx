import { notFound, redirect } from "next/navigation";
import { InspectionForm } from "@/components/forms/inspection-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { canEditInspection } from "@/lib/inspection-rules";
import { prisma } from "@/lib/prisma";

export default async function EditInspectionPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCompanyRole();
  const inspection = await prisma.inspection.findFirst({
    where: { id, companyId: user.companyId! },
    include: {
      items: true,
      accessories: true,
      photos: true,
      signatures: true
    }
  });

  if (!inspection) {
    notFound();
  }

  if (!canEditInspection(inspection.status, user.role)) {
    redirect(`/inspections/${inspection.id}?error=${encodeURIComponent("Esta vistoria nao pode ser editada por este usuario.")}`);
  }

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
        title={`Editar ${inspection.code}`}
        description="Atualize dados, checklist, fotos e assinaturas antes de concluir."
        breadcrumbs={[
          { label: "Vistorias", href: "/inspections" },
          { label: inspection.code, href: `/inspections/${inspection.id}` },
          { label: "Editar" }
        ]}
      />

      <InspectionForm
        contracts={contracts}
        motorcycles={motorcycles}
        customers={customers}
        inspection={inspection}
        returnTo={`/inspections/${inspection.id}/edit`}
        currentUserName={user.name}
      />
    </>
  );
}
