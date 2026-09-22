import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import ActionDialog from "@/components/admin/ActionDialog";
import CustomerForm from "@/components/admin/CustomerForm";
import Flash from "@/components/admin/Flash";
import ShareLink from "@/components/admin/ShareLink";
import LoanActions from "@/components/admin/LoanActions";
import {
  CustomerStatusBadge,
  LoanBadge,
  PasswordBadge,
  PaymentBadge,
} from "@/components/admin/Badges";
import { getCurrentAdmin } from "@/lib/session";
import {
  customerHasRecords,
  getAdminById,
  getApplicationsForCustomer,
  getCustomerById,
  getOrdersForCustomer,
  ACTIVATION_MAX_ATTEMPTS,
  getSettings,
  inviteIsUsable,
  listAuditLogs,
  listPaymentsForCustomer,
} from "@/lib/db";
import { dateTime, inr, shortDate } from "@/lib/format";
import { appBaseUrl, inviteUrl } from "@/lib/links";
import { auditLabel, paymentMethodLabel } from "@/lib/status";
import {
  deactivateCustomerAction,
  deleteCustomerAction,
  generateCustomerInviteAction,
  reactivateCustomerAction,
  updateCustomerAdminAction,
} from "@/app/admin/actions";


export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { customerId } = await params;
  const { notice } = await searchParams;
  const customer = await getCustomerById(customerId);
  if (!customer) notFound();

  const [orders, payments, applications, activity, hasRecords, settings, creator] =
    await Promise.all([
      getOrdersForCustomer(customer.id),
      listPaymentsForCustomer(customer.id),
      getApplicationsForCustomer(customer.id),
      listAuditLogs({ customerId: customer.id, pageSize: 25 }),
      customerHasRecords(customer.id),
      getSettings(),
      customer.createdBy ? getAdminById(customer.createdBy) : Promise.resolve(undefined),
    ]);

  const linkUsable = inviteIsUsable(customer);
  const link = linkUsable && customer.inviteToken ? await inviteUrl(customer.inviteToken) : null;
  const setupUrl = `${await appBaseUrl()}/setup`;
  const codeLocked = (customer.activationAttempts ?? 0) >= ACTIVATION_MAX_ATTEMPTS;
  const hidden = { customerId: customer.id };
  const approvedTotal = payments
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + (p.approvedAmount ?? p.amount), 0);

  return (
    <AdminShell active="customers" adminName={admin.name} adminRole={admin.role}>
      <Flash notice={notice} />
      <Link href="/admin/customers" className="adm-back">
        ← Customers
      </Link>
      <div className="adm-page-head">
        <div>
          <h1>{customer.name}</h1>
          <p className="adm-lead">
            {customer.customerCode ?? customer.id} · +91 {customer.mobile}{" "}
            <CustomerStatusBadge status={customer.status} />{" "}
            <PasswordBadge customer={customer} />
          </p>
        </div>
        <div className="adm-actions">
          {customer.status === "inactive" ? (
            <ActionDialog
              action={reactivateCustomerAction}
              hidden={hidden}
              triggerLabel="Reactivate"
              triggerClassName="adm-btn adm-btn-approve"
              title="Reactivate customer?"
              description={
                customer.passwordSetAt
                  ? "The customer can sign in again with their existing password."
                  : "The account returns to pending activation. Issue a new access link afterwards."
              }
              submitLabel="Reactivate"
              submitClassName="adm-btn adm-btn-approve"
            />
          ) : (
            <ActionDialog
              action={deactivateCustomerAction}
              hidden={hidden}
              triggerLabel="Deactivate"
              triggerClassName="adm-btn adm-btn-reject"
              title="Deactivate customer?"
              description="They are signed out immediately and can't sign in or use their access link. Their loans and payment history are kept."
              submitLabel="Deactivate"
              submitClassName="adm-btn adm-btn-danger"
            >
              <label className="adm-field">
                Reason (optional, internal)
                <input name="reason" maxLength={300} />
              </label>
            </ActionDialog>
          )}
          {admin.role === "owner" && !hasRecords ? (
            <ActionDialog
              action={deleteCustomerAction}
              hidden={hidden}
              triggerLabel="Delete"
              triggerClassName="adm-btn adm-btn-reject"
              title="Delete customer permanently?"
              description="Only possible because this customer has no loans, applications or payments. This can't be undone."
              submitLabel="Delete permanently"
              submitClassName="adm-btn adm-btn-danger"
              pendingLabel="Deleting…"
            />
          ) : null}
        </div>
      </div>

      <div className="adm-grid-2">
        <div className="adm-section">
          <h2>Account</h2>
          <dl className="adm-dl">
            <dt>Customer ID</dt>
            <dd className="adm-mono">
              {customer.customerCode ?? "—"} <span className="adm-micro">({customer.id})</span>
            </dd>
            <dt>Mobile</dt>
            <dd className="adm-mono">+91 {customer.mobile}</dd>
{customer.email ? (
              <>
                <dt>Email</dt>
                <dd>{customer.email}</dd>
              </>
            ) : null}
            {customer.upiId ? (
              <>
                <dt>UPI ID (legacy)</dt>
                <dd className="adm-mono">
                  {customer.upiId}
                  <div className="adm-micro">Repayment UPI is set per loan.</div>
                </dd>
              </>
            ) : null}
            <dt>Created</dt>
            <dd>
              {dateTime(customer.createdAt)}
              {creator ? ` by ${creator.name}` : customer.createdBy ? "" : " (self sign-up)"}
            </dd>
            <dt>Last activity</dt>
            <dd>{dateTime(customer.lastActivityAt)}</dd>
            <dt>Last sign-in</dt>
            <dd>{dateTime(customer.lastLoginAt)}</dd>
            {customer.deactivatedAt ? (
              <>
                <dt>Deactivated</dt>
                <dd>{dateTime(customer.deactivatedAt)}</dd>
              </>
            ) : null}
          </dl>
        </div>

        <div className="adm-section">
          <h2>Password &amp; activation</h2>
          <dl className="adm-dl">
            <dt>Status</dt>
            <dd>
              <PasswordBadge customer={customer} />
            </dd>
            <dt>Password set</dt>
            <dd>{dateTime(customer.passwordSetAt)}</dd>
            <dt>Account activated</dt>
            <dd>{dateTime(customer.activatedAt)}</dd>
            <dt>Link generated</dt>
            <dd>{customer.inviteToken ? dateTime(customer.inviteCreatedAt) : "—"}</dd>
            <dt>Link opened</dt>
            <dd>
              {customer.inviteToken
                ? customer.inviteOpenedAt
                  ? dateTime(customer.inviteOpenedAt)
                  : "Not yet"
                : "—"}
            </dd>
            <dt>Link expires</dt>
            <dd>{customer.inviteToken ? dateTime(customer.inviteExpiresAt) : "—"}</dd>
            <dt>Activated via</dt>
            <dd>
              {customer.passwordSetVia === "activation_code"
                ? "Activation code (main app)"
                : customer.passwordSetVia === "invite_link"
                  ? "Access link"
                  : customer.passwordSetVia === "self_signup"
                    ? "Self sign-up"
                    : customer.passwordSetAt
                      ? "—"
                      : "Not yet"}
            </dd>
          </dl>
          <p className="adm-note">The customer&apos;s password is hashed and is never shown here.</p>
        </div>
      </div>

      <div className="adm-section">
        <h2>Access link &amp; activation code</h2>
        <div className="adm-pad">
          {customer.status === "inactive" ? (
            <p className="adm-muted">Reactivate the customer to issue an access link.</p>
          ) : link ? (
            <>
              <p className="adm-muted">
                Give {customer.name} <b>either</b> the personal link <b>or</b> the activation
                code (they enter it with their mobile number at{" "}
                <span className="adm-mono">{setupUrl}</span>). Both set up the same account,
                work once, and stop working when the password is set, when you generate new
                ones, or after {dateTime(customer.inviteExpiresAt)}.
              </p>
              {codeLocked ? (
                <div className="adm-error">
                  The activation code was locked after {ACTIVATION_MAX_ATTEMPTS} incorrect
                  attempts. The link still works; generate new ones to issue a new code.
                </div>
              ) : null}
              <ShareLink
                url={link}
                activationCode={codeLocked ? undefined : customer.activationCode}
                setupUrl={setupUrl}
                mobile={customer.mobile}
                email={customer.email}
                customerName={customer.name}
                appName={settings.appName}
              />
            </>
          ) : customer.inviteToken ? (
            <p className="adm-muted">The previous link expired. Generate a new one to share.</p>
          ) : customer.passwordSetAt ? (
            <p className="adm-muted">
              Password set on {dateTime(customer.passwordSetAt)}. If the customer forgets it,
              issue a reset link — it lets them choose a new password.
            </p>
          ) : (
            <p className="adm-muted">No access link yet.</p>
          )}
          {customer.status !== "inactive" ? (
            <div className="adm-actions adm-mt">
              <ActionDialog
                action={generateCustomerInviteAction}
                hidden={hidden}
                triggerLabel={
                  link ? "Regenerate link" : customer.passwordSetAt ? "Issue password reset link" : "Generate link"
                }
                triggerClassName={link ? "adm-btn adm-btn-ghost" : "adm-btn adm-btn-primary"}
                title={link ? "Replace the access link?" : "Generate access link?"}
                description={
                  link
                    ? "The current link stops working immediately. Share the new one with the customer."
                    : customer.passwordSetAt
                      ? "The customer can use this link to choose a new password. Their current password keeps working until then."
                      : "A personal link valid for 7 days will be created."
                }
                submitLabel="Generate"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="adm-section">
        <h2>Edit customer</h2>
        <CustomerForm
          action={updateCustomerAdminAction}
          customerId={customer.id}
          initial={{ name: customer.name, mobile: customer.mobile }}
          submitLabel="Save changes"
        />
      </div>

      <div className="adm-section">
        <h2>
          Payment history ({payments.length})
          {approvedTotal > 0 ? <span className="adm-h2-meta">{inr(approvedTotal)} approved</span> : null}
        </h2>
        {payments.length === 0 ? (
          <div className="adm-empty">No payments recorded for this customer.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Submitted</th>
                  <th>Paid on</th>
                  <th>Loan</th>
                  <th>Amount</th>
                  <th>UTR</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Reviewed</th>
                  <th>Reason / refund</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/payments/${p.id}`} className="adm-link adm-mono">
                        {p.id}
                      </Link>
                      {p.hasProof ? <div className="adm-micro">📎 screenshot</div> : null}
                    </td>
                    <td>{dateTime(p.createdAt)}</td>
                    <td>{p.paymentDate ? shortDate(p.paymentDate) : "—"}</td>
                    <td>{p.productName ?? p.orderId}</td>
                    <td>
                      {inr(p.amount)}
                      {p.approvedAmount && p.approvedAmount !== p.amount ? (
                        <div className="adm-micro">verified {inr(p.approvedAmount)}</div>
                      ) : null}
                    </td>
                    <td className="adm-mono">{p.utr}</td>
                    <td>
                      {paymentMethodLabel(p)}
                    </td>
                    <td>
                      <PaymentBadge status={p.status} />
                    </td>
                    <td>
                      {p.reviewedAt ? (
                        <>
                          {dateTime(p.reviewedAt)}
                          <div className="adm-micro">{p.reviewedByName}</div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="wrap">
                      {p.reason ?? ""}
                      {p.refundReference ? (
                        <div className="adm-micro">
                          Refund {p.refundReference} · {shortDate(p.refundedAt ?? p.createdAt)}
                        </div>
                      ) : null}
                      {!p.reason && !p.refundReference ? "—" : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="adm-section">
        <h2>
          Loans ({orders.length})
          {customer.status !== "inactive" ? (
            <Link href={`/admin/loans/new?customerId=${customer.id}`}>+ New loan</Link>
          ) : null}
        </h2>
        {orders.length === 0 ? (
          <div className="adm-empty">
            No loans yet.
          </div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Loan</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Still due</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/admin/orders/${order.id}`} className="adm-link">
                        {order.productName}
                      </Link>
                      <div className="adm-micro adm-mono">{order.id}</div>
                    </td>
                    <td>{inr(order.principal)}</td>
                    <td>{order.amountPaid ? inr(order.amountPaid) : "—"}</td>
                    <td>
                      {order.amountDue > 0 && order.status !== "cancelled" ? inr(order.amountDue) : "—"}
                    </td>
                    <td>{shortDate(order.dueDate)}</td>
                    <td>
                      <LoanBadge order={order} />
                      {order.cancelReason ? <div className="adm-micro">{order.cancelReason}</div> : null}
                    </td>
                    <td>
                      <LoanActions
                        order={order}
                        pendingPaymentId={
                          payments.find((p) => p.orderId === order.id && p.status === "pending")?.id
                        }
                        hasPayments={payments.some((p) => p.orderId === order.id)}
                        returnTo={`/admin/customers/${customer.id}`}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {applications.length > 0 ? (
        <div className="adm-section">
          <h2>Loan applications ({applications.length})</h2>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Applied</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Tenure</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td>{dateTime(a.createdAt)}</td>
                    <td>{a.productName}</td>
                    <td>{inr(a.amount)}</td>
                    <td>{a.tenureMonths} mo</td>
                    <td>
                      <span className={`adm-badge ${a.status}`}>{a.status}</span>
                    </td>
                    <td className="wrap">{a.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="adm-section">
        <h2>
          Activity
          {activity.total > activity.rows.length ? (
            <Link href={`/admin/activity?customerId=${customer.id}`}>View all {activity.total}</Link>
          ) : null}
        </h2>
        {activity.rows.length === 0 ? (
          <div className="adm-empty">No activity yet.</div>
        ) : (
          <ul className="adm-timeline">
            {activity.rows.map((log) => (
              <li key={log.id}>
                <time>{dateTime(log.createdAt)}</time>
                <div>
                  <b>{auditLabel(log.action)}</b>{" "}
                  <span className="adm-micro">
                    by {log.userName} ({log.userType})
                  </span>
                  {log.reason ? <div>Reason: {log.reason}</div> : null}
                  {log.details ? <div className="adm-muted">{log.details}</div> : null}
                  {log.paymentId ? (
                    <Link href={`/admin/payments/${log.paymentId}`} className="adm-micro adm-link">
                      {log.paymentId}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
