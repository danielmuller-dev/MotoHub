import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/ui/print-button";
import { requireCompanyRole } from "@/lib/auth";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  fuelLevelLabels,
  inspectionConditionLabels,
  inspectionPhotoTypeLabels,
  inspectionSignatureTypeLabels,
  inspectionStatusLabels,
  inspectionTypeLabels
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function InspectionPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCompanyRole();
  const inspection = await prisma.inspection.findFirst({
    where: { id, companyId: user.companyId! },
    include: {
      company: true,
      contract: true,
      customer: true,
      motorcycle: true,
      items: { orderBy: [{ category: "asc" }, { itemLabel: "asc" }] },
      photos: { where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      damages: { orderBy: { createdAt: "asc" } },
      accessories: { orderBy: { name: "asc" } },
      signatures: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!inspection) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl bg-white px-6 py-8 text-asphalt print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/inspections/${inspection.id}`} className="text-sm font-medium text-petrol hover:underline">
          Voltar para vistoria
        </Link>
        <PrintButton />
      </div>

      <section className="rounded-lg border border-slate-200 p-8 print:border-0 print:p-0">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{inspection.company.tradeName || inspection.company.legalName}</p>
            <h1 className="mt-1 text-2xl font-semibold">Vistoria {inspection.code}</h1>
            <p className="mt-2 text-sm text-slate-500">
              Emitida em {formatDateTime(new Date())}
            </p>
          </div>
          {inspection.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inspection.company.logoUrl} alt={inspection.company.legalName} className="h-16 max-w-40 object-contain" />
          ) : (
            <div className="flex h-16 w-40 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold">
              MotoGestor
            </div>
          )}
        </header>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <PrintGroup title="Identificacao">
            <Info label="Tipo" value={inspectionTypeLabels[inspection.type]} />
            <Info label="Status" value={inspectionStatusLabels[inspection.status]} />
            <Info label="Data" value={formatDate(inspection.inspectionDate)} />
            <Info label="Contrato" value={inspection.contract?.code} />
            <Info label="Cliente" value={inspection.customer?.fullName} />
            <Info label="CPF" value={inspection.customer?.cpf} />
          </PrintGroup>

          <PrintGroup title="Moto">
            <Info label="Marca/modelo" value={`${inspection.motorcycle.brand} ${inspection.motorcycle.model}`} />
            <Info label="Placa" value={inspection.motorcycle.plate} />
            <Info label="Renavam" value={inspection.motorcycle.renavam} />
            <Info label="Chassi" value={inspection.motorcycle.chassis} />
            <Info label="Quilometragem" value={`${inspection.mileage.toLocaleString("pt-BR")} km`} />
            <Info label="Combustivel" value={fuelLevelLabels[inspection.fuelLevel]} />
          </PrintGroup>
        </div>

        <PrintGroup title="Resumo operacional" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Info label="Km rodado" value={inspection.mileageDriven !== null ? `${inspection.mileageDriven} km` : null} />
            <Info label="Km excedente" value={inspection.mileageExcess !== null ? `${inspection.mileageExcess} km` : null} />
            <Info label="Valor excedente" value={formatCurrency(inspection.mileageExcessCharge)} />
            <Info label="Local" value={inspection.location} />
            <Info label="Cliente presente" value={inspection.customerPresent ? "Sim" : "Nao"} />
            <Info label="Recusa assinatura" value={inspection.customerRefusedSignature ? inspection.refusalReason || "Sim" : "Nao"} />
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
            {inspection.generalCondition || inspection.notes || "Sem observacoes gerais."}
          </p>
        </PrintGroup>

        <PrintGroup title="Checklist" className="mt-6">
          <table className="w-full text-left text-xs">
            <thead className="uppercase text-slate-500">
              <tr>
                <th className="border-b border-slate-100 px-2 py-2">Categoria</th>
                <th className="border-b border-slate-100 px-2 py-2">Item</th>
                <th className="border-b border-slate-100 px-2 py-2">Condicao</th>
                <th className="border-b border-slate-100 px-2 py-2">Custo</th>
                <th className="border-b border-slate-100 px-2 py-2">Observacao</th>
              </tr>
            </thead>
            <tbody>
              {inspection.items.map((item) => (
                <tr key={item.id}>
                  <td className="border-b border-slate-100 px-2 py-2">{item.category}</td>
                  <td className="border-b border-slate-100 px-2 py-2">{item.itemLabel}</td>
                  <td className="border-b border-slate-100 px-2 py-2">{inspectionConditionLabels[item.condition]}</td>
                  <td className="border-b border-slate-100 px-2 py-2">{formatCurrency(item.estimatedCost)}</td>
                  <td className="border-b border-slate-100 px-2 py-2">{item.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintGroup>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <PrintGroup title="Acessorios">
            {inspection.accessories.map((accessory) => (
              <Info
                key={accessory.id}
                label={accessory.name}
                value={`${accessory.delivered ? "Entregue" : "Nao entregue"} / ${accessory.returned ? "Devolvido" : "Nao devolvido"} / ${inspectionConditionLabels[accessory.condition]}`}
              />
            ))}
          </PrintGroup>

          <PrintGroup title="Avarias">
            {inspection.damages.length ? inspection.damages.map((damage) => (
              <Info key={damage.id} label={damage.title} value={`${damage.description ?? "-"} | ${formatCurrency(damage.approvedChargeAmount)}`} />
            )) : <Info label="Avarias" value="Nenhuma avaria registrada." />}
          </PrintGroup>
        </div>

        {inspection.photos.length ? (
          <PrintGroup title="Fotos" className="mt-6 print:hidden">
            <div className="grid gap-4 sm:grid-cols-3">
              {inspection.photos.slice(0, 9).map((photo) => (
                <figure key={photo.id} className="overflow-hidden rounded-md border border-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption ?? inspectionPhotoTypeLabels[photo.type]} className="h-32 w-full object-cover" />
                  <figcaption className="p-2 text-xs text-slate-500">
                    {inspectionPhotoTypeLabels[photo.type]}
                  </figcaption>
                </figure>
              ))}
            </div>
          </PrintGroup>
        ) : null}

        <div className="mt-14 grid gap-12 text-center text-sm text-slate-600 sm:grid-cols-2">
          {inspection.signatures.length ? inspection.signatures.slice(0, 2).map((signature) => (
            <div key={signature.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={signature.imageUrl} alt={signature.signedByName} className="mx-auto mb-2 h-20 max-w-64 object-contain" />
              <div className="border-t border-slate-400 pt-3">
                {inspectionSignatureTypeLabels[signature.type]} - {signature.signedByName}
              </div>
            </div>
          )) : (
            <>
              <div className="border-t border-slate-400 pt-3">Assinatura da empresa</div>
              <div className="border-t border-slate-400 pt-3">Assinatura do cliente</div>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Documento emitido pelo MotoGestor em {formatDate(new Date())}.
        </p>
      </section>
    </main>
  );
}

function PrintGroup({
  title,
  children,
  className
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="mb-3 border-b border-slate-100 pb-2 text-sm font-semibold uppercase text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="mb-2">
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-asphalt">{value || "-"}</p>
    </div>
  );
}
