import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/ui/print-button";
import { requireCompanyRole } from "@/lib/auth";
import {
  billingFrequencyLabels,
  contractStatusLabels,
  contractTypeLabels,
  formatCurrency,
  formatDate,
  formatDateTime,
  weekDayLabels
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function ContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCompanyRole();
  const contract = await prisma.contract.findFirst({
    where: { id, companyId: user.companyId!, deletedAt: null },
    include: {
      company: true,
      customer: true,
      motorcycle: true
    }
  });

  if (!contract) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl bg-white px-6 py-8 text-asphalt print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/contracts/${contract.id}`} className="text-sm font-medium text-petrol hover:underline">
          Voltar ao contrato
        </Link>
        <PrintButton />
      </div>

      <section className="rounded-lg border border-slate-200 p-8 print:border-0 print:p-0">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{contract.company.tradeName || contract.company.legalName}</p>
            <h1 className="mt-1 text-2xl font-semibold">Contrato {contract.code}</h1>
            <p className="mt-2 text-sm text-slate-500">
              Emitido em {formatDateTime(new Date())}
            </p>
          </div>
          {contract.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={contract.company.logoUrl} alt={contract.company.legalName} className="h-16 max-w-40 object-contain" />
          ) : (
            <div className="flex h-16 w-40 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold">
              MotoGestor
            </div>
          )}
        </header>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <PrintGroup title="Empresa">
            <Info label="Razao social" value={contract.company.legalName} />
            <Info label="Nome fantasia" value={contract.company.tradeName} />
            <Info label="Documento" value={contract.company.document} />
            <Info label="Contato" value={contract.company.phone || contract.company.whatsapp || contract.company.email} />
            <Info label="Endereco" value={[contract.company.address, contract.company.city, contract.company.state, contract.company.zipCode].filter(Boolean).join(", ")} />
          </PrintGroup>

          <PrintGroup title="Cliente">
            <Info label="Nome" value={contract.customer.fullName} />
            <Info label="CPF" value={contract.customer.cpf} />
            <Info label="CNH" value={contract.customer.driverLicenseNumber} />
            <Info label="Contato" value={contract.customer.phone || contract.customer.whatsapp || contract.customer.email} />
            <Info label="Endereco" value={[contract.customer.address, contract.customer.number, contract.customer.district, contract.customer.city, contract.customer.state].filter(Boolean).join(", ")} />
          </PrintGroup>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <PrintGroup title="Moto">
            <Info label="Marca/modelo" value={`${contract.motorcycle.brand} ${contract.motorcycle.model}`} />
            <Info label="Placa" value={contract.motorcycle.plate} />
            <Info label="Renavam" value={contract.motorcycle.renavam} />
            <Info label="Chassi" value={contract.motorcycle.chassis} />
            <Info label="Cor" value={contract.motorcycle.color} />
            <Info label="Quilometragem inicial" value={contract.initialMileage ? `${contract.initialMileage.toLocaleString("pt-BR")} km` : null} />
          </PrintGroup>

          <PrintGroup title="Condicoes do contrato">
            <Info label="Tipo" value={contractTypeLabels[contract.type]} />
            <Info label="Status" value={contractStatusLabels[contract.status]} />
            <Info label="Inicio" value={formatDate(contract.startDate)} />
            <Info label="Termino previsto" value={formatDate(contract.expectedEndDate)} />
            <Info label="Frequencia" value={billingFrequencyLabels[contract.billingFrequency]} />
            <Info label="Dia semanal" value={contract.weeklyDueDay ? weekDayLabels[contract.weeklyDueDay] : null} />
            <Info label="Dia mensal" value={contract.monthlyDueDay} />
          </PrintGroup>
        </div>

        <PrintGroup title="Valores" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Info label="Valor da parcela" value={formatCurrency(contract.installmentAmount)} />
            <Info label="Quantidade de parcelas" value={contract.totalInstallments} />
            <Info label="Entrada" value={formatCurrency(contract.downPayment)} />
            <Info label="Caucao" value={formatCurrency(contract.depositAmount)} />
            <Info label="Multa" value={formatCurrency(contract.lateFeeAmount)} />
            <Info label="Juros" value={formatCurrency(contract.lateInterestAmount)} />
            <Info label="Tolerancia" value={`${contract.gracePeriodDays} dia(s)`} />
            <Info label="Valor total" value={formatCurrency(contract.totalAmount)} />
          </div>
        </PrintGroup>

        <PrintGroup title="Termos e observacoes" className="mt-6">
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {contract.customTerms || contract.notes || "Sem termos personalizados informados."}
          </p>
        </PrintGroup>

        <div className="mt-14 grid gap-12 text-center text-sm text-slate-600 sm:grid-cols-2">
          <div className="border-t border-slate-400 pt-3">
            Assinatura da empresa
          </div>
          <div className="border-t border-slate-400 pt-3">
            Assinatura do cliente
          </div>
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
