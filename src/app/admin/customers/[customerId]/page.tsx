import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { getCurrentAdmin } from "@/lib/session";
import {
  getCustomerById,
  getOrdersForCustomer,
  listAuditLogs,
  listPaymentsForCustomer,
} from "@/lib/db";
import { inr, shortDate } from "@/lib/format";
import {
  deactivateCustomerAction,
  generateCustomerInviteAction,
  updateCustomerAdminAction,
} from "@/app/admin/actions";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { customerId } = await params;
  const customer = await getCustomerById(customerId);
  if (!customer) redirect("/admin/customers");

  const orders = await getOrdersForCustomer(customer.id);
  const payments = await listPaymentsForCustomer(customer.id);
  const auditLogs = (await listAuditLogs(20)).filter((log) => log.customerId === customer.id);

  return (
    <AdminShell active="customers" adminName={admin.name} adminRole={admin.role}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1>{customer.name}</h1>
          <p className="adm-lead">Customer ID: {customer.customerCode ?? customer.id}</p>
        </div>
        <div className="adm-actions">
          <form action={generateCustomerInviteAction}>
            <input type="hidden" name="customerId" value={customer.id} />
            <button type="submit" className="adm-btn adm-btn-primary">Generate access link</button>
          </form>
          <form action={deactivateCustomerAction}>
            <input type="hidden" name="customerId" value={customer.id} />
            <button type="submit" className="adm-btn adm-btn-reject">Deactivate</button>
          </form>
        </div>
      </div>

      <div className="adm-section">
        <h2>Customer information</h2>
        <form action={updateCustomerAdminAction} className="adm-form-grid">
          <input type="hidden" name="customerId" value={customer.id} />
          <label className="adm-field">
            Customer name
            <input name="name" defaultValue={customer.name} required />
          </label>
          <label className="adm-field">
            Mobile
            <input name="mobile" defaultValue={customer.mobile} required />
          </label>
          <label className="adm-field">
            Email
            <input name="email" defaultValue={customer.email ?? ""} />
          </label>
          <label className="adm-field">
            Payment method
            <select name="paymentMethod" defaultValue={customer.paymentMethod ?? "UPI"}>
              <option value="UPI">UPI</option>
              <option value="Bank transfer">Bank transfer</option>
              <option value="Cash">Cash</option>
            </select>
          </label>
          <label className="adm-field">
            UPI ID
            <input name="upiId" defaultValue={customer.upiId ?? ""} />
          </label>
          <label className="adm-field">
            Status
            <select name="status" defaultValue={customer.status ?? "pending"}>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <div className="adm-form-foot">
            <button type="submit" className="adm-btn adm-btn-primary">Save customer</button>
          </div>
        </form>
      </div>

      <div className="adm-section">
        <h2>Access link</h2>
        <div style={{ padding: 16 }}>
          <div className="adm-field">
            <input value={customer.inviteLink ?? "Not generated yet"} readOnly />
          </div>
          {customer.inviteLink ? (
            <Link href={customer.inviteLink} className="adm-btn adm-btn-primary">Open link</Link>
          ) : null}
        </div>
      </div>

      <div className="adm-section">
        <h2>Payment history</h2>
        {payments.length === 0 ? (
          <div className="adm-empty">No payments recorded for this customer.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>UTR</th>
                  <th>Status</th>
                  <th>Method</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{shortDate(payment.createdAt)}</td>
                    <td>{inr(payment.amount)}</td>
                    <td className="adm-mono">{payment.utr}</td>
                    <td><span className={`adm-badge ${payment.status}`}>{payment.status}</span></td>
                    <td>{payment.payApp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="adm-section">
        <h2>Applications / loans</h2>
        {orders.length === 0 ? (
          <div className="adm-empty">No loan records yet.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="adm-mono">{order.id}</td>
                    <td>{order.productName}</td>
                    <td>{inr(order.amountDue)}</td>
                    <td><span className={`adm-badge ${order.status}`}>{order.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="adm-section">
        <h2>Audit log</h2>
        {auditLogs.length === 0 ? (
          <div className="adm-empty">No activity yet.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>By</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{shortDate(log.createdAt)}</td>
                    <td>{log.action}</td>
                    <td>{log.userName}</td>
                    <td>{log.details ?? log.reason ?? "—"}</td>
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
