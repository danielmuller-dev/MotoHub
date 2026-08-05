import { changePasswordAction, updateSettingsAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, TextArea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const user = await requireCompanyRole(["COMPANY_ADMIN"]);
  const company = await prisma.company.findUnique({
    where: { id: user.companyId! },
    include: { settings: true }
  });

  return (
    <>
      <PageHeader
        title="Configuracoes"
        description="Dados da empresa, preferencia financeira e alteracao de senha."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Configuracoes" }]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Empresa" />
          <CardContent>
            <form action={updateSettingsAction} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome empresarial" name="legalName" defaultValue={company?.legalName} required />
                <Field label="Nome fantasia" name="tradeName" defaultValue={company?.tradeName} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="CPF/CNPJ" name="document" defaultValue={company?.document} />
                <Field label="E-mail" name="email" type="email" defaultValue={company?.email} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Telefone" name="phone" defaultValue={company?.phone} />
                <Field label="WhatsApp" name="whatsapp" defaultValue={company?.whatsapp} />
              </div>
              <Field label="Endereco" name="address" defaultValue={company?.address} />
              <Field label="Logo por URL" name="logoUrl" type="url" defaultValue={company?.logoUrl} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Moeda" name="currency" defaultValue={company?.settings?.currency ?? "BRL"} />
                <Field label="Fuso horario" name="timezone" defaultValue={company?.settings?.timezone ?? "America/Bahia"} />
                <Field label="Tolerancia padrao" name="defaultGracePeriodDays" type="number" defaultValue={company?.settings?.defaultGracePeriodDays ?? 0} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Multa padrao" name="defaultLateFee" type="number" step="0.01" defaultValue={company?.settings?.defaultLateFee.toString() ?? 0} />
                <Field label="Juros padrao" name="defaultInterest" type="number" step="0.01" defaultValue={company?.settings?.defaultInterest.toString() ?? 0} />
              </div>
              <TextArea label="Texto padrao do recibo" name="receiptDefaultText" defaultValue={company?.settings?.receiptDefaultText} />
              <Button type="submit">Salvar configuracoes</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Alterar senha" />
          <CardContent>
            <form action={changePasswordAction} className="grid gap-4">
              <Field label="Senha atual" name="currentPassword" type="password" required />
              <Field label="Nova senha" name="newPassword" type="password" required />
              <Button type="submit" variant="secondary">Alterar senha</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
