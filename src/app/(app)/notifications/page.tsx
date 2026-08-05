import { createNotificationAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SelectField, TextArea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import { formatDate, notificationTypeLabels, priorityLabels } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const user = await requireCompanyRole();

  const [customers, notifications] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: user.companyId!, status: "ACTIVE", deletedAt: null },
      orderBy: { fullName: "asc" }
    }),
    prisma.notification.findMany({
      where: { companyId: user.companyId! },
      orderBy: { publishedAt: "desc" },
      include: {
        recipients: true,
        createdBy: true
      },
      take: 80
    })
  ]);

  return (
    <>
      <PageHeader
        title="Avisos"
        description="Envie notificacoes internas para um cliente ou para toda a carteira."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Avisos" }]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card>
          <CardHeader title="Novo aviso" />
          <CardContent>
            <form action={createNotificationAction} className="grid gap-4">
              <Field label="Titulo" name="title" required />
              <TextArea label="Mensagem" name="message" rows={5} />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField label="Tipo" name="type" defaultValue="GENERAL">
                  {Object.entries(notificationTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </SelectField>
                <SelectField label="Prioridade" name="priority" defaultValue="NORMAL">
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </SelectField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Publicacao" name="publishedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                <Field label="Expira em" name="expiresAt" type="date" />
              </div>
              <SelectField label="Destinatarios" name="recipientMode" defaultValue="ALL">
                <option value="ALL">Todos os clientes ativos</option>
                <option value="ONE">Um cliente</option>
              </SelectField>
              <SelectField label="Cliente" name="customerId">
                <option value="">Selecione quando for aviso individual</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.fullName}</option>
                ))}
              </SelectField>
              <Button type="submit">Enviar aviso</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Historico de avisos" />
          <CardContent>
            {notifications.length ? (
              <div className="grid gap-3">
                {notifications.map((notification) => {
                  const unread = notification.recipients.filter((recipient) => !recipient.readAt).length;
                  return (
                    <article key={notification.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-asphalt">{notification.title}</p>
                          <p className="mt-1 text-sm text-slate-500">{notification.message}</p>
                        </div>
                        <Badge tone={notification.priority === "URGENT" ? "red" : notification.priority === "HIGH" ? "yellow" : "neutral"}>
                          {priorityLabels[notification.priority]}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{notificationTypeLabels[notification.type]}</span>
                        <span>{formatDate(notification.publishedAt)}</span>
                        <span>{notification.recipients.length} destinatarios</span>
                        <span>{unread} nao lidos</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="Sem avisos" description="Envie o primeiro comunicado interno para os clientes." />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
