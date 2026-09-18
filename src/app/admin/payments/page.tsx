import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import CopyButton from "@/components/CopyButton";
import Flash from "@/components/admin/Flash";
import Pager from "@/components/admin/Pager";
import PaymentActions from "@/components/admin/PaymentActions";
import ProofViewer from "@/components/admin/ProofViewer";
import { PaymentBadge } from "@/components/admin/Badges";
import { getCurrentAdmin } from "@/lib/session";
import { listPaymentsAdmin, paymentStatusCounts } from "@/lib/db";
import { dateTime, inr, shortDate } from "@/lib/format";
import { PAYMENT_STATUSES, PAYMENT_STATUS_LABEL, isPaymentStatus } from "@/lib/status";
import type { PaymentRow } from "@/lib/types";

const PAGE_SIZE = 20;
const PAY_APP: Record<string, string> = { phonepe: "PhonePe", paytm: "Paytm", gpay: "GPay" };

type Search = {
  status?: string;
  q?: string;
  method?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: string;
  notice?: string;
};

function ReviewCard({ p, returnTo }: { p: PaymentRow; returnTo: string }) {
  const shortfall =
    p.amountDueAtSubmission !== undefined && p.amount < p.amountDueAtSubmission;
  return (
    <article className="adm-review-card">
      <div className="adm-review-proof">
        {p.hasProof ? (
          <ProofViewer
            src={`/admin/payments/${p.id}/proof`}
            label={`Screenshot · ${p.customerName ?? ""} · UTR ${p.utr}`}
          />
        ) : (
          <div className="adm-proof-missing">No screenshot uploaded</div>
        )}
      </div>
      <div className="adm-review-body">
        <div className="adm-review-top">
          <div>
            <Link href={`/admin/customers/${p.customerId}`} className="adm-link">
              {p.customerName ?? "Unknown customer"}
            </Link>
            <div className="adm-micro">
              {p.customerCode} · +91 {p.customerMobile}
            </div>
          </div>
          <div className="adm-review-amount">
            {inr(p.amount)}
            {p.amountDueAtSubmission !== undefined ? (
              <small className={shortfall ? "warn" : undefined}>
                of {inr(p.amountDueAtSubmission)} due
              </small>
            ) : null}
          </div>
        </div>
        <dl className="adm-review-facts">
          <div>
            <dt>UTR</dt>
            <dd className="adm-mono adm-utr">
              {p.utr} <CopyButton value={p.utr} className="adm-copy-mini" />
            </dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>
              {p.paymentMethod ?? "UPI"} · {PAY_APP[p.payApp] ?? p.payApp}
            </dd>
          </div>
          <div>
            <dt>Paid on</dt>
            <dd>{p.paymentDate ? shortDate(p.paymentDate) : "—"}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{dateTime(p.createdAt)}</dd>
          </div>
          <div>
            <dt>Paid to</dt>
            <dd className="adm-mono">{p.upiId}</dd>
          </div>
          <div>
            <dt>Loan</dt>
            <dd>
              {p.productName ?? "—"} <span className="adm-micro adm-mono">{p.orderId}</span>
            </dd>
          </div>
        </dl>
        <div className="adm-review-foot">
          <Link href={`/admin/payments/${p.id}`} className="adm-micro adm-link adm-mono">
            {p.id} — details
          </Link>
          {p.previousPaymentId ? (
            <Link href={`/admin/payments/${p.previousPaymentId}`} className="adm-micro adm-link">
              ↺ retry of {p.previousPaymentId}
            </Link>
          ) : null}
          <PaymentActions payment={p} returnTo={returnTo} />
        </div>
      </div>
    </article>
  );
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const sp = await searchParams;
  const counts = await paymentStatusCounts();
  // Default to the review queue when something is waiting, else everything.
  const status =
    sp.status === "all" || (sp.status && isPaymentStatus(sp.status))
      ? sp.status
      : counts.pending.count > 0
        ? "pending"
        : "all";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);
  // Review queue is first-in first-out unless another order is chosen.
  const sort = sp.sort || (status === "pending" ? "date_asc" : "");
  const filterParams = {
    status,
    q,
    method: sp.method,
    from: sp.from,
    to: sp.to,
    sort: sp.sort,
  };
  const { rows, total } = await listPaymentsAdmin({
    ...filterParams,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  const returnParams = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filterParams, page: page > 1 ? String(page) : undefined })) {
    if (value) returnParams.set(key, value);
  }
  const returnTo = `/admin/payments?${returnParams.toString()}`;
  const totalAll = PAYMENT_STATUSES.reduce((sum, s) => sum + counts[s].count, 0);
  const filtered = Boolean(q || sp.method || sp.from || sp.to);

  const tabHref = (value: string) => {
    const params = new URLSearchParams({ status: value });
    if (q) params.set("q", q);
    return `/admin/payments?${params.toString()}`;
  };

  return (
    <AdminShell active="payments" adminName={admin.name} adminRole={admin.role}>
      <Flash notice={sp.notice} />
      <h1>Payments</h1>
      <p className="adm-lead">
        Verify each UTR and screenshot against your bank statement, then approve or
        reject. Nothing is auto-approved, and every attempt is kept.
      </p>

      <nav className="adm-tabs" aria-label="Payment status">
        {PAYMENT_STATUSES.map((s) => (
          <Link key={s} href={tabHref(s)} className={status === s ? "active" : undefined}>
            {PAYMENT_STATUS_LABEL[s]}
            <span>{counts[s].count}</span>
          </Link>
        ))}
        <Link href={tabHref("all")} className={status === "all" ? "active" : undefined}>
          ALL<span>{totalAll}</span>
        </Link>
      </nav>

      <div className="adm-section">
        <form action="/admin/payments" method="get" className="adm-toolbar">
          <input type="hidden" name="status" value={status} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Customer, mobile, UTR, transaction or loan ID"
            aria-label="Search payments"
          />
          <select name="method" defaultValue={sp.method ?? ""} aria-label="Payment app">
            <option value="">Any app</option>
            <option value="phonepe">PhonePe</option>
            <option value="paytm">Paytm</option>
            <option value="gpay">GPay</option>
          </select>
          <label className="adm-inline-field">
            From
            <input type="date" name="from" defaultValue={sp.from} />
          </label>
          <label className="adm-inline-field">
            To
            <input type="date" name="to" defaultValue={sp.to} />
          </label>
          <select name="sort" defaultValue={sp.sort ?? ""} aria-label="Sort">
            <option value="">{status === "pending" ? "Oldest first (queue)" : "Newest first"}</option>
            <option value="date_asc">Oldest first</option>
            <option value="paid_desc">Payment date</option>
            <option value="amount_desc">Amount: high → low</option>
            <option value="amount_asc">Amount: low → high</option>
            <option value="utr">UTR</option>
          </select>
          <button type="submit" className="adm-btn adm-btn-primary">
            Apply
          </button>
          {filtered || sp.sort ? (
            <Link href={tabHref(status)} className="adm-btn adm-btn-ghost">
              Clear
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <div className="adm-empty">
            {status === "pending" && !filtered
              ? "All caught up — no payments waiting for review."
              : "No payments match these filters."}
          </div>
        ) : status === "pending" ? (
          <div className="adm-review-list">
            {rows.map((p) => (
              <ReviewCard key={p.id} p={p} returnTo={returnTo} />
            ))}
          </div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>UTR</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Reviewed</th>
                  <th>Reason / refund</th>
                  <th>Proof</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/payments/${p.id}`} className="adm-link adm-mono">
                        {p.id}
                      </Link>
                      <div className="adm-micro">{p.productName}</div>
                    </td>
                    <td>
                      <Link href={`/admin/customers/${p.customerId}`} className="adm-link">
                        {p.customerName ?? "—"}
                      </Link>
                      <div className="adm-micro adm-mono">+91 {p.customerMobile}</div>
                    </td>
                    <td>
                      {inr(p.amount)}
                      {p.approvedAmount && p.approvedAmount !== p.amount ? (
                        <div className="adm-micro">verified {inr(p.approvedAmount)}</div>
                      ) : null}
                    </td>
                    <td className="adm-mono">{p.utr}</td>
                    <td>{PAY_APP[p.payApp] ?? p.payApp}</td>
                    <td>
                      <PaymentBadge status={p.status} />
                    </td>
                    <td>
                      {dateTime(p.createdAt)}
                      {p.paymentDate ? (
                        <div className="adm-micro">paid {shortDate(p.paymentDate)}</div>
                      ) : null}
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
                    <td className="wrap adm-reason">
                      {p.reason ?? (p.refundReference ? "" : "—")}
                      {p.refundReference ? (
                        <div className="adm-micro">
                          Refund ref <span className="adm-mono">{p.refundReference}</span>
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {p.hasProof ? (
                        <ProofViewer
                          src={`/admin/payments/${p.id}/proof`}
                          label={`Screenshot · ${p.customerName ?? ""} · UTR ${p.utr}`}
                          compact
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <PaymentActions payment={p} returnTo={returnTo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          basePath="/admin/payments"
          params={filterParams}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
        />
      </div>
    </AdminShell>
  );
}
