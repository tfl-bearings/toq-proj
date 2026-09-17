import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { getCurrentAdmin } from "@/lib/session";
import { getOrdersForCustomer, listCustomers } from "@/lib/db";
import { inr, shortDate } from "@/lib/format";

export default async function AdminCustomersPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const customers = await listCustomers();
  const ordersByCustomer = new Map(
    await Promise.all(
      customers.map(async (customer) => [
        customer.id,
        await getOrdersForCustomer(customer.id),
      ] as const),
    ),
  );

  return (
    <AdminShell active="customers" adminName={admin.name} adminRole={admin.role}>
      <h1>Customers</h1>
      <p className="adm-lead">Track customer status, activation, and linked applications.</p>

      <div className="adm-section">
        <h2>{customers.length} customers</h2>
        <div style={{ padding: 16 }}>
          <form action="/admin/customers" method="get" className="adm-search-row">
            <input name="q" placeholder="Search name, mobile, email, customer ID" />
            <button type="submit" className="adm-btn adm-btn-primary">Search</button>
          </form>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Mobile</th>
                <th>Status</th>
                <th>UPI</th>
                <th>Loans</th>
                <th>Outstanding</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const orders = ordersByCustomer.get(c.id) ?? [];
                const outstanding = orders
                  .filter((o) => o.status === "due" || o.status === "overdue")
                  .reduce((s, o) => s + o.amountDue, 0);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/customers/${c.id}`} className="adm-link">
                        {c.name}
                      </Link>
                      <div className="adm-micro">{c.customerCode ?? c.id}</div>
                    </td>
                    <td className="adm-mono">+91 {c.mobile}</td>
                    <td>
                      <span className={`adm-badge ${c.status ?? "pending"}`}>
                        {c.status ?? "pending"}
                      </span>
                    </td>
                    <td className="adm-mono">{c.upiId || "—"}</td>
                    <td>{orders.length}</td>
                    <td>{outstanding > 0 ? inr(outstanding) : "—"}</td>
                    <td>{shortDate(c.createdAt)}</td>
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
