import { ApiError } from "./api";
import type { PayTerm } from "./payTerms";

// Sample customers for the offline demo account (see authStore.ts). The demo has no server
// session, so CustomersPage reads and writes this in-memory list instead of calling /api/customers.
//
// The rows are the customer table of HopeDB_audit.sql, and `sales` is how many rows of the sales
// table point at each customer. Like the real server, a customer that still has sales cannot be
// deleted. Changes live in this browser tab only and are gone after a refresh.

export type DemoCustomer = {
  custNo: string;
  custName: string;
  address: string;
  payTerm: PayTerm;
  status: "Active" | "Inactive";
};

type Tab = "active" | "inactive" | "all";
type Values = { custName: string; address: string; payTerm: PayTerm };

/** The demo user is an admin, so it gets every customer right. */
export const DEMO_CUSTOMER_RIGHTS = [
  "CUSTOMER_ADD",
  "CUSTOMER_EDIT",
  "CUSTOMER_DELETE",
];

const NAME_MAX = 20;
const ADDRESS_MAX = 50;
const PAY_TERMS: PayTerm[] = ["COD", "30D", "45D"];

// [custNo, custName, address, payTerm, sales]
const SEED: [string, string, string, PayTerm, number][] = [
  [
    "C0001",
    "Globus Medical, Inc",
    "2560 Gen Armistead Ave Audubon CA 94031",
    "30D",
    3,
  ],
  [
    "C0002",
    "RF Industries, Inc",
    "7610 Miramar Rd San Diego, CA 92602",
    "45D",
    3,
  ],
  [
    "C0003",
    "Trisha Macdowell",
    "7642 Clairemont Mesa Blvd San Diego CA 90321",
    "COD",
    2,
  ],
  [
    "C0004",
    "HMS Holdings, Inc",
    "1000 So Fremont Ave, Suite 225 Alhambara CA 91303",
    "45D",
    2,
  ],
  [
    "C0005",
    "Christian Andersen",
    "1120 Lincoln St Suite 809 Sacramento CA 95815",
    "COD",
    2,
  ],
  ["C0006", "Astronics, Inc", "2 Orion Aliso Viejo, CA 92656", "30D", 2],
  ["C0007", "Morgan Alegore", "2 Goodyear Irvine, CA 92618", "COD", 3],
  ["C0008", "Abaxis, Inc", "3240 Whipple Rd, Union City, CA 94587", "30D", 2],
  ["C0009", "Landec Corp.", "3603 Haven Avenue Menlo Park, CA 94025", "30D", 3],
  ["C0010", "SMP Corp.", "3718 Northern Long Island NY 12528", "45D", 3],
  [
    "C0011",
    "B&G Foods",
    "4 Gatehall Dr., Ste. 110 Parsippany, NJ 07054",
    "45D",
    3,
  ],
  [
    "C0012",
    "Dexter Santos",
    "2739 Rebeiro Ave, Santa Clara, CA 95051",
    "COD",
    2,
  ],
  [
    "C0013",
    "Health Stream",
    "209 10th Ave, South Suite 450 Nashville Tennessee",
    "45D",
    3,
  ],
  ["C0014", "InSync Training LLC", "P.O. Box 3122 Roanoke, VA 24015", "30D", 2],
  [
    "C0015",
    "Bespoke Education",
    "8205 Santa Monica Blvd, Suite 365 W HWood CA 90046",
    "30D",
    1,
  ],
  ["C0016", "Peri Solutions", "2880 Zanker Road San Jose CA 95101", "30D", 2],
  [
    "C0017",
    "Janet Lim",
    "800 N. State College Blvd. Fullerton, CA 92831",
    "COD",
    1,
  ],
  ["C0018", "Nicole Hutchison", "200 Lincoln Ave, Salinas, CA 93901", "COD", 2],
  [
    "C0019",
    "Brandon Drucker",
    "65 West Alisal St., # 101, Salinas, CA 93901",
    "COD",
    1,
  ],
  [
    "C0020",
    "Eugene Whitaker",
    "45 Fremont Street, Suite 2000 San Frans, CA 9410",
    "COD",
    0,
  ],
  ["C0021", "Touch Suite", "1081 Holland Dr. Boca Raton, FL 33487", "30D", 2],
  [
    "C0022",
    "CallFire",
    "1410 2nd St., Suite 200 Santa Monica, CA 90401",
    "45D",
    3,
  ],
  [
    "C0023",
    "ISBX Corp",
    "3415 S. Sepulveda Blvd. 1250 Los Angeles, CA 90034",
    "30D",
    3,
  ],
  [
    "C0024",
    "Factual",
    "1999 Avenue of the Stars Los Angeles, CA 90067",
    "30D",
    1,
  ],
  [
    "C0025",
    "Predixion",
    "31910 Del Obispo San Juan Capistrano, CA 92675",
    "45D",
    1,
  ],
  [
    "C0026",
    "Datapop",
    "5762 W Jefferson Blvd, Los Angeles, CA 90016",
    "45D",
    3,
  ],
  [
    "C0027",
    "SA Photonics, Inc",
    "130 Knowles Dr, Los Gatos, CA 95032",
    "30D",
    2,
  ],
  [
    "C0028",
    "Acumen Bldg Entp",
    "7770 Pardee Lane, Ste. 200 Oakland, CA 94621",
    "30D",
    1,
  ],
  ["C0029", "IMCorp", "50 Utopia Road Manchester, CT 06042", "30D", 2],
  [
    "C0030",
    "Brady and Assoc.",
    "3710 Ruffin Rd, San Diego, CA 90401",
    "30D",
    1,
  ],
  ["C0031", "Yello Hammer LLC", "111 W 28th St, New York, NY 10001", "30D", 1],
  ["C0032", "Conductor", "2 Park Ave, New York, NY 10016", "30D", 2],
  [
    "C0033",
    "Quantum Networks",
    "323 West 39th Street 11th Flr NY 10018",
    "45D",
    2,
  ],
  ["C0034", "Refinery29", "225 Broadway NY 10007", "45D", 1],
  ["C0035", "Gravity Media", "104 W 27th St #11d NY 10001", "30D", 2],
  [
    "C0036",
    "Regal wings",
    "244 Fifth Avenue, Suite 200 New York, NY 10001",
    "45D",
    2,
  ],
  ["C0037", "33Across", "229 W 28th St, New York, NY 10001", "45D", 1],
  ["C0038", "RCS Capital", "405 Park Avenue New York, NY 1002", "30D", 1],
  [
    "C0039",
    "OnDeck",
    "1400 Broadway, 25th Floor, New York, NY 10001",
    "45D",
    1,
  ],
  [
    "C0040",
    "Optimatic Media, Inc",
    "54 West 40th St., 7th Floor, New York, NY 10018",
    "30D",
    2,
  ],
  [
    "C0041",
    "James Underwood",
    "450 West 33rd Street New York, NY 10018",
    "COD",
    1,
  ],
  [
    "C0042",
    "Charles Silverstone",
    "1335 Ave of the Americas, New York, NY 10019",
    "COD",
    1,
  ],
  ["C0043", "Nea Sanchez", "371 7th Ave, New York, NY 10001", "COD", 1],
  ["C0044", "Tracy Lambert", "234 W 42nd St, New York, NY 10036", "COD", 2],
  ["C0045", "Peter Charlestone", "342 W 40th St, New York, NY 10018", "COD", 2],
  ["C0046", "Oxford Academy", "5172 Orange Ave, Cypress, CA 90630", "45D", 1],
  [
    "C0047",
    "Whitney High Sch",
    "16800 Shoemaker Ave, Cerritos, CA 90703",
    "30D",
    1,
  ],
  [
    "C0048",
    "Pacfic Collegiate",
    "255 Swift St, Santa Cruz, CA 95060",
    "45D",
    1,
  ],
  [
    "C0049",
    "KIPP San Jose",
    "1790 Educational Park Dr, San Jose, CA 95133",
    "30D",
    1,
  ],
  [
    "C0050",
    "The Preuss School",
    "9500 Gilman Dr Mc 0536, La Jolla, CA 92093",
    "45D",
    2,
  ],
  [
    "C0051",
    "American Indian Sch",
    "3637 Magee Ave, Oakland, CA 94619",
    "30D",
    2,
  ],
  [
    "C0052",
    "Lowell High School",
    "1101 Eucalyptus Dr, San Francisco, CA 94132",
    "45D",
    2,
  ],
  [
    "C0053",
    "University HSchool",
    "2611 East Matoian M/S Uh134, Fresno, CA 93740",
    "30D",
    1,
  ],
  [
    "C0054",
    "Hawthorne Academy",
    "4467 West Broadway, Hawthorne, CA 90250",
    "30D",
    1,
  ],
  [
    "C0055",
    "Lennox Academy",
    "11036 Hawthorne Blvd, Lennox, CA 90304",
    "45D",
    2,
  ],
  [
    "C0056",
    "Manhasset School",
    "200 Memorial Place Manhasset, NY 11030",
    "45D",
    1,
  ],
  [
    "C0057",
    "Pittsford High Sch",
    "55 Sutherland St Pittsford, NY 14534",
    "30D",
    1,
  ],
  [
    "C0058",
    "Jericho High School",
    "99 Cedar Swamp Rd, Jericho, NY 11753",
    "45D",
    1,
  ],
  ["C0059", "Stuyvesant High", "345 Chambers St, New York, NY 10282", "45D", 1],
  ["C0060", "Rye High School", "Parsons St, Rye, NY 10580", "30D", 1],
  [
    "C0061",
    "Brooklyn High",
    "29 Ft Greene Place, Brooklyn, NY 11217",
    "45D",
    1,
  ],
  [
    "C0062",
    "Brooklyn Latin Sch",
    "325 Bushwick Ave, Brooklyn, NY 11206",
    "30D",
    1,
  ],
  ["C0063", "Bronx Science High", "75 West 205Th St Bronx, NY 10468", "45D", 1],
  [
    "C0064",
    "Staten Island High",
    "485 Clawson St, Staten Island, NY 10306",
    "30D",
    1,
  ],
  [
    "C0065",
    "Yonkers Middle High",
    "150 Rockland Ave, Yonkers, NY 10705",
    "45D",
    1,
  ],
  ["C0066", "Helen Strong", "800 S Main StTulelake, CA 96134", "COD", 1],
  ["C0067", "Gay Rose Silva", "575 3rd St Napa, CA 94559", "COD", 1],
  ["C0068", "William Pichler", "1121 L St #407 Sacramento, CA 95814", "COD", 1],
  [
    "C0069",
    "Terrance Nitz",
    "23200 Pacific Coast Hwy Malibu, CA 90265",
    "COD",
    1,
  ],
  [
    "C0070",
    "Errol Atanacio",
    "300 Capitol Mall #555 Sacramento, CA 95814",
    "COD",
    1,
  ],
  ["C0071", "Chuck Jones", "163 W 125th St New York, NY 10027", "COD", 1],
  [
    "C0072",
    "Menchu Palmores",
    "600 College Ave Montour Falls, NY 14865",
    "COD",
    1,
  ],
  [
    "C0073",
    "Princess Ann White",
    "109 S Union St #411 Rochester, NY 14607",
    "COD",
    1,
  ],
  ["C0074", "Florence Black", "450 S Salina St Syracuse, NY 13202", "COD", 1],
  ["C0075", "Jeremy Irons", "3357 US Highway 9w Highland, NY 12528", "COD", 1],
  ["C0076", "Braddy Banks", "1424 Fulton St Brooklyn, NY 11216", "COD", 1],
  [
    "C0077",
    "Office NY Tech Serv",
    "State Capitol Empire State Plaza NY 10027",
    "45D",
    1,
  ],
  ["C0078", "FDA New York", "158-15 Liberty Ave., Jamaica, NY 12528", "45D", 1],
  [
    "C0079",
    "Social Sec Admn NY",
    "123 William St, New York, NY 10038",
    "45D",
    1,
  ],
  [
    "C0080",
    "Social Sec Admn CA",
    "3836 Wilshire Blvd, Los Angeles, CA 90010",
    "45D",
    1,
  ],
  [
    "C0081",
    "Dept Food and Agri",
    "220 N Street Sacramento, CA 95814",
    "45D",
    1,
  ],
  [
    "C0082",
    "California Dept Tech",
    "1325 J St Suite 1600 Sacramento CA 95814",
    "45D",
    1,
  ],
];

