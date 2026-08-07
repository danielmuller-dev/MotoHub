import { describe, expect, it } from "vitest";
import {
  appendFlashParam,
  buildContractInstallmentWhere,
  buildContractInstallmentsHref,
  getContractInstallmentPagination,
  parseContractInstallmentQuery
} from "../src/lib/contract-installments";

describe("contract installments listing", () => {
  it("calcula a primeira pagina com 5 parcelas por padrao", () => {
    const query = parseContractInstallmentQuery({});
    const pagination = getContractInstallmentPagination(query, 48);

    expect(pagination).toMatchObject({
      page: 1,
      pageSize: 5,
      totalItems: 48,
      totalPages: 10,
      skip: 0,
      take: 5,
      startItem: 1,
      endItem: 5
    });
  });

  it("monta link para a proxima pagina preservando filtros", () => {
    const query = parseContractInstallmentQuery({
      installmentPage: "1",
      installmentPageSize: "5",
      installmentStatus: "PENDING",
      installmentSearch: "12",
      installmentSort: "due-desc"
    });

    expect(buildContractInstallmentsHref("contract-1", query, { page: 2 })).toBe(
      "/contracts/contract-1?installmentPage=2&installmentPageSize=5&installmentStatus=PENDING&installmentSearch=12&installmentSort=due-desc"
    );
  });

  it("calcula a ultima pagina", () => {
    const query = parseContractInstallmentQuery({ installmentPage: "10" });
    const pagination = getContractInstallmentPagination(query, 48);

    expect(pagination.page).toBe(10);
    expect(pagination.startItem).toBe(46);
    expect(pagination.endItem).toBe(48);
  });

  it("altera a quantidade por pagina", () => {
    const query = parseContractInstallmentQuery({ installmentPageSize: "20" });
    const pagination = getContractInstallmentPagination(query, 48);

    expect(pagination.pageSize).toBe(20);
    expect(pagination.totalPages).toBe(3);
    expect(pagination.endItem).toBe(20);
  });

  it("aplica filtro por status", () => {
    const query = parseContractInstallmentQuery({ installmentStatus: "OVERDUE" });
    const where = buildContractInstallmentWhere({
      companyId: "company-1",
      contractId: "contract-1",
      query
    });

    expect(where.status).toBe("OVERDUE");
  });

  it("mantem companyId e contractId no filtro para isolar contrato de outra empresa", () => {
    const query = parseContractInstallmentQuery({});
    const where = buildContractInstallmentWhere({
      companyId: "company-1",
      contractId: "contract-1",
      query
    });

    expect(where).toMatchObject({
      companyId: "company-1",
      contractId: "contract-1"
    });
  });

  it("normaliza pagina invalida", () => {
    const invalidText = getContractInstallmentPagination(
      parseContractInstallmentQuery({ installmentPage: "abc" }),
      48
    );
    const beyondLast = getContractInstallmentPagination(
      parseContractInstallmentQuery({ installmentPage: "999" }),
      48
    );

    expect(invalidText.page).toBe(1);
    expect(beyondLast.page).toBe(10);
  });

  it("mantem a pagina atual apos registro de pagamento", () => {
    const query = parseContractInstallmentQuery({
      installmentPage: "3",
      installmentPageSize: "10",
      installmentStatus: "PARTIALLY_PAID",
      installmentSort: "status"
    });
    const returnTo = buildContractInstallmentsHref("contract-1", query);

    expect(appendFlashParam(returnTo, "success", "Pagamento registrado.")).toBe(
      "/contracts/contract-1?installmentPage=3&installmentPageSize=10&installmentStatus=PARTIALLY_PAID&installmentSort=status&success=Pagamento%20registrado."
    );
  });
});
