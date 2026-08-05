import { markNotificationReadAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCustomerPortalData } from "@/lib/customer-data";
import { formatDate, notificationTypeLabels, priorityLabels } from "@/lib/format";

export default async function CustomerNotificationsPage() {
  const { customer } = await getCustomerPortalData();

  return (
    <>
      <PageHeader title="Avisos" description="Comunicados enviados pela locadora." />
      <Card>
        <CardHeader title="Historico de avisos" />
        <CardContent className="grid gap-3">
          {customer.notificationRecipients.length ? (
            customer.notificationRecipients.map((recipient) => (
              <article key={recipient.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-asphalt">{recipient.notification.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{recipient.notification.message}</p>
                    <p className="mt-3 text-xs text-slate-400">
                      {notificationTypeLabels[recipient.notification.type]} | {formatDate(recipient.notification.publishedAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 sm:items-end">
                    <Badge tone={recipient.notification.priority === "URGENT" ? "red" : "neutral"}>
                      {priorityLabels[recipient.notification.priority]}
                    </Badge>
                    {recipient.readAt ? (
                      <span className="text-xs text-slate-500">Lido em {formatDate(recipient.readAt)}</span>
                    ) : (
                      <form action={markNotificationReadAction}>
                        <input type="hidden" name="recipientId" value={recipient.id} />
                        <Button type="submit" size="sm" variant="secondary">Marcar como lido</Button>
                      </form>
                    )}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="Sem avisos" description="Nenhum comunicado foi enviado para voce." />
          )}
        </CardContent>
      </Card>
    </>
  );
}
