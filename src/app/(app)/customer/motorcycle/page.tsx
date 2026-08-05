import { Bike } from "lucide-react";
import { MotorcycleStatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getCustomerPortalData, maskPlate } from "@/lib/customer-data";

export default async function CustomerMotorcyclePage() {
  const { activeContract } = await getCustomerPortalData();
  const motorcycle = activeContract?.motorcycle;

  return (
    <>
      <PageHeader title="Minha moto" description="Dados de consulta da moto vinculada ao contrato." />
      {motorcycle ? (
        <Card className="max-w-3xl">
          <CardContent className="p-0">
            {motorcycle.photoUrl ? (
              <div
                role="img"
                aria-label={`${motorcycle.brand} ${motorcycle.model}`}
                className="aspect-video w-full rounded-t-lg bg-cover bg-center"
                style={{ backgroundImage: `url(${motorcycle.photoUrl})` }}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-t-lg bg-slate-100">
                <Bike className="h-14 w-14 text-slate-400" aria-hidden="true" />
              </div>
            )}
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Info label="Marca" value={motorcycle.brand} />
              <Info label="Modelo" value={motorcycle.model} />
              <Info label="Ano" value={`${motorcycle.manufactureYear || "-"} / ${motorcycle.modelYear || "-"}`} />
              <Info label="Placa" value={maskPlate(motorcycle.plate)} />
              <Info label="Cor" value={motorcycle.color} />
              <Info label="Quilometragem informada" value={`${motorcycle.currentMileage.toLocaleString("pt-BR")} km`} />
              <div>
                <p className="text-xs font-medium uppercase text-slate-400">Situacao</p>
                <div className="mt-1"><MotorcycleStatusBadge status={motorcycle.status} /></div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState title="Sem moto atual" description="Nenhuma moto esta vinculada ao seu contrato." />
      )}
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
