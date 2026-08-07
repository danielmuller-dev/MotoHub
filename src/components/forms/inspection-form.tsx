import type {
  ContractStatus,
  FuelLevel,
  Inspection,
  InspectionAccessory,
  InspectionItem,
  InspectionPhoto,
  InspectionSignature,
  InspectionType,
  MotorcycleStatus
} from "@prisma/client";
import { Camera, CheckCircle2, ClipboardCheck, Save } from "lucide-react";
import { upsertInspectionAction } from "@/app/actions";
import { SignaturePad } from "@/components/forms/signature-pad";
import { Button } from "@/components/ui/button";
import { Field, SelectField, TextArea } from "@/components/ui/field";
import {
  fuelLevelLabels,
  formatDateInput,
  inspectionConditionLabels,
  inspectionPhotoTypeLabels,
  inspectionStatusLabels,
  inspectionTypeLabels,
  motorcycleStatusLabels
} from "@/lib/format";
import {
  defaultInspectionAccessories,
  inspectionChecklist,
  requiredInspectionPhotoTypes
} from "@/lib/inspection-checklist";

type ContractOption = {
  id: string;
  code: string;
  status: ContractStatus;
  customerId: string;
  motorcycleId: string;
  customer: { fullName: string; cpf: string };
  motorcycle: { brand: string; model: string; plate: string; currentMileage: number };
};

type MotorcycleOption = {
  id: string;
  brand: string;
  model: string;
  plate: string;
  currentMileage: number;
  status: MotorcycleStatus;
};

type CustomerOption = {
  id: string;
  fullName: string;
  cpf: string;
};

type ExistingInspection = Inspection & {
  items: InspectionItem[];
  accessories: InspectionAccessory[];
  photos: InspectionPhoto[];
  signatures: InspectionSignature[];
};

type InspectionFormProps = {
  contracts: ContractOption[];
  motorcycles: MotorcycleOption[];
  customers: CustomerOption[];
  inspection?: ExistingInspection | null;
  defaultContractId?: string | null;
  defaultMotorcycleId?: string | null;
  defaultCustomerId?: string | null;
  defaultType?: InspectionType;
  returnTo?: string;
  currentUserName: string;
};

const destinationStatuses: MotorcycleStatus[] = ["AVAILABLE", "MAINTENANCE", "BLOCKED"];
const fuelLevels = Object.keys(fuelLevelLabels) as FuelLevel[];
const inspectionTypes = Object.keys(inspectionTypeLabels) as InspectionType[];
const extraPhotoTypes = ["DAMAGE", "ACCESSORY", "OTHER"] as const;

function decimalInput(value: { toNumber(): number } | number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }
  const number = typeof value === "number" ? value : value.toNumber();
  return Number.isFinite(number) ? number.toFixed(2) : "";
}

function groupedChecklist() {
  const groups = new Map<string, typeof inspectionChecklist>();
  for (const item of inspectionChecklist) {
    groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
  }
  return Array.from(groups.entries());
}

