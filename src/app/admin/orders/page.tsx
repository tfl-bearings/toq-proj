import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { getCurrentAdmin } from "@/lib/session";
import { getCustomerById, listAllOrders } from "@/lib/db";
import { inr, shortDate } from "@/lib/format";

export default async function AdminOrdersPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const orders = await listAllOrders();
  const customersById = new Map(
    (await Promise.all(orders.map((o) => getCustomerById(o.customerId))))
      .filter((customer): customer is NonNullable<typeof customer> => !!customer)
      .map((customer) => [customer.id, customer]),
  );

  return (
    <AdminShell active="orders" adminName={admin.name} adminRole={admin.role}>
      <Link href="/admin/loans/new" className="adm-newloan-link">
        + New loan
      </Link>
      <h1>Loans</h1>
      <p className="adm-lead">All loans and their repayment status.</p>

      <div className="adm-section">
        <h2>{orders.length} loans</h2>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Loan ID</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Borrowed</th>
                <th>Due</th>
                <th>Status</th>
                <th>Due date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const customer = customersById.get(o.customerId);
                return (
                  <tr key={o.id}>
                    <td className="adm-mono">{o.id}</td>
                    <td>{customer?.name ?? "—"}</td>
                    <td>{o.productName}</td>
                    <td>{inr(o.principal)}</td>
                    <td>{o.amountDue > 0 ? inr(o.amountDue) : "—"}</td>
                    <td>
                      <span className={`adm-badge ${o.status}`}>
                        {o.status}
                      </span>
                    </td>
                    <td>{shortDate(o.dueDate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
