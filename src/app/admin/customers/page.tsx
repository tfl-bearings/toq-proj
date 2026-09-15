import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { getCurrentAdmin } from "@/lib/session";
import { getOrdersForCustomer, listCustomers } from "@/lib/db";
import { inr, shortDate } from "@/lib/format";

export default async function AdminCustomersPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const customers = await listCustomers();

  return (
    <AdminShell active="customers" adminName={admin.name} adminRole={admin.role}>
      <h1>Customers</h1>
      <p className="adm-lead">Everyone registered on this app.</p>

      <div className="adm-section">
        <h2>{customers.length} customers</h2>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>Loans</th>
                <th>Outstanding</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const orders = await getOrdersForCustomer(c.id);
                const outstanding = orders
                  .filter((o) => o.status === "due" || o.status === "overdue")
                  .reduce((s, o) => s + o.amountDue, 0);
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="adm-mono">+91 {c.mobile}</td>
                    <td>{c.email || "—"}</td>
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
