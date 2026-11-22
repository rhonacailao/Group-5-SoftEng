import { api } from "./api";
import * as demoStore from "../lib/demoProducts";
import type {
  ListParams,
  ListResponse,
  PriceListResponse,
  PriceState,
} from "./products";
import type { Unit } from "./units";

// ===========================================================================
// API calls. `demo` picks the sample data (lib/demoProducts.ts) or the real server.
//
// Routes used (backend/src/routes/product.routes.js):
//   GET    /api/products?status=&search=&unit=&page=&pageSize=
//   POST   /api/products                          needs PRODUCT_ADD
//   PATCH  /api/products/:prodCode                needs PRODUCT_EDIT
//   DELETE /api/products/:prodCode                needs PRODUCT_DELETE (soft delete; refused with
//                                                 409 HAS_ACTIVE_CHILDREN while it has prices or sales)
//   PATCH  /api/products/:prodCode/restore        needs PRODUCT_DELETE
//   GET    /api/products/:prodCode/prices         -> { product, currentPrice, prices, total }
//   POST   /api/products/:prodCode/prices         { effectiveDate, unitPrice }   needs PRICE_ADD
//   PATCH  /api/products/:prodCode/prices/:effDate  { unitPrice }                needs PRICE_EDIT
//   DELETE /api/products/:prodCode/prices/:effDate                               needs PRICE_DELETE
//          (a price is REALLY removed: there is no soft delete and no restore for prices)
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

// A price row as the server sends it. The screen calls the date effDate, so it is renamed here.
type ServerPrice = {
  effectiveDate: string;
  unitPrice: number | string;
  state?: PriceState;
};

export const priceApi = {
  list: (demo: boolean, code: string) =>
    demo
      ? demoStore.later(() => demoStore.demoPriceList(code))
      : api<{ ok: true; prices: ServerPrice[] }>(
          `/api/products/${code}/prices`,
        ).then(
          (res): PriceListResponse => ({
            ok: true,
            prices: res.prices.map((p) => ({
              effDate: p.effectiveDate,
              unitPrice: p.unitPrice,
              state: p.state,
            })),
          }),
        ),
  add: (
    demo: boolean,
    code: string,
    body: { effDate: string; unitPrice: number },
  ) =>
    demo
      ? demoStore.later(() => demoStore.demoPriceAdd(code, body))
      : api(`/api/products/${code}/prices`, {
          body: { effectiveDate: body.effDate, unitPrice: body.unitPrice },
        }),
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
  /** Permanent: there is no restore for prices */
  remove: (demo: boolean, code: string, effDate: string) =>
    demo
      ? demoStore.later(() => demoStore.demoPriceRemove(code, effDate))
      : api(`/api/products/${code}/prices/${effDate}`, { method: "DELETE" }),
};