let customers: DemoCustomer[] = SEED.map(
  ([custNo, custName, address, payTerm]) => ({
    custNo,
    custName,
    address,
    payTerm,
    status: "Active",
  }),
);
const salesCount = new Map<string, number>(
  SEED.map(([custNo, , , , sales]) => [custNo, sales]),
);

const find = (custNo: string) => {
  const customer = customers.find((c) => c.custNo === custNo);
  if (!customer) throw new ApiError("Customer not found", 404);
  return customer;
};

const formatNumber = (n: number) => `C${String(n).padStart(4, "0")}`;
const nextNumber = () =>
  Math.max(0, ...customers.map((c) => Number(c.custNo.slice(1)))) + 1;

// Same messages as backend/src/services/customer.service.js
function readValues(input: Values): Values {
  const errors: Record<string, string> = {};
  const text = (raw: string, field: string, label: string, max: number) => {
    const value = (raw ?? "").trim();
    if (!value) errors[field] = `${label} is required.`;
    else if (Array.from(value).length > max)
      errors[field] = `${label} can be at most ${max} characters.`;
    return value;
  };
  const custName = text(input.custName, "custName", "Customer name", NAME_MAX);
  const address = text(input.address, "address", "Address", ADDRESS_MAX);
  const payTerm = input.payTerm;
  if (!PAY_TERMS.includes(payTerm))
    errors.payTerm = `Pay terms must be one of: ${PAY_TERMS.join(", ")}.`;
  if (Object.keys(errors).length > 0)
    throw new ApiError("Please check the form.", 400, undefined, errors);
  return { custName, address, payTerm };
}

