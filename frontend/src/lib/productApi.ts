import { api } from "./api";
import * as demoStore from "./demoProducts";
import type {
  ListParams,
  ListResponse,
  PriceListResponse,
  Tab,
} from "./products";
import type { Unit } from "./units";

// ===========================================================================
// API calls. `demo` picks the sample data above or the real server.
//
// Back-end routes this screen expects. The first four exist today; the rest are the next stories
// (soft delete, restore, prices) and follow the same shape as the customer routes:
//   GET    /api/products?status=&search=&unit=&page=&pageSize=   (add currentPrice and stamp)
//   POST   /api/products          PATCH /api/products/:prodCode
//   DELETE /api/products/:prodCode            needs PRODUCT_DELETE
//   PATCH  /api/products/:prodCode/restore    needs PRODUCT_DELETE
//   GET    /api/products/:prodCode/prices?status=      -> { ok, prices, counts }
//   POST   /api/products/:prodCode/prices      { effDate, unitPrice }          needs PRICE_ADD
//   PATCH  /api/products/:prodCode/prices/:effDate   { unitPrice }             needs PRICE_EDIT
//   DELETE /api/products/:prodCode/prices/:effDate                             needs PRICE_DELETE
//   PATCH  /api/products/:prodCode/prices/:effDate/restore                     needs PRICE_DELETE
// ===========================================================================

export const productApi = {
  list: (demo: boolean, p: ListParams) => {
    if (demo) return demoStore.later(() => demoStore.demoProductList(p));
    const params = new URLSearchParams({
      status: p.status,
      page: String(p.page),
      pageSize: String(p.pageSize),
    });
    if (p.search.trim()) params.set("search", p.search.trim());
    if (p.unit) params.set("unit", p.unit);
    // S2-DEV-08: the server sends currentPrice as { unitPrice, effectiveDate } (or null); the
    // table only needs the amount, so it is flattened to a number here.
    return api<ListResponse>(`/api/products?${params}`).then((res) => ({
      ...res,
      products: res.products.map((p) => {
        const price: unknown = p.currentPrice;
        const amount =
          price !== null && typeof price === "object" && "unitPrice" in price
            ? (price as { unitPrice: number }).unitPrice
            : (p.currentPrice ?? null);
        return { ...p, currentPrice: amount };
      }),
    }));
  },
  create: (
    demo: boolean,
    body: { prodCode: string; description: string; unit: Unit },
  ) =>
    demo
      ? demoStore.later(() => demoStore.demoProductCreate(body))
      : api("/api/products", { body }),
  update: (
    demo: boolean,
    code: string,
    body: { description: string; unit: Unit },
  ) =>
    demo
      ? demoStore.later(() => demoStore.demoProductUpdate(code, body))
      : api(`/api/products/${code}`, { method: "PATCH", body }),
  remove: (demo: boolean, code: string) =>
    demo
      ? demoStore.later(() => demoStore.demoProductSetStatus(code, "Inactive"))
      : api(`/api/products/${code}`, { method: "DELETE" }),
  restore: (demo: boolean, code: string) =>
    demo
      ? demoStore.later(() => demoStore.demoProductSetStatus(code, "Active"))
      : api(`/api/products/${code}/restore`, { method: "PATCH" }),
};

export const priceApi = {
  list: (demo: boolean, code: string, status: Tab) =>
    demo
      ? demoStore.later(() => demoStore.demoPriceList(code, status))
      : api<PriceListResponse>(`/api/products/${code}/prices?status=${status}`),
  add: (
    demo: boolean,
    code: string,
    body: { effDate: string; unitPrice: number },
  ) =>
    demo
      ? demoStore.later(() => demoStore.demoPriceAdd(code, body))
      : api(`/api/products/${code}/prices`, { body }),
  update: (
    demo: boolean,
    code: string,
    effDate: string,
    body: { unitPrice: number },
  ) =>
    demo
      ? demoStore.later(() => demoStore.demoPriceUpdate(code, effDate, body))
      : api(`/api/products/${code}/prices/${effDate}`, {
          method: "PATCH",
          body,
        }),
  remove: (demo: boolean, code: string, effDate: string) =>
    demo
      ? demoStore.later(() =>
          demoStore.demoPriceSetStatus(code, effDate, "Inactive"),
        )
      : api(`/api/products/${code}/prices/${effDate}`, { method: "DELETE" }),
  restore: (demo: boolean, code: string, effDate: string) =>
    demo
      ? demoStore.later(() =>
          demoStore.demoPriceSetStatus(code, effDate, "Active"),
        )
      : api(`/api/products/${code}/prices/${effDate}/restore`, {
          method: "PATCH",
        }),
};
