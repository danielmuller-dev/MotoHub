import { createDocumentAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SelectField, TextArea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { documentStatusLabels, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const documentTypeLabels = {
  CNH: "CNH",
  CRLV: "CRLV",
  SIGNED_CONTRACT: "Contrato assinado",
  PROOF_OF_ADDRESS: "Comprovante de residencia",
  PERSONAL_DOCUMENT: "Documento pessoal",
  INSURANCE: "Seguro",
  INSPECTION: "Vistoria",
  OTHER: "Outro"
};

export default async function DocumentsPage() {
  const user = await requireCompanyRole();

  const [customers, motorcycles, contracts, documents] = await Promise.all([
    prisma.customer.findMany({ where: { companyId: user.companyId!, deletedAt: null }, orderBy: { fullName: "asc" } }),
    prisma.motorcycle.findMany({ where: { companyId: user.companyId!, deletedAt: null }, orderBy: { plate: "asc" } }),
    prisma.contract.findMany({ where: { companyId: user.companyId!, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 80 }),
    prisma.document.findMany({
      where: { companyId: user.companyId! },
      orderBy: [{ expirationDate: "asc" }, { createdAt: "desc" }],
      include: { customer: true, motorcycle: true, contract: true },
      take: 100
    })
  ]);

  const now = new Date();
  const soon = new Date(now);
  soon.setUTCDate(soon.getUTCDate() + 30);

  return (
    <>
      <PageHeader
        title="Documentos"
        description="Controle vencimentos e URLs de arquivos vinculados a empresa, cliente, moto ou contrato."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Documentos" }]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card>
          <CardHeader title="Cadastrar documento" />
          <CardContent>
            <form action={createDocumentAction} className="grid gap-4">
              <Field label="Nome" name="name" required />
              <SelectField label="Tipo" name="type" defaultValue="OTHER">
                {Object.entries(documentTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </SelectField>
              <Field label="Numero" name="number" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Emissao" name="issueDate" type="date" />
                <Field label="Vencimento" name="expirationDate" type="date" />
              </div>
              <Field label="URL do arquivo" name="fileUrl" type="url" required />
              <SelectField label="Cliente" name="customerId">
                <option value="">Nao vincular</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.fullName}</option>
                ))}
              </SelectField>
              <SelectField label="Moto" name="motorcycleId">
                <option value="">Nao vincular</option>
                {motorcycles.map((motorcycle) => (
                  <option key={motorcycle.id} value={motorcycle.id}>{motorcycle.plate}</option>
                ))}
              </SelectField>
              <SelectField label="Contrato" name="contractId">
                <option value="">Nao vincular</option>
                {contracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>{contract.code}</option>
                ))}
              </SelectField>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input name="visibleToCustomer" type="checkbox" className="h-4 w-4 rounded border-slate-300" />
                Visivel para o cliente
              </label>
              <TextArea label="Observacao" name="note" />
              <Button type="submit">Cadastrar documento</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Documentos cadastrados" />
          <CardContent>
            {documents.length ? (
              <div className="grid gap-3">
                {documents.map((document) => {
                  const expiration = document.expirationDate;
                  const computedStatus = expiration && expiration < now ? "EXPIRED" : expiration && expiration <= soon ? "EXPIRING_SOON" : document.status;
                  const tone = computedStatus === "EXPIRED" ? "red" : computedStatus === "EXPIRING_SOON" ? "yellow" : "green";
                  return (
                    <a key={document.id} href={document.fileUrl} target="_blank" className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-asphalt">{document.name}</p>
                          <p className="text-sm text-slate-500">
                            {document.customer?.fullName || document.motorcycle?.plate || document.contract?.code || "Empresa"}
                          </p>
                        </div>
                        <Badge tone={tone}>{documentStatusLabels[computedStatus]}</Badge>
                      </div>
                      <p className="mt-3 text-sm text-slate-500">Vencimento: {formatDate(document.expirationDate)}</p>
                    </a>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="Sem documentos" description="Cadastre URLs de documentos e acompanhe vencimentos." />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
