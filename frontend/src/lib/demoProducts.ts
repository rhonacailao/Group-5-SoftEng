import { ApiError } from "./api";
import {
  ALL_PRODUCT_RIGHTS,
  currentEffDate,
  today,
  type ApiPrice,
  type ApiProduct,
  type Counts,
  type ListParams,
  type ListResponse,
  type PriceListResponse,
  type Status,
  type Tab,
} from "./products";
import type { Role } from "./roles";
import type { Unit } from "./units";

// ===========================================================================
// Demo data: the demo account has no server, so it runs on the sample rows below (the same
// rows as the Student Guide screenshots). Changes live in this browser tab and reset on refresh.
// Every demo function throws the same ApiError the server would, so the screens cannot tell them apart.
// ===========================================================================

export type DemoPrice = ApiPrice & { prodCode: string };

export const demoProducts: ApiProduct[] = [
  {
    prodCode: "IW0001",
    description: "Industrial Widget A",
    unit: "pc",
    status: "Active",
    stamp: "CREATED system 2026-10-01 9:00 AM",
  },
  {
    prodCode: "SB0002",
    description: "Steel Bracket Heavy",
    unit: "pc",
    status: "Active",
    stamp: "CREATED system 2026-10-02 10:00 AM",
  },
  {
    prodCode: "LO0003",
    description: "Lubricant Oil 5L",
    unit: "ltr",
    status: "Active",
    stamp: "EDITED user1 2026-10-13 1:01 PM",
  },
  {
    prodCode: "SG0004",
    description: "Safety Gloves XL",
    unit: "pkg",
    status: "Inactive",
    stamp: "DELETED user2 2026-10-13 1:01 PM",
  },
  {
    prodCode: "CW0005",
    description: "Copper Wire 2.5mm",
    unit: "mtr",
    status: "Active",
    stamp: "CREATED system 2026-10-05 3:00 PM",
  },
];

export const demoPrices: DemoPrice[] = [
  {
    prodCode: "IW0001",
    effDate: "2025-01-01",
    unitPrice: 11,
    status: "Inactive",
    stamp: "DELETED user2 2026-10-13 1:01 PM",
  },
  {
    prodCode: "IW0001",
    effDate: "2025-06-01",
    unitPrice: 12.5,
    status: "Active",
    stamp: "CREATED system 2025-06-01 9:00 AM",
  },
  {
    prodCode: "IW0001",
    effDate: "2026-01-01",
    unitPrice: 13.75,
    status: "Active",
    stamp: "CREATED system 2026-01-01 9:00 AM",
  },
  {
    prodCode: "IW0001",
    effDate: "2027-01-01",
    unitPrice: 14.5,
    status: "Active",
    stamp: "CREATED user1 2026-10-20 2:15 PM",
  },
  {
    prodCode: "SB0002",
    effDate: "2026-01-01",
    unitPrice: 48.5,
    status: "Active",
    stamp: "CREATED system 2026-10-02 10:00 AM",
  },
  {
    prodCode: "LO0003",
    effDate: "2026-02-01",
    unitPrice: 28,
    status: "Active",
    stamp: "CREATED system 2026-02-01 10:00 AM",
  },
  {
    prodCode: "CW0005",
    effDate: "2026-01-01",
    unitPrice: 2.35,
    status: "Active",
    stamp: "CREATED system 2026-10-05 3:00 PM",
  },
];

// What each previewed role is granted in the demo (a User gets no Delete rights, so you can see them hidden)
export const DEMO_RIGHTS: Record<Role, string[]> = {
  user: ["PRODUCT_ADD", "PRODUCT_EDIT", "PRICE_ADD", "PRICE_EDIT"],
  admin: ALL_PRODUCT_RIGHTS,
  superadmin: ALL_PRODUCT_RIGHTS,
};

export const later = <T>(fn: () => T) =>
  new Promise<T>((resolve, reject) => {
    try {
      resolve(fn());
    } catch (err) {
      reject(err);
    }
  });

export const demoFail = (
  message: string,
  status = 409,
  errors?: Record<string, string>,
): never => {
  throw new ApiError(message, status, undefined, errors);
};

