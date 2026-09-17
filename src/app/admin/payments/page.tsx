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

const REJECTION_REASONS = [
  "Invalid UTR",
  "Payment not received",
  "Incorrect payment method",
  "Invalid payment screenshot",
  "Incorrect amount",
  "Duplicate payment",
  "Other",
];

const PAY_LABEL: Record<PayApp, string> = {
  phonepe: "PhonePe",
  paytm: "Paytm",
  gpay: "GPay",
};

export default async function AdminPaymentsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const payments = await listPayments();
  const customersById = new Map(
    (await Promise.all(payments.map((p) => getCustomerById(p.customerId))))
      .filter((customer): customer is NonNullable<typeof customer> => !!customer)
      .map((customer) => [customer.id, customer]),
  );
  const ordersById = new Map(
    (await Promise.all(payments.map((p) => getOrder(p.orderId))))
      .filter((order): order is NonNullable<typeof order> => !!order)
      .map((order) => [order.id, order]),
  );
  const pending = payments.filter((p) => p.status === "review");
  const history = payments.filter((p) => p.status !== "review");
  const q = "";

  return (
    <AdminShell active="payments" adminName={admin.name} adminRole={admin.role}>
      <h1>Payment review</h1>
      <p className="adm-lead">
        Verify each UTR against your bank statement, then approve or reject.
        Nothing is auto-approved.
      </p>

      <div className="adm-section">
        <h2>Awaiting review ({pending.length})</h2>
        <div style={{ padding: 16 }}>
          <form action="/admin/payments" method="get" className="adm-search-row">
            <input name="q" placeholder="Search by customer, UTR, amount, status" />
            <button type="submit" className="adm-btn adm-btn-primary">Search</button>
          </form>
        </div>
        {pending.length === 0 ? (
          <div className="adm-empty">All caught up — no payments to review.</div>
        ) : (
          <div className="adm-review-list">
            {pending.map((p) => {
              const customer = customersById.get(p.customerId);
              const order = ordersById.get(p.orderId);
              return (
                <div className="adm-review-item" key={p.id}>
                  <div className="adm-review-head">
                    <b>{customer?.name ?? "Unknown customer"}</b>
                    <span className="adm-mono">{customer?.mobile ?? "—"}</span>
                    <span className="adm-review-when">{shortDate(p.createdAt)}</span>
                  </div>
                  <div className="adm-review-req">
                    {inr(p.amount)} · {PAY_LABEL[p.payApp]} · UTR <strong>{p.utr}</strong>
                  </div>
                  <div className="adm-review-req">
                    Order: <span className="adm-mono">{order?.productName ?? "—"}</span> · {order?.id ?? p.orderId}
                  </div>
                  {p.proofImage ? (
                    <div className="adm-proof-wrap">
                      <img src={p.proofImage} alt="Payment proof" className="adm-proof-image" />
                    </div>
                  ) : null}
                  <div className="adm-actions">
                    <form action={approvePaymentAction}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <button type="submit" className="adm-btn adm-btn-approve">Approve</button>
                    </form>
                    <details className="adm-reject-panel">
                      <summary className="adm-btn adm-btn-reject">Reject</summary>
                      <form action={rejectPaymentAction} className="adm-reject-form-column">
                        <input type="hidden" name="paymentId" value={p.id} />
                        <select name="rejectReason" defaultValue="Other">
                          {REJECTION_REASONS.map((reason) => (
                            <option key={reason} value={reason}>{reason}</option>
                          ))}
                        </select>
                        <input name="customReason" placeholder="Optional custom explanation" />
                        <button type="submit" className="adm-btn adm-btn-reject">Confirm reject</button>
                      </form>
                    </details>
                  </div>
                </div>
              );
            })}
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
                  const customer = customersById.get(p.customerId);
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
