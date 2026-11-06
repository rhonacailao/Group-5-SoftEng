import { Link } from "react-router-dom";

// Figures are mock data modelled on the Hope, Inc. database
// (customer, product, sales / salesDetail, payment tables).
type Status = "Pending" | "Done" | "Overdue";

type Deliverable = {
  task: string;
  ref: string;
  relatedTo: string;
  due: string;
  status: Status;
};

const stats = [
  {
    label: "Total customers",
    value: "82",
    icon: "fa-users",
    note: "Registered accounts",
  },
  { label: "Products", value: "57", icon: "fa-box", note: "In the catalogue" },
  {
    label: "Open orders",
    value: "14",
    icon: "fa-clipboard-list",
    note: "Awaiting delivery or payment",
  },
  {
    label: "Revenue",
    value: new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(665326.58),
    icon: "fa-dollar-sign",
    note: "Payments received",
  },
];

const deliverables: Deliverable[] = [
  {
    task: "Ship order",
    ref: "TR000125",
    relatedTo: "Globus Medical, Inc",
    due: "Nov 3, 2026",
    status: "Overdue",
  },
  {
    task: "Collect 30-day payment",
    ref: "TR000119",
    relatedTo: "HMS Holdings, Inc",
    due: "Nov 4, 2026",
    status: "Overdue",
  },
  {
    task: "Deliver 12 items",
    ref: "TR000126",
    relatedTo: "Astronics, Inc",
    due: "Nov 7, 2026",
    status: "Pending",
  },
  {
    task: "Prepare invoice",
    ref: "TR000127",
    relatedTo: "RF Industries, Inc",
    due: "Nov 9, 2026",
    status: "Pending",
  },
  {
    task: "Restock Toshiba Canvio 1 TB",
    ref: "AD0001",
    relatedTo: "Warehouse",
    due: "Nov 10, 2026",
    status: "Pending",
  },
  {
    task: "Deliver order",
    ref: "TR000123",
    relatedTo: "Abaxis, Inc",
    due: "Nov 5, 2026",
    status: "Done",
  },
  {
    task: "Issue official receipt",
    ref: "OR000165",
    relatedTo: "Landec Corp.",
    due: "Nov 2, 2026",
    status: "Done",
  },
  {
    task: "Confirm COD delivery",
    ref: "TR000122",
    relatedTo: "Trisha Macdowell",
    due: "Nov 1, 2026",
    status: "Done",
  },
];

const quickActions = [
  {
    to: "/customers",
    label: "View customers",
    note: "Browse and review accounts",
    icon: "fa-users",
  },
  {
    to: "/products",
    label: "Manage products",
    note: "Update the catalogue and prices",
    icon: "fa-box",
  },
  {
    to: "/sales",
    label: "Sales pipeline",
    note: "Track orders and payments",
    icon: "fa-chart-line",
  },
];

const tagStyles: Record<Status, string> = {
  Pending: "border-blue-900 bg-blue-300 text-blue-800",
  Done: "border-green-900 bg-green-300 text-green-800",
  Overdue: "border-red-900 bg-red-300 text-red-800",
};

function StatusTag({ status }: { status: Status }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tagStyles[status]}`}
    >
      {status}
    </span>
  );
}

function DashboardPage() {
  const count = (s: Status) =>
    deliverables.filter((d) => d.status === s).length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <header>
        <h1 className="text-5xl font-bold leading-none">Dashboard</h1>
      </header>

      {/*----------Statistics----------*/}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          Key statistics
        </h2>
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, icon, note }) => (
            <div key={label} className="rounded-xl bg-paper p-6">
              <div className="flex items-center justify-between">
                <dt className="text-xl font-semibold text-dark-grey">
                  {label}
                </dt>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream text-2xl text-fire">
                  <i className={`fa-solid ${icon}`} aria-hidden="true" />
                </span>
              </div>
              <dd className="mt-2">
                <span className="block text-5xl font-bold leading-none">
                  {value}
                </span>
                <span className="mt-2 block text-sm text-dark-grey">
                  {note}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/*----------Quick actions----------*/}
      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="mb-4 text-2xl font-bold">
          Quick actions
        </h2>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {quickActions.map(({ to, label, note, icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex h-full items-center gap-4 rounded-xl bg-paper p-6 hover:bg-white"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-fire text-2xl text-white">
                  <i className={`fa-solid ${icon}`} aria-hidden="true" />
                </span>
                <span className="flex-1">
                  <span className="block text-lg font-bold">{label}</span>
                  <span className="block text-sm text-dark-grey">{note}</span>
                </span>
                <i
                  className="fa-solid fa-arrow-right text-fire"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/*----------Upcoming deliverables----------*/}
      <section
        aria-labelledby="deliverables-heading"
        className="rounded-xl bg-paper p-6"
      >
        <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="deliverables-heading" className="text-2xl font-bold">
            Upcoming deliverables
          </h2>
          <p className="text-sm text-dark-grey">
            {count("Overdue")} overdue &middot; {count("Pending")} pending
            &middot; {count("Done")} done
          </p>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">
              Deliverables with their due dates and status
            </caption>
            <thead>
              <tr className="border-b border-light-grey text-sm text-dark-grey">
                <th scope="col" className="px-2 py-2 font-semibold">
                  Deliverable
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Reference
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Related to
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Due
                </th>
                <th scope="col" className="px-2 py-2 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-light-grey">
              {deliverables.map((d) => (
                <tr key={`${d.ref}-${d.task}`}>
                  <td className="px-2 py-3 font-semibold">{d.task}</td>
                  <td className="px-2 py-3 text-dark-grey">{d.ref}</td>
                  <td className="px-2 py-3">{d.relatedTo}</td>
                  <td className="px-2 py-3">
                    <time>{d.due}</time>
                  </td>
                  <td className="px-2 py-3">
                    <StatusTag status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
