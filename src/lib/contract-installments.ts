import type { InstallmentStatus, Prisma } from "@prisma/client";

export const contractInstallmentPageSizes = [5, 10, 20] as const;
export const contractInstallmentStatuses: InstallmentStatus[] = [
  "PENDING",
  "OVERDUE",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED"
];

export const contractInstallmentSorts = [
  "number-asc",
  "number-desc",
  "due-asc",
  "due-desc",
  "status"
] as const;

export type ContractInstallmentSort = (typeof contractInstallmentSorts)[number];

export type ContractInstallmentQuery = {
  page: number;
  pageSize: (typeof contractInstallmentPageSizes)[number];
  status?: InstallmentStatus;
  search: string;
  sort: ContractInstallmentSort;
};

export type ContractInstallmentPagination = {
  page: number;
  pageSize: ContractInstallmentQuery["pageSize"];
  totalItems: number;
  totalPages: number;
  skip: number;
  take: number;
  startItem: number;
  endItem: number;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  const parsed = Number.parseInt(firstParam(value) ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseContractInstallmentQuery(
  params: Record<string, string | string[] | undefined>
): ContractInstallmentQuery {
  const requestedPageSize = parsePositiveInt(params.installmentPageSize, 5);
  const pageSize = contractInstallmentPageSizes.includes(
    requestedPageSize as ContractInstallmentQuery["pageSize"]
  )
    ? (requestedPageSize as ContractInstallmentQuery["pageSize"])
    : 5;
  const requestedStatus = firstParam(params.installmentStatus) as InstallmentStatus | undefined;
  const requestedSort = firstParam(params.installmentSort) as ContractInstallmentSort | undefined;

  return {
    page: parsePositiveInt(params.installmentPage, 1),
    pageSize,
    status: requestedStatus && contractInstallmentStatuses.includes(requestedStatus)
      ? requestedStatus
      : undefined,
    search: (firstParam(params.installmentSearch) ?? "").trim(),
    sort: requestedSort && contractInstallmentSorts.includes(requestedSort)
      ? requestedSort
      : "number-asc"
  };
}

export function getContractInstallmentPagination(
  query: ContractInstallmentQuery,
  totalItems: number
): ContractInstallmentPagination {
  const totalPages = Math.max(Math.ceil(totalItems / query.pageSize), 1);
  const page = Math.min(Math.max(query.page, 1), totalPages);
  const skip = (page - 1) * query.pageSize;
  const startItem = totalItems === 0 ? 0 : skip + 1;
  const endItem = Math.min(skip + query.pageSize, totalItems);

  return {
    page,
    pageSize: query.pageSize,
    totalItems,
    totalPages,
    skip,
    take: query.pageSize,
    startItem,
    endItem
  };
}

function parseDateSearch(value: string) {
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  const parts = isoMatch
    ? [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])]
    : brMatch
      ? [Number(brMatch[3]), Number(brMatch[2]), Number(brMatch[1])]
      : null;

  if (!parts) {
    return null;
  }

  const [year, month, day] = parts;
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));

  return { start, end };
}

export function buildContractInstallmentWhere(input: {
  companyId: string;
  contractId: string;
  query: Pick<ContractInstallmentQuery, "status" | "search">;
}): Prisma.InstallmentWhereInput {
  const where: Prisma.InstallmentWhereInput = {
    companyId: input.companyId,
    contractId: input.contractId
  };

  if (input.query.status) {
    where.status = input.query.status;
  }

  const search = input.query.search.trim();
  if (!search) {
    return where;
  }

  const searchClauses: Prisma.InstallmentWhereInput[] = [];
  if (/^\d+$/.test(search)) {
    searchClauses.push({ number: Number.parseInt(search, 10) });
  }

  const dateSearch = parseDateSearch(search);
  if (dateSearch) {
    searchClauses.push({
      dueDate: {
        gte: dateSearch.start,
        lt: dateSearch.end
      }
    });
  }

  if (searchClauses.length) {
    where.OR = searchClauses;
  } else {
    where.id = "__no_installment_match__";
  }

  return where;
}

export function getContractInstallmentOrderBy(
  sort: ContractInstallmentSort
): Prisma.InstallmentOrderByWithRelationInput[] {
  if (sort === "number-desc") {
    return [{ number: "desc" }];
  }
  if (sort === "due-asc") {
    return [{ dueDate: "asc" }, { number: "asc" }];
  }
  if (sort === "due-desc") {
    return [{ dueDate: "desc" }, { number: "desc" }];
  }
  if (sort === "status") {
    return [{ status: "asc" }, { number: "asc" }];
  }
  return [{ number: "asc" }];
}

export function getVisiblePageNumbers(currentPage: number, totalPages: number, maxVisible = 5) {
  const safeMax = Math.max(maxVisible, 1);
  const half = Math.floor(safeMax / 2);
  let start = Math.max(currentPage - half, 1);
  const end = Math.min(start + safeMax - 1, totalPages);

  start = Math.max(Math.min(start, Math.max(end - safeMax + 1, 1)), 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function buildContractInstallmentsHref(
  contractId: string,
  query: ContractInstallmentQuery,
  overrides: Partial<ContractInstallmentQuery> = {}
) {
  const nextQuery = { ...query, ...overrides };
  const params = new URLSearchParams();

  params.set("installmentPage", String(nextQuery.page));
  params.set("installmentPageSize", String(nextQuery.pageSize));
  if (nextQuery.status) {
    params.set("installmentStatus", nextQuery.status);
  }
  if (nextQuery.search) {
    params.set("installmentSearch", nextQuery.search);
  }
  if (nextQuery.sort !== "number-asc") {
    params.set("installmentSort", nextQuery.sort);
  }

  return `/contracts/${contractId}?${params.toString()}`;
}

export function appendFlashParam(path: string, key: "success" | "error", message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(message)}`;
}
