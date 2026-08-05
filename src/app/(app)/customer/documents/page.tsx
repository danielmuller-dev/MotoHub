import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCustomerPortalData } from "@/lib/customer-data";
import { formatDate } from "@/lib/format";

export default async function CustomerDocumentsPage() {
  const { customer, activeContract } = await getCustomerPortalData();
  const contractDocuments = activeContract?.documents.filter((document) => document.visibleToCustomer) ?? [];
  const documents = [...customer.documents, ...contractDocuments];

  return (
    <>
      <PageHeader title="Documentos" description="Documentos liberados pela locadora." />
      <Card>
        <CardHeader title="Arquivos disponiveis" />
        <CardContent className="grid gap-3">
          {documents.length ? (
            documents.map((document) => (
              <a key={document.id} href={document.fileUrl} target="_blank" className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
                <p className="font-semibold text-asphalt">{document.name}</p>
                <p className="mt-1 text-sm text-slate-500">Validade: {formatDate(document.expirationDate)}</p>
              </a>
            ))
          ) : (
            <EmptyState title="Sem documentos" description="Nenhum documento foi liberado para sua area." />
          )}
        </CardContent>
      </Card>
    </>
  );
}
