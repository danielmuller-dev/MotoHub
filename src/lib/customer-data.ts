import "server-only";

import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCustomerPortalData() {
  const user = await requireRole(["CUSTOMER"]);
  if (!user.customerId || !user.companyId) {
    notFound();
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: user.customerId,
      companyId: user.companyId,
      deletedAt: null
    },
    include: {
      contracts: {
        orderBy: { createdAt: "desc" },
        include: {
          motorcycle: true,
          installments: { orderBy: { number: "asc" }, include: { payments: true } },
          payments: { orderBy: { paymentDate: "desc" } },
          documents: true
        }
      },
      documents: {
        where: { visibleToCustomer: true },
        orderBy: { expirationDate: "asc" }
      },
      notificationRecipients: {
        include: { notification: true },
        orderBy: { createdAt: "desc" }
      },
      company: true
    }
  });

  if (!customer) {
    notFound();
  }

  const activeContract = customer.contracts.find((contract) =>
    ["ACTIVE", "OVERDUE", "SUSPENDED", "COMPLETED"].includes(contract.status)
  );

  return {
    user,
    customer,
    activeContract
  };
}

export function maskPlate(plate: string) {
  if (plate.length <= 3) {
    return plate;
  }
  return `${plate.slice(0, 3)}***${plate.slice(-1)}`;
}
