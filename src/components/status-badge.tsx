import {
  AdditionalChargeStatus,
  ContractStatus,
  DamageStatus,
  InspectionStatus,
  InstallmentStatus,
  MotorcycleStatus,
  PaymentStatus
} from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  additionalChargeStatusLabels,
  contractStatusLabels,
  damageStatusLabels,
  installmentStatusLabels,
  inspectionStatusLabels,
  motorcycleStatusLabels,
  paymentStatusLabels
} from "@/lib/format";

export function MotorcycleStatusBadge({ status }: { status: MotorcycleStatus }) {
  const tone =
    status === "AVAILABLE"
      ? "green"
      : status === "RENTED"
        ? "blue"
        : status === "MAINTENANCE"
          ? "yellow"
          : status === "SOLD"
            ? "dark"
            : "red";

  return <Badge tone={tone}>{motorcycleStatusLabels[status]}</Badge>;
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const tone =
    status === "ACTIVE"
      ? "green"
      : status === "OVERDUE"
        ? "red"
        : status === "COMPLETED"
          ? "blue"
          : status === "TERMINATED"
            ? "dark"
            : status === "DRAFT"
              ? "neutral"
              : "yellow";

  return <Badge tone={tone}>{contractStatusLabels[status]}</Badge>;
}

export function InstallmentStatusBadge({ status }: { status: InstallmentStatus }) {
  const tone =
    status === "PAID"
      ? "green"
      : status === "OVERDUE"
        ? "red"
        : status === "PARTIALLY_PAID"
          ? "yellow"
          : "neutral";

  return <Badge tone={tone}>{installmentStatusLabels[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge tone={status === "REVERSED" ? "red" : "green"}>
      {paymentStatusLabels[status]}
    </Badge>
  );
}

export function InspectionStatusBadge({ status }: { status: InspectionStatus }) {
  const tone =
    status === "COMPLETED"
      ? "green"
      : status === "CANCELLED"
        ? "red"
        : status === "IN_PROGRESS"
          ? "blue"
          : "neutral";

  return <Badge tone={tone}>{inspectionStatusLabels[status]}</Badge>;
}

export function DamageStatusBadge({ status }: { status: DamageStatus }) {
  const tone =
    status === "APPROVED" || status === "CHARGED"
      ? "yellow"
      : status === "REPAIRED"
        ? "green"
        : status === "REJECTED" || status === "CANCELLED"
          ? "red"
          : "neutral";

  return <Badge tone={tone}>{damageStatusLabels[status]}</Badge>;
}

export function AdditionalChargeStatusBadge({ status }: { status: AdditionalChargeStatus }) {
  const tone =
    status === "PAID"
      ? "green"
      : status === "CANCELLED"
        ? "red"
        : status === "PENDING"
          ? "neutral"
          : "yellow";

  return <Badge tone={tone}>{additionalChargeStatusLabels[status]}</Badge>;
}
