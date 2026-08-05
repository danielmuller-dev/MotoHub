import { Prisma, PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  BillingFrequency,
  MonthlyOverflowRule,
  WeekDay,
  addDaysUtc,
  generateDueDates,
  normalizeDateOnly
} from "../src/lib/due-dates";

const prisma = new PrismaClient();

const demoPassword = "MotoGestor@123";

const weekDayIndex: Record<WeekDay, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
};

function previousOrSameWeekday(date: Date, weekday: WeekDay) {
  const diff = (date.getUTCDay() - weekDayIndex[weekday] + 7) % 7;
  return addDaysUtc(date, -diff);
}

async function resetDemoCompany(companyId: string) {
  const notifications = await prisma.notification.findMany({
    where: { companyId },
    select: { id: true }
  });

  await prisma.notificationRecipient.deleteMany({
    where: { notificationId: { in: notifications.map((notification) => notification.id) } }
  });
  await prisma.notification.deleteMany({ where: { companyId } });
  await prisma.payment.deleteMany({ where: { companyId } });
  await prisma.installment.deleteMany({ where: { companyId } });
  await prisma.document.deleteMany({ where: { companyId } });
  await prisma.maintenance.deleteMany({ where: { companyId } });
  await prisma.contract.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.motorcycle.deleteMany({ where: { companyId } });
  await prisma.customer.deleteMany({ where: { companyId } });
  await prisma.auditLog.deleteMany({ where: { companyId } });
  await prisma.companySettings.deleteMany({ where: { companyId } });
  await prisma.company.delete({ where: { id: companyId } });
}

async function createContractWithInstallments(input: {
  companyId: string;
  userId: string;
  customerId: string;
  motorcycleId: string;
  code: string;
  type: "RENTAL" | "RENT_TO_OWN";
  billingFrequency: BillingFrequency;
  firstDueDate: Date;
  weeklyDueDay?: WeekDay | null;
  monthlyDueDay?: number | null;
  monthlyOverflowRule?: MonthlyOverflowRule;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number[];
  partialInstallments?: Array<{ number: number; amount: number }>;
}) {
  const today = normalizeDateOnly(new Date());
  const dueDates = generateDueDates({
    billingFrequency: input.billingFrequency,
    firstDueDate: input.firstDueDate,
    weeklyDueDay: input.weeklyDueDay,
    monthlyDueDay: input.monthlyDueDay,
    monthlyOverflowRule: input.monthlyOverflowRule ?? "LAST_VALID_DAY",
    totalInstallments: input.totalInstallments
  });

  const contract = await prisma.contract.create({
    data: {
      companyId: input.companyId,
      customerId: input.customerId,
      motorcycleId: input.motorcycleId,
      code: input.code,
      type: input.type,
      startDate: addDaysUtc(input.firstDueDate, -2),
      expectedEndDate: dueDates[dueDates.length - 1],
      billingFrequency: input.billingFrequency,
      firstDueDate: input.firstDueDate,
      weeklyDueDay: input.billingFrequency === "WEEKLY" ? input.weeklyDueDay : null,
      monthlyDueDay: input.billingFrequency === "MONTHLY" ? input.monthlyDueDay : null,
      monthlyOverflowRule: input.monthlyOverflowRule ?? "LAST_VALID_DAY",
      installmentAmount: new Prisma.Decimal(input.installmentAmount),
      totalInstallments: input.totalInstallments,
      downPayment: new Prisma.Decimal(0),
      totalAmount: new Prisma.Decimal(input.installmentAmount).mul(input.totalInstallments),
      lateInterestAmount: new Prisma.Decimal(0),
      lateFeeAmount: new Prisma.Decimal(25),
      gracePeriodDays: 2,
      initialMileage: 12000,
      mileageLimit: 1000,
      depositAmount: new Prisma.Decimal(500),
      notes: "Contrato criado pelo seed de demonstracao.",
      customTerms: "Cliente deve manter revisoes em dia e comunicar ocorrencias imediatamente.",
      status: "ACTIVE",
      activatedAt: new Date()
    }
  });

  for (const [index, dueDate] of dueDates.entries()) {
    const number = index + 1;
    const paid = input.paidInstallments.includes(number);
    const partial = input.partialInstallments?.find((item) => item.number === number);
    const amount = new Prisma.Decimal(input.installmentAmount);
    const paidAmount = paid ? amount : partial ? new Prisma.Decimal(partial.amount) : new Prisma.Decimal(0);
    const status = paid
      ? "PAID"
      : partial
        ? "PARTIALLY_PAID"
        : dueDate < today
          ? "OVERDUE"
          : "PENDING";

    const installment = await prisma.installment.create({
      data: {
        companyId: input.companyId,
        contractId: contract.id,
        number,
        dueDate,
        originalAmount: amount,
        finalAmount: amount,
        paidAmount,
        paymentDate: paid ? dueDate : null,
        status
      }
    });

    if (paid || partial) {
      await prisma.payment.create({
        data: {
          companyId: input.companyId,
          customerId: input.customerId,
          contractId: contract.id,
          installmentId: installment.id,
          registeredByUserId: input.userId,
          code: `PG-DEMO-${input.code}-${number}`,
          amountPaid: paidAmount,
          paymentDate: addDaysUtc(dueDate, paid ? 0 : 1),
          method: number % 2 === 0 ? "PIX" : "CASH",
          reference: `DEMO-${number}`,
          note: paid ? "Pagamento integral de demonstracao." : "Pagamento parcial de demonstracao."
        }
      });
    }
  }

  await prisma.motorcycle.update({
    where: { id: input.motorcycleId },
    data: {
      status: "RENTED",
      currentCustomerId: input.customerId
    }
  });

  await prisma.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: "CONTRACT_ACTIVATED",
      entity: "Contract",
      entityId: contract.id,
      description: `Contrato demo ${contract.code} ativado.`
    }
  });

  return contract;
}