export function InspectionForm({
  contracts,
  motorcycles,
  customers,
  inspection,
  defaultContractId,
  defaultMotorcycleId,
  defaultCustomerId,
  defaultType = "DELIVERY",
  returnTo = "/inspections",
  currentUserName
}: InspectionFormProps) {
  const selectedContractId = inspection?.contractId ?? defaultContractId ?? "";
  const selectedContract = contracts.find((contract) => contract.id === selectedContractId);
  const selectedMotorcycleId = inspection?.motorcycleId ?? selectedContract?.motorcycleId ?? defaultMotorcycleId ?? "";
  const selectedCustomerId = inspection?.customerId ?? selectedContract?.customerId ?? defaultCustomerId ?? "";
  const itemByKey = new Map((inspection?.items ?? []).map((item) => [item.itemKey, item]));
  const accessoryByName = new Map((inspection?.accessories ?? []).map((accessory) => [accessory.name, accessory]));
  const type = inspection?.type ?? defaultType;
  const isReturn = type === "RETURN";

  return (
    <form action={upsertInspectionAction} encType="multipart/form-data" className="grid gap-6">
      {inspection ? <input type="hidden" name="inspectionId" value={inspection.id} /> : null}
      <input type="hidden" name="returnTo" value={returnTo} />

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-asphalt">Dados da vistoria</h2>
            <p className="mt-1 text-sm text-slate-500">
              Tipo, moto, cliente, quilometragem e condicao geral.
            </p>
          </div>
          {inspection ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              {inspectionStatusLabels[inspection.status]}
            </span>
          ) : null}
        </div>
        <div className="grid gap-4 p-5">
          <div className="form-grid-2">
            <SelectField label="Tipo" name="type" defaultValue={type} required>
              {inspectionTypes.map((value) => (
                <option key={value} value={value}>
                  {inspectionTypeLabels[value]}
                </option>
              ))}
            </SelectField>
            <SelectField label="Contrato" name="contractId" defaultValue={selectedContractId}>
              <option value="">Sem contrato</option>
              {contracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.code} | {contract.customer.fullName} | {contract.motorcycle.plate}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="form-grid-2">
            <SelectField label="Moto" name="motorcycleId" defaultValue={selectedMotorcycleId} required>
              <option value="">Selecione</option>
              {motorcycles.map((motorcycle) => (
                <option key={motorcycle.id} value={motorcycle.id}>
                  {motorcycle.brand} {motorcycle.model} | {motorcycle.plate} | {motorcycle.currentMileage} km
                </option>
              ))}
            </SelectField>
            <SelectField label="Cliente" name="customerId" defaultValue={selectedCustomerId}>
              <option value="">Sem cliente</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.fullName} | {customer.cpf}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="form-grid-2">
            <Field
              label="Data"
              name="inspectionDate"
              type="date"
              defaultValue={formatDateInput(inspection?.inspectionDate ?? new Date())}
              required
            />
            <Field
              label="Quilometragem"
              name="mileage"
              type="number"
              min={0}
              defaultValue={inspection?.mileage ?? selectedContract?.motorcycle.currentMileage ?? ""}
              required
            />
          </div>
          <div className="form-grid-2">
            <SelectField label="Combustivel" name="fuelLevel" defaultValue={inspection?.fuelLevel ?? "FULL"} required>
              {fuelLevels.map((value) => (
                <option key={value} value={value}>
                  {fuelLevelLabels[value]}
                </option>
              ))}
            </SelectField>
            <Field label="Local" name="location" defaultValue={inspection?.location} />
          </div>
          <div className="form-grid-2">
            <SelectField
              label="Destino da moto na devolucao"
              name="destinationStatus"
              defaultValue={inspection?.destinationStatus ?? "AVAILABLE"}
            >
              {destinationStatuses.map((status) => (
                <option key={status} value={status}>
                  {motorcycleStatusLabels[status]}
                </option>
              ))}
            </SelectField>
            <Field
              label="Valor por km excedente"
              name="mileageExcessKmPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={isReturn ? decimalInput(inspection?.mileageExcessCharge) : "0"}
            />
          </div>
          <TextArea label="Condicao geral" name="generalCondition" defaultValue={inspection?.generalCondition} rows={3} />
          <TextArea label="Avarias gerais" name="generalDamages" defaultValue={inspection?.generalDamages} rows={3} />
          <TextArea label="Observacoes" name="notes" defaultValue={inspection?.notes} rows={3} />
          <TextArea label="Notas administrativas" name="administrativeNotes" defaultValue={inspection?.administrativeNotes} rows={3} />
          <div className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="customerPresent" defaultChecked={inspection?.customerPresent ?? true} />
              Cliente presente
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="customerRefusedSignature" defaultChecked={inspection?.customerRefusedSignature ?? false} />
              Cliente recusou assinatura
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name="createMaintenance" defaultChecked={false} />
              Gerar manutencoes
            </label>
          </div>
          <Field label="Motivo da recusa" name="refusalReason" defaultValue={inspection?.refusalReason} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5">
          <ClipboardCheck className="h-5 w-5 text-petrol" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-asphalt">Checklist da moto</h2>
            <p className="mt-1 text-sm text-slate-500">{inspectionChecklist.length} itens padrao de vistoria.</p>
          </div>
        </div>
        <div className="grid gap-5 p-5">
          {groupedChecklist().map(([category, items]) => (
            <div key={category} className="overflow-hidden rounded-lg border border-slate-100">
              <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-asphalt">{category}</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Condicao</th>
                      <th className="px-3 py-2">Observacao</th>
                      <th className="px-3 py-2">Custo</th>
                      <th className="px-3 py-2">Marcacoes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const current = itemByKey.get(item.key);
                      return (
                        <tr key={item.key} className="align-top">
                          <td className="px-3 py-3 font-medium text-slate-700">{item.label}</td>
                          <td className="px-3 py-3">
                            <select
                              name={`item_${item.key}_condition`}
                              defaultValue={current?.condition ?? "NOT_CHECKED"}
                              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                            >
                              {Object.entries(inspectionConditionLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              name={`item_${item.key}_notes`}
                              defaultValue={current?.notes ?? ""}
                              className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              name={`item_${item.key}_estimatedCost`}
                              type="number"
                              step="0.01"
                              min={0}
                              defaultValue={decimalInput(current?.estimatedCost)}
                              className="h-9 w-28 rounded-md border border-slate-200 px-2 text-sm"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                              <label className="flex items-center gap-1.5">
                                <input type="checkbox" name={`item_${item.key}_preExisting`} defaultChecked={current?.preExisting ?? false} />
                                Preexistente
                              </label>
                              <label className="flex items-center gap-1.5">
                                <input type="checkbox" name={`item_${item.key}_newDamage`} defaultChecked={current?.newDamage ?? false} />
                                Nova
                              </label>
                              <label className="flex items-center gap-1.5">
                                <input type="checkbox" name={`item_${item.key}_chargeCustomer`} defaultChecked={current?.chargeCustomer ?? false} />
                                Cobrar
                              </label>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-base font-semibold text-asphalt">Acessorios</h2>
          <p className="mt-1 text-sm text-slate-500">Itens entregues, devolvidos e valores de reposicao.</p>
        </div>
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Acessorio</th>
                <th className="px-3 py-2">Entregue</th>
                <th className="px-3 py-2">Devolvido</th>
                <th className="px-3 py-2">Condicao</th>
                <th className="px-3 py-2">Custo</th>
                <th className="px-3 py-2">Cobrar</th>
                <th className="px-3 py-2">Observacao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {defaultInspectionAccessories.map((name, index) => {
                const accessory = accessoryByName.get(name);
                return (
                  <tr key={name}>
                    <td className="px-3 py-3 font-medium text-slate-700">{name}</td>
                    <td className="px-3 py-3">
                      <input type="checkbox" name={`accessory_${index}_delivered`} defaultChecked={accessory?.delivered ?? type !== "RETURN"} />
                    </td>
                    <td className="px-3 py-3">
                      <input type="checkbox" name={`accessory_${index}_returned`} defaultChecked={accessory?.returned ?? type === "RETURN"} />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        name={`accessory_${index}_condition`}
                        defaultValue={accessory?.condition ?? "NOT_CHECKED"}
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                      >
                        {Object.entries(inspectionConditionLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name={`accessory_${index}_replacementCost`}
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={decimalInput(accessory?.replacementCost)}
                        className="h-9 w-28 rounded-md border border-slate-200 px-2 text-sm"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input type="checkbox" name={`accessory_${index}_chargeCustomer`} defaultChecked={accessory?.chargeCustomer ?? false} />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        name={`accessory_${index}_notes`}
                        defaultValue={accessory?.notes ?? ""}
                        className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5">
          <Camera className="h-5 w-5 text-petrol" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-asphalt">Fotos da vistoria</h2>
            <p className="mt-1 text-sm text-slate-500">{inspection?.photos.length ?? 0} foto(s) anexada(s).</p>
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          {[...requiredInspectionPhotoTypes, ...extraPhotoTypes].map((type) => (
            <label key={type} className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm font-medium text-slate-700">
              {inspectionPhotoTypeLabels[type]}
              <input name={`photo_${type}`} type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
              <input
                name={`photo_${type}_caption`}
                placeholder="Legenda"
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-base font-semibold text-asphalt">Assinaturas</h2>
          <p className="mt-1 text-sm text-slate-500">{inspection?.signatures.length ?? 0} assinatura(s) registrada(s).</p>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <SignaturePad
            label="Assinatura do cliente"
            name="customerSignatureDataUrl"
            signerName={selectedContract?.customer.fullName ?? customers.find((customer) => customer.id === selectedCustomerId)?.fullName ?? "Cliente"}
            signerNameField="customerSignatureName"
          />
          <SignaturePad
            label="Assinatura do responsavel"
            name="employeeSignatureDataUrl"
            signerName={currentUserName}
            signerNameField="employeeSignatureName"
          />
        </div>
      </section>

      <div className="no-print sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="submit" name="submitIntent" value="DRAFT" variant="secondary">
            <Save className="h-4 w-4" aria-hidden="true" />
            Salvar rascunho
          </Button>
          <Button type="submit" name="submitIntent" value="COMPLETE">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Concluir vistoria
          </Button>
        </div>
      </div>
    </form>
  );
}
