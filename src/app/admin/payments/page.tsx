import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { getCurrentAdmin } from "@/lib/session";
import { getCustomerById, getOrder, listPayments } from "@/lib/db";
import { inr, shortDate } from "@/lib/format";
import {
  approvePaymentAction,
  rejectPaymentAction,
} from "@/app/admin/actions";
import type { PayApp } from "@/lib/types";

const PAY_LABEL: Record<PayApp, string> = {
  phonepe: "PhonePe",
  paytm: "Paytm",
  gpay: "GPay",
};

export default async function AdminPaymentsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const payments = listPayments();
  const pending = payments.filter((p) => p.status === "review");
  const history = payments.filter((p) => p.status !== "review");

  return (
    <AdminShell active="payments" adminName={admin.name} adminRole={admin.role}>
      <h1>Payment review</h1>
      <p className="adm-lead">
        Verify each UTR against your bank statement, then approve or reject.
        Nothing is auto-approved.
      </p>

      <div className="adm-section">
        <h2>Awaiting review ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="adm-empty">All caught up — no payments to review.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Loan</th>
                  <th>Amount</th>
                  <th>UTR</th>
                  <th>Via</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => {
                  const customer = getCustomerById(p.customerId);
                  const order = getOrder(p.orderId);
                  return (
                    <tr key={p.id}>
                      <td>
                        {customer?.name ?? "—"}
                        <br />
                        <span className="adm-mono">{customer?.mobile}</span>
                      </td>
                      <td>
                        {order?.productName ?? "—"}
                        <br />
                        <span className="adm-mono">{p.orderId}</span>
                      </td>
                      <td>{inr(p.amount)}</td>
                      <td className="adm-mono">{p.utr}</td>
                      <td>{PAY_LABEL[p.payApp]}</td>
                      <td>{shortDate(p.createdAt)}</td>
                      <td>
                        <div className="adm-actions">
                          <form action={approvePaymentAction}>
                            <input type="hidden" name="paymentId" value={p.id} />
                            <button
                              type="submit"
                              className="adm-btn adm-btn-approve"
                            >
                              Approve
                            </button>
                          </form>
                          <form
                            action={rejectPaymentAction}
                            className="adm-reject-form"
                          >
                            <input type="hidden" name="paymentId" value={p.id} />
                            <input
                              name="reason"
                              placeholder="Reason (optional)"
                            />
                            <button
                              type="submit"
                              className="adm-btn adm-btn-reject"
                            >
                              Reject
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="adm-section">
        <h2>Recently reviewed</h2>
        {history.length === 0 ? (
          <div className="adm-empty">No decisions yet.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>UTR</th>
                  <th>Result</th>
                  <th>By</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => {
                  const customer = getCustomerById(p.customerId);
                  return (
                    <tr key={p.id}>
                      <td>{customer?.name ?? "—"}</td>
                      <td>{inr(p.amount)}</td>
                      <td className="adm-mono">{p.utr}</td>
                      <td>
                        <span className={`adm-badge ${p.status}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>{p.reviewedByName ?? "—"}</td>
                      <td className="wrap">{p.reason ?? "—"}</td>
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
