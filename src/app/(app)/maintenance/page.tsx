import { createMaintenanceAction } from "@/app/actions";
import { MotorcycleStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SelectField, TextArea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireCompanyRole } from "@/lib/auth";
import {
  formatCurrency,
  formatDate,
  maintenanceStatusLabels,
  maintenanceTypeLabels
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function MaintenancePage() {
  const user = await requireCompanyRole();

  const [motorcycles, maintenances] = await Promise.all([
    prisma.motorcycle.findMany({
      where: { companyId: user.companyId!, deletedAt: null, status: { notIn: ["SOLD", "INACTIVE"] } },
      orderBy: [{ brand: "asc" }, { model: "asc" }]
    }),
    prisma.maintenance.findMany({
      where: { companyId: user.companyId! },
      orderBy: { date: "desc" },
      include: { motorcycle: true },
      take: 80
    })
  ]);

  return (
    <>
      <PageHeader
        title="Manutencoes"
        description="Agende, acompanhe custos e mantenha o historico por moto."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Manutencoes" }]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <Card>
          <CardHeader title="Nova manutencao" />
          <CardContent>
            <form action={createMaintenanceAction} className="grid gap-4">
              <SelectField label="Moto" name="motorcycleId" required>
                <option value="">Selecione</option>
                {motorcycles.map((motorcycle) => (
                  <option key={motorcycle.id} value={motorcycle.id}>
                    {motorcycle.brand} {motorcycle.model} - {motorcycle.plate}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Tipo" name="type" defaultValue="PREVENTIVE">
                {Object.entries(maintenanceTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </SelectField>
              <Field label="Descricao" name="description" required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
                <Field label="Quilometragem" name="mileage" type="number" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Valor" name="amount" type="number" step="0.01" defaultValue={0} />
                <Field label="Oficina/responsavel" name="workshop" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Proxima manutencao" name="nextMaintenanceDate" type="date" />
                <Field label="Proxima km" name="nextMaintenanceMileage" type="number" />
              </div>
              <SelectField label="Status" name="status" defaultValue="SCHEDULED">
                {Object.entries(maintenanceStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </SelectField>
              <TextArea label="Observacoes" name="notes" />
              <Button type="submit">Salvar manutencao</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Historico de manutencoes" />
          <CardContent>
            {maintenances.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Moto</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Descricao</th>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {maintenances.map((maintenance) => (
                      <tr key={maintenance.id}>
                        <td className="px-3 py-3">
                          {maintenance.motorcycle.plate}
                          <div className="mt-1"><MotorcycleStatusBadge status={maintenance.motorcycle.status} /></div>
                        </td>
                        <td className="px-3 py-3">{maintenanceTypeLabels[maintenance.type]}</td>
                        <td className="px-3 py-3">{maintenance.description}</td>
                        <td className="px-3 py-3">{formatDate(maintenance.date)}</td>
                        <td className="px-3 py-3">{formatCurrency(maintenance.amount)}</td>
                        <td className="px-3 py-3">{maintenanceStatusLabels[maintenance.status]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sem manutencoes" description="Registre a primeira manutencao da frota." />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
