import Link from "next/link";
import { notFound } from "next/navigation";
import { reversePaymentAction } from "@/app/actions";
import { PaymentStatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit";
import { Field, TextArea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PrintButton } from "@/components/ui/print-button";
import { requireUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { formatCurrency, formatDate, paymentMethodLabels } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function PaymentReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const payment = await prisma.payment.findFirst({
    where: {
      id,
      companyId: user.companyId!,
      ...(user.role === "CUSTOMER" ? { customerId: user.customerId! } : {})
    },
    include: {
      company: true,
      customer: true,
      contract: {
        include: { motorcycle: true }
      },
      installment: true,
      registeredBy: true,
      reversedBy: true
    }
  });

  if (!payment) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Recibo"
        description={payment.code}
        breadcrumbs={[{ label: "Pagamentos", href: "/payments" }, { label: payment.code }]}
        action={<PrintButton />}
      />

      <Card className="mx-auto max-w-3xl print:border-0 print:shadow-none">
        <CardContent className="p-8">
          <div className="border-b border-slate-200 pb-6">
            <p className="text-sm font-medium text-slate-500">{APP_NAME}</p>
            <h1 className="mt-1 text-2xl font-semibold text-asphalt">Recibo de pagamento</h1>
            <p className="mt-2 text-sm text-slate-500">{payment.company.legalName}</p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Info label="Codigo do pagamento" value={payment.code} />
            <Info label="Data" value={formatDate(payment.paymentDate)} />
            <Info label="Cliente" value={payment.customer.fullName} />
            <Info label="Contrato" value={payment.contract.code} />
            <Info label="Moto" value={`${payment.contract.motorcycle.brand} ${payment.contract.motorcycle.model} - ${payment.contract.motorcycle.plate}`} />
            <Info label="Parcela" value={payment.installment ? String(payment.installment.number) : "-"} />
            <Info label="Valor" value={formatCurrency(payment.amountPaid)} />
            <Info label="Forma de pagamento" value={paymentMethodLabels[payment.method]} />
            <div>
              <p className="text-xs font-medium uppercase text-slate-400">Status</p>
              <div className="mt-1"><PaymentStatusBadge status={payment.status} /></div>
            </div>
            <Info label="Referencia" value={payment.reference} />
            <Info label="Responsavel" value={payment.registeredBy?.name} />
            {payment.status === "REVERSED" ? (
              <>
                <Info label="Estornado em" value={formatDate(payment.reversedAt)} />
                <Info label="Estornado por" value={payment.reversedBy?.name} />
                <Info label="Motivo do estorno" value={payment.reversalReason} />
              </>
            ) : null}
          </div>

          {payment.note ? (
            <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase text-slate-400">Observacao</p>
              <p className="mt-1 text-sm">{payment.note}</p>
            </div>
          ) : null}

          <div className="mt-8 flex justify-between gap-8 text-center text-sm text-slate-500">
            <div className="w-full border-t border-slate-300 pt-2">Responsavel pela locadora</div>
            <div className="w-full border-t border-slate-300 pt-2">Cliente</div>
          </div>

          {user.role === "COMPANY_ADMIN" && payment.status === "CONFIRMED" ? (
            <details className="no-print mt-8 rounded-md border border-red-100 bg-red-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-red-700">Estornar pagamento</summary>
              <form action={reversePaymentAction} className="mt-4 grid gap-3">
                <input type="hidden" name="paymentId" value={payment.id} />
                <input type="hidden" name="returnTo" value={`/payments/${payment.id}`} />
                <Field label="Motivo" name="reversalReason" required />
                <TextArea label="Observacao obrigatoria" name="reversalNotes" rows={3} />
                <ConfirmSubmitButton label="Confirmar estorno" message="Confirmar estorno deste pagamento e reabrir o saldo da parcela?" />
              </form>
            </details>
          ) : null}

          <div className="no-print mt-6">
            <Link href="/payments" className="text-sm font-medium text-petrol hover:underline">
              Voltar para pagamentos
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-asphalt">{value || "-"}</p>
    </div>
  );
}
