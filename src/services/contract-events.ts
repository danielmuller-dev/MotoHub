import type { ContractEventType, Prisma } from "@prisma/client";

type ContractEventInput = {
  companyId: string;
  contractId: string;
  userId?: string | null;
  type: ContractEventType;
  title: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
};

export function recordContractEvent(
  tx: Prisma.TransactionClient,
  input: ContractEventInput
) {
  return tx.contractEvent.create({
    data: {
      companyId: input.companyId,
      contractId: input.contractId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      description: input.description,
      metadata: input.metadata
    }
  });
}
