import { ContractStatus, InstallmentStatus, MotorcycleStatus, PaymentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  contractStatusLabels,
  installmentStatusLabels,
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
