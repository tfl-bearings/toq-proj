import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { getCurrentAdmin } from "@/lib/session";
import { getCustomerById, getProducts, listApplications } from "@/lib/db";
import { inr, shortDate } from "@/lib/format";
import {
  approveApplicationAction,
  rejectApplicationAction,
} from "@/app/admin/actions";

export default async function AdminApplicationsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const applications = listApplications();
  const pending = applications.filter((a) => a.status === "pending");
  const history = applications.filter((a) => a.status !== "pending");
  const products = getProducts();

  return (
    <AdminShell
      active="applications"
      adminName={admin.name}
      adminRole={admin.role}
    >
      <h1>Loan applications</h1>
      <p className="adm-lead">
        Review each request, adjust the product / amount / tenure if needed,
        then approve to create the loan — or reject with a reason.
      </p>

      <div className="adm-section">
        <h2>Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="adm-empty">No applications waiting.</div>
        ) : (
          pending.map((a) => {
            const customer = getCustomerById(a.customerId);
            return (
              <div className="adm-review-item" key={a.id}>
                <div className="adm-review-head">
                  <b>{customer?.name ?? "—"}</b>{" "}
                  <span className="adm-mono">+91 {customer?.mobile}</span>
                  <span className="adm-review-when">
                    applied {shortDate(a.createdAt)}
                  </span>
                </div>
                <div className="adm-review-req">
                  Requested <strong>{inr(a.amount)}</strong> ·{" "}
                  {a.productName} · {a.tenureMonths} months
                  {a.purpose ? ` · “${a.purpose}”` : ""}
                </div>

                <form action={approveApplicationAction} className="adm-approve-form">
                  <input type="hidden" name="applicationId" value={a.id} />
                  <label className="adm-mini-field">
                    Product
                    <select name="productId" defaultValue={a.productId}>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.rateMonthly}%/mo)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="adm-mini-field">
                    Amount (₹)
                    <input
                      type="number"
                      name="amount"
                      defaultValue={a.amount}
                      min={1}
                      step={500}
                    />
                  </label>
                  <label className="adm-mini-field">
                    Tenure (mo)
                    <input
                      type="number"
                      name="tenureMonths"
                      defaultValue={a.tenureMonths}
                      min={1}
                      max={60}
                    />
                  </label>
                  <button type="submit" className="adm-btn adm-btn-approve">
                    Approve &amp; create loan
                  </button>
                </form>

                <form action={rejectApplicationAction} className="adm-reject-form">
                  <input type="hidden" name="applicationId" value={a.id} />
                  <input name="reason" placeholder="Reason for rejection" />
                  <button type="submit" className="adm-btn adm-btn-reject">
                    Reject
                  </button>
                </form>
              </div>
            );
          })
        )}
      </div>

      <div className="adm-section">
        <h2>Decided</h2>
        {history.length === 0 ? (
          <div className="adm-empty">No decisions yet.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Result</th>
                  <th>Loan</th>
                  <th>By</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a) => {
                  const customer = getCustomerById(a.customerId);
                  return (
                    <tr key={a.id}>
                      <td>{customer?.name ?? "—"}</td>
                      <td>{a.productName}</td>
                      <td>{inr(a.amount)}</td>
                      <td>
                        <span className={`adm-badge ${a.status}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="adm-mono">{a.orderId ?? "—"}</td>
                      <td>{a.reviewedByName ?? "—"}</td>
                      <td className="wrap">{a.reason ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