export const demoStamp = (action: string) =>
  `${action} demo ${today()} ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;

export const demoCurrentPrice = (prodCode: string) => {
  const own = demoPrices.filter((p) => p.prodCode === prodCode);
  const eff = currentEffDate(own);
  return eff ? own.find((p) => p.effDate === eff)!.unitPrice : null;
};

export const demoFindProduct = (prodCode: string) =>
  demoProducts.find((p) => p.prodCode === prodCode) ??
  demoFail("Product not found", 404);

export const demoCounts = (rows: { status: Status }[]): Counts => ({
  active: rows.filter((r) => r.status === "Active").length,
  inactive: rows.filter((r) => r.status === "Inactive").length,
  all: rows.length,
});

export const demoProductList = ({
  status,
  search,
  unit,
  page,
  pageSize,
}: ListParams): ListResponse => {
  const q = search.trim().toLowerCase();
  const matching = demoProducts
    .filter(
      (p) =>
        !q ||
        p.prodCode.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    )
    .filter((p) => !unit || p.unit === unit)
    .sort((a, b) => a.prodCode.localeCompare(b.prodCode));
  const shown = matching.filter(
    (p) =>
      status === "all" ||
      p.status === (status === "active" ? "Active" : "Inactive"),
  );
  const start = (page - 1) * pageSize;
  return {
    ok: true,
    products: shown
      .slice(start, start + pageSize)
      .map((p) => ({ ...p, currentPrice: demoCurrentPrice(p.prodCode) })),
    total: shown.length,
    counts: demoCounts(matching),
    page,
    pageSize,
  };
};

export const demoProductCreate = (body: {
  prodCode: string;
  description: string;
  unit: Unit;
}) => {
  if (demoProducts.some((p) => p.prodCode === body.prodCode)) {
    const message = `Product code ${body.prodCode} is already used (a deleted product keeps its code).`;
    demoFail(message, 409, { prodCode: message });
  }
  demoProducts.push({ ...body, status: "Active", stamp: demoStamp("CREATED") });
};

export const demoProductUpdate = (
  prodCode: string,
  body: { description: string; unit: Unit },
) => {
  const p = demoFindProduct(prodCode);
  if (p.status === "Inactive")
    demoFail("This product was deleted. Restore it before editing.");
  Object.assign(p, body, { stamp: demoStamp("EDITED") });
};

export const demoProductSetStatus = (prodCode: string, status: Status) => {
  const p = demoFindProduct(prodCode);
  p.status = status;
  p.stamp = demoStamp(status === "Inactive" ? "DELETED" : "RESTORED");
};

export const demoActiveProduct = (prodCode: string) => {
  const p = demoFindProduct(prodCode);
  if (p.status === "Inactive")
    demoFail(
      "This product was deleted. Restore it before changing its prices.",
    );
};

export const demoPriceList = (
  prodCode: string,
  status: Tab,
): PriceListResponse => {
  const own = demoPrices
    .filter((p) => p.prodCode === prodCode)
    .sort((a, b) => b.effDate.localeCompare(a.effDate));
  const shown = own.filter(
    (p) =>
      status === "all" ||
      p.status === (status === "active" ? "Active" : "Inactive"),
  );
  return {
    ok: true,
    prices: shown.map((p) => ({
      effDate: p.effDate,
      unitPrice: p.unitPrice,
      status: p.status,
      stamp: p.stamp,
    })),
    counts: demoCounts(own),
  };
};

export const demoFindPrice = (prodCode: string, effDate: string) =>
  demoPrices.find((p) => p.prodCode === prodCode && p.effDate === effDate) ??
  demoFail("Price not found", 404);

export const demoPriceAdd = (
  prodCode: string,
  body: { effDate: string; unitPrice: number },
) => {
  demoActiveProduct(prodCode);
  if (
    demoPrices.some(
      (p) => p.prodCode === prodCode && p.effDate === body.effDate,
    )
  ) {
    const message = `This product already has a price effective ${body.effDate} (a deleted price keeps its date).`;
    demoFail(message, 409, { effDate: message });
  }
  demoPrices.push({
    prodCode,
    ...body,
    status: "Active",
    stamp: demoStamp("CREATED"),
  });
};

export const demoPriceUpdate = (
  prodCode: string,
  effDate: string,
  body: { unitPrice: number },
) => {
  demoActiveProduct(prodCode);
  const p = demoFindPrice(prodCode, effDate);
  if (p.status === "Inactive")
    demoFail("This price was deleted. Restore it before editing.");
  Object.assign(p, body, { stamp: demoStamp("EDITED") });
};

export const demoPriceSetStatus = (
  prodCode: string,
  effDate: string,
  status: Status,
) => {
  demoActiveProduct(prodCode);
  const p = demoFindPrice(prodCode, effDate);
  p.status = status;
  p.stamp = demoStamp(status === "Inactive" ? "DELETED" : "RESTORED");
};