async function main() {
  const existingCompany = await prisma.company.findUnique({
    where: { slug: "locadora-piloto" },
    select: { id: true }
  });

  if (existingCompany) {
    await resetDemoCompany(existingCompany.id);
  }

  const passwordHash = await hash(demoPassword, 12);

  await prisma.user.upsert({
    where: { email: "admin@motogestor.demo" },
    update: {
      name: "Super Administrador",
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      companyId: null,
      customerId: null
    },
    create: {
      name: "Super Administrador",
      email: "admin@motogestor.demo",
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE"
    }
  });

  const company = await prisma.company.create({
    data: {
      legalName: "Locadora Piloto LTDA",
      tradeName: "Locadora Piloto",
      document: "12.345.678/0001-90",
      email: "contato@locadorapiloto.demo",
      phone: "(71) 3333-3333",
      whatsapp: "(71) 99999-9999",
      address: "Av. Tancredo Neves, 1000",
      city: "Salvador",
      state: "Bahia",
      zipCode: "41820-020",
      logoUrl: "https://dummyimage.com/300x120/20262d/f5b700&text=Locadora+Piloto",
      slug: "locadora-piloto",
      status: "ACTIVE",
      settings: {
        create: {
          currency: "BRL",
          timezone: "America/Bahia",
          receiptDefaultText: "Obrigado pela preferencia. Guarde este recibo.",
          defaultLateFee: new Prisma.Decimal(25),
          defaultInterest: new Prisma.Decimal(5),
          defaultGracePeriodDays: 2
        }
      }
    }
  });

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Gestor Piloto",
      email: "gestor@motogestor.demo",
      passwordHash,
      role: "COMPANY_ADMIN",
      status: "ACTIVE",
      phone: "(71) 98888-0001"
    }
  });

  await prisma.user.create({
    data: {
      companyId: company.id,
      name: "Atendente Piloto",
      email: "funcionario@motogestor.demo",
      passwordHash,
      role: "EMPLOYEE",
      status: "ACTIVE",
      phone: "(71) 98888-0002"
    }
  });

  const customerData = [
    ["cliente@motogestor.demo", "Cliente Demonstracao", "111.222.333-44", "(71) 98888-1001"],
    ["mariana.demo@motogestor.demo", "Mariana Souza", "222.333.444-55", "(71) 98888-1002"],
    ["roberto.demo@motogestor.demo", "Roberto Lima", "333.444.555-66", "(71) 98888-1003"],
    ["aline.demo@motogestor.demo", "Aline Ferreira", "444.555.666-77", "(71) 98888-1004"],
    ["caio.demo@motogestor.demo", "Caio Martins", "555.666.777-88", "(71) 98888-1005"]
  ];

  const customers = [];
  for (const [email, fullName, cpf, phone] of customerData) {
    customers.push(
      await prisma.customer.create({
        data: {
          companyId: company.id,
          fullName,
          cpf,
          email,
          phone,
          whatsapp: phone,
          address: "Rua das Acacias",
          number: "120",
          district: "Pituba",
          city: "Salvador",
          state: "BA",
          zipCode: "41810-000",
          driverLicenseNumber: `CNH-${cpf.slice(0, 3)}`,
          driverLicenseCategory: "A",
          driverLicenseExpiration: addDaysUtc(new Date(), 250),
          emergencyContactName: "Contato familiar",
          emergencyContactPhone: "(71) 97777-0000",
          status: "ACTIVE"
        }
      })
    );
  }

  await prisma.user.create({
    data: {
      companyId: company.id,
      customerId: customers[0].id,
      name: customers[0].fullName,
      email: "cliente@motogestor.demo",
      passwordHash,
      role: "CUSTOMER",
      status: "ACTIVE"
    }
  });

  const motorcycles = [];
  const motorcycleData = [
    ["Honda", "CG 160 Fan", "MGP1A23", "Vermelha", 160, 18500, 13500],
    ["Yamaha", "Factor 150", "MGP2B34", "Preta", 150, 9200, 14200],
    ["Honda", "Biz 125", "MGP3C45", "Branca", 125, 21100, 11800],
    ["Yamaha", "Fazer 250", "MGP4D56", "Azul", 250, 6700, 21400],
    ["Honda", "NXR Bros 160", "MGP5E67", "Cinza", 160, 13400, 17600]
  ] as const;

  for (const [brand, model, plate, color, engineCapacity, mileage, value] of motorcycleData) {
    motorcycles.push(
      await prisma.motorcycle.create({
        data: {
          companyId: company.id,
          brand,
          model,
          manufactureYear: 2023,
          modelYear: 2024,
          plate,
          renavam: `RENAVAM-${plate}`,
          chassis: `CHASSI-${plate}`,
          color,
          engineCapacity,
          currentMileage: mileage,
          acquisitionValue: new Prisma.Decimal(value),
          acquisitionDate: addDaysUtc(new Date(), -300),
          photoUrl: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80",
          status: "AVAILABLE",
          notes: "Moto cadastrada pelo seed de demonstracao."
        }
      })
    );
  }

  const today = normalizeDateOnly(new Date());
  const lastThursday = previousOrSameWeekday(today, "THURSDAY");

  const mainContract = await createContractWithInstallments({
    companyId: company.id,
    userId: admin.id,
    customerId: customers[0].id,
    motorcycleId: motorcycles[0].id,
    code: "CTR-DEMO-0001",
    type: "RENT_TO_OWN",
    billingFrequency: "WEEKLY",
    firstDueDate: addDaysUtc(lastThursday, -77),
    weeklyDueDay: "THURSDAY",
    installmentAmount: 370,
    totalInstallments: 100,
    paidInstallments: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  });

  await createContractWithInstallments({
    companyId: company.id,
    userId: admin.id,
    customerId: customers[1].id,
    motorcycleId: motorcycles[1].id,
    code: "CTR-DEMO-0002",
    type: "RENTAL",
    billingFrequency: "MONTHLY",
    firstDueDate: addDaysUtc(today, -35),
    monthlyDueDay: 10,
    installmentAmount: 1150,
    totalInstallments: 12,
    paidInstallments: [1],
    partialInstallments: [{ number: 2, amount: 400 }]
  });

  await createContractWithInstallments({
    companyId: company.id,
    userId: admin.id,
    customerId: customers[2].id,
    motorcycleId: motorcycles[2].id,
    code: "CTR-DEMO-0003",
    type: "RENT_TO_OWN",
    billingFrequency: "BIWEEKLY",
    firstDueDate: addDaysUtc(today, -28),
    installmentAmount: 620,
    totalInstallments: 48,
    paidInstallments: [1, 2]
  });

  await prisma.maintenance.createMany({
    data: [
      {
        companyId: company.id,
        motorcycleId: motorcycles[3].id,
        type: "OIL_CHANGE",
        description: "Troca de oleo e filtro",
        date: addDaysUtc(today, 2),
        mileage: 6800,
        amount: new Prisma.Decimal(95),
        workshop: "Oficina Parceira",
        nextMaintenanceDate: addDaysUtc(today, 90),
        status: "SCHEDULED"
      },
      {
        companyId: company.id,
        motorcycleId: motorcycles[4].id,
        type: "BRAKES",
        description: "Revisao dos freios",
        date: addDaysUtc(today, -8),
        mileage: 13500,
        amount: new Prisma.Decimal(180),
        workshop: "Equipe interna",
        status: "COMPLETED"
      }
    ]
  });

  await prisma.document.createMany({
    data: [
      {
        companyId: company.id,
        customerId: customers[0].id,
        name: "CNH do cliente demo",
        type: "CNH",
        number: "CNH-111",
        issueDate: addDaysUtc(today, -600),
        expirationDate: addDaysUtc(today, 20),
        fileUrl: "https://example.com/documentos/cnh-cliente-demo.pdf",
        visibleToCustomer: true,
        status: "VALID"
      },
      {
        companyId: company.id,
        motorcycleId: motorcycles[0].id,
        name: "CRLV MGP1A23",
        type: "CRLV",
        number: "CRLV-001",
        issueDate: addDaysUtc(today, -120),
        expirationDate: addDaysUtc(today, 6),
        fileUrl: "https://example.com/documentos/crlv-mgp1a23.pdf",
        visibleToCustomer: true,
        status: "EXPIRING_SOON"
      },
      {
        companyId: company.id,
        contractId: mainContract.id,
        name: "Contrato assinado demo",
        type: "SIGNED_CONTRACT",
        issueDate: mainContract.startDate,
        fileUrl: "https://example.com/documentos/contrato-demo.pdf",
        visibleToCustomer: true,
        status: "VALID"
      }
    ]
  });

  const notification = await prisma.notification.create({
    data: {
      companyId: company.id,
      createdByUserId: admin.id,
      title: "Lembrete de vencimento",
      message: "Sua proxima parcela vence em breve. Procure a locadora em caso de duvidas.",
      type: "PAYMENT",
      priority: "HIGH",
      publishedAt: today,
      status: "PUBLISHED"
    }
  });

  await prisma.notificationRecipient.createMany({
    data: customers.map((customer) => ({
      notificationId: notification.id,
      customerId: customer.id
    }))
  });

  await prisma.auditLog.createMany({
    data: [
      {
        companyId: company.id,
        userId: admin.id,
        action: "SEED_COMPLETED",
        entity: "Company",
        entityId: company.id,
        description: "Dados de demonstracao criados pelo seed."
      },
      {
        companyId: company.id,
        userId: admin.id,
        action: "USER_CREATED",
        entity: "User",
        entityId: admin.id,
        description: "Administrador da empresa criado pelo seed."
      }
    ]
  });

  console.log("Seed finalizado.");
  console.log(`Superadmin: admin@motogestor.demo / ${demoPassword}`);
  console.log(`Gestor: gestor@motogestor.demo / ${demoPassword}`);
  console.log(`Cliente: cliente@motogestor.demo / ${demoPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