/** Same answer shape as GET /api/customers */
export function demoList({
  tab,
  query,
  page,
  pageSize,
}: {
  tab: Tab;
  query: string;
  page: number;
  pageSize: number;
}) {
  const term = query.trim().toLowerCase();
  const matches = term
    ? customers.filter((c) =>
        [c.custNo, c.custName, c.address].some((v) =>
          v.toLowerCase().includes(term),
        ),
      )
    : customers;
  const counts = {
    active: matches.filter((c) => c.status === "Active").length,
    inactive: matches.filter((c) => c.status === "Inactive").length,
    all: matches.length,
  };
  const shown = matches
    .filter(
      (c) =>
        tab === "all" ||
        c.status === (tab === "active" ? "Active" : "Inactive"),
    )
    .sort((a, b) => a.custNo.localeCompare(b.custNo));
  const start = (page - 1) * pageSize;
  return {
    ok: true as const,
    customers: shown.slice(start, start + pageSize).map((c) => ({ ...c })),
    total: shown.length,
    counts,
    page,
    pageSize,
  };
}

/** GET /api/customers/next-number */
export const demoNextNumber = () => ({
  ok: true as const,
  custNo: formatNumber(nextNumber()),
});

/** POST /api/customers */
export function demoCreate(input: Values) {
  const values = readValues(input);
  const customer: DemoCustomer = {
    custNo: formatNumber(nextNumber()),
    ...values,
    status: "Active",
  };
  customers = [...customers, customer];
  return customer;
}

/** PATCH /api/customers/:custNo */
export function demoUpdate(custNo: string, input: Values) {
  const values = readValues(input);
  const current = find(custNo);
  if (current.status === "Inactive")
    throw new ApiError(
      "This customer was deleted. Restore it before editing.",
      409,
    );
  Object.assign(current, values);
  customers = [...customers];
  return current;
}

/** DELETE /api/customers/:custNo (soft delete) */
export function demoRemove(custNo: string) {
  const current = find(custNo);
  if (current.status === "Inactive")
    throw new ApiError("This customer is already deleted.", 409);
  const sales = salesCount.get(custNo) ?? 0;
  if (sales > 0) {
    throw new ApiError(
      `${custNo} cannot be deleted: it still has ${sales} active sale${sales === 1 ? "" : "s"}.`,
      409,
    );
  }
  current.status = "Inactive";
  customers = [...customers];
  return current;
}

/** PATCH /api/customers/:custNo/restore */
export function demoRestore(custNo: string) {
  const current = find(custNo);
  if (current.status === "Active")
    throw new ApiError("This customer is not deleted.", 409);
  current.status = "Active";
  customers = [...customers];
  return current;
}
