import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import Flash from "@/components/admin/Flash";
import { getCurrentAdmin } from "@/lib/session";
import { listAllOrders } from "@/lib/db";
import { inr, shortDate } from "@/lib/format";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { notice } = await searchParams;
  const orders = await listAllOrders();

  return (
    <AdminShell active="orders" adminName={admin.name} adminRole={admin.role}>
      <Flash notice={notice} />
      <div className="adm-page-head">
        <div>
          <h1>Loans</h1>
          <p className="adm-lead">All loans and their repayment status.</p>
        </div>
        <Link href="/admin/loans/new" className="adm-btn adm-btn-primary">
          + New loan
        </Link>
      </div>

      <div className="adm-section">
        <h2>{orders.length} loans</h2>
        {orders.length === 0 ? (
          <div className="adm-empty">No loans yet.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Loan ID</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Borrowed</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Due date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="adm-mono">{o.id}</td>
                    <td>
                      <Link href={`/admin/customers/${o.customerId}`} className="adm-link">
                        {o.customerName ?? "—"}
                      </Link>
                    </td>
                    <td>{o.productName}</td>
                    <td>{inr(o.principal)}</td>
                    <td>{o.amountPaid ? inr(o.amountPaid) : "—"}</td>
                    <td>{o.amountDue > 0 ? inr(o.amountDue) : "—"}</td>
                    <td>
                      <span className={`adm-badge ${o.status}`}>{o.status}</span>
                    </td>
                    <td>{shortDate(o.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
