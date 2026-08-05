import type { Prisma, PrismaClient } from "@prisma/client";

type AuditClient = PrismaClient | Prisma.TransactionClient;

type AuditInput = {
  companyId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
};

export async function recordAudit(client: AuditClient, input: AuditInput) {
  return client.auditLog.create({
    data: {
      companyId: input.companyId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      description: input.description,
      before: input.before ?? undefined,
      after: input.after ?? undefined
    }
  });
}
