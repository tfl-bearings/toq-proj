import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import Flash from "@/components/admin/Flash";
import LoanActions from "@/components/admin/LoanActions";
import Pager from "@/components/admin/Pager";
import { LoanBadge } from "@/components/admin/Badges";
import { getCurrentAdmin } from "@/lib/session";
import { listOrdersAdmin, loanViewCounts } from "@/lib/db";
import { dateTime, inr, shortDate } from "@/lib/format";
import { LOAN_VIEWS } from "@/lib/status";

const PAGE_SIZE = 20;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; view?: string; q?: string; page?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const sp = await searchParams;
  const counts = await loanViewCounts();
  const known = LOAN_VIEWS.some((v) => v.key === sp.view) || sp.view === "all";
  // Open with the loans that need attention: awaiting payment, else everything.
  const view = known ? sp.view! : counts.awaiting > 0 ? "awaiting" : "all";
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listOrdersAdmin({ view, q, page, pageSize: PAGE_SIZE });

  const returnParams = new URLSearchParams({ view });
  if (q) returnParams.set("q", q);
  if (page > 1) returnParams.set("page", String(page));
  const returnTo = `/admin/orders?${returnParams.toString()}`;
  const tabHref = (key: string) => {
    const params = new URLSearchParams({ view: key });
    if (q) params.set("q", q);
    return `/admin/orders?${params.toString()}`;
  };
  const current = LOAN_VIEWS.find((v) => v.key === view);

  return (
    <AdminShell active="orders" adminName={admin.name} adminRole={admin.role}>
      <Flash notice={sp.notice} />
      <div className="adm-page-head">
        <div>
          <h1>Loans</h1>
          <p className="adm-lead">
            Every loan appears here as soon as it&apos;s created. Loans awaiting payment
            can be marked paid, cancelled or kept pending — no customer UTR needed.
          </p>
        </div>
        <Link href="/admin/loans/new" className="adm-btn adm-btn-primary">
          + New loan
        </Link>
      </div>

      <nav className="adm-tabs" aria-label="Loan status">
        {LOAN_VIEWS.map((v) => (
          <Link key={v.key} href={tabHref(v.key)} className={view === v.key ? "active" : undefined}>
            {v.label}
            <span>{counts[v.key] ?? 0}</span>
          </Link>
        ))}
        <Link href={tabHref("all")} className={view === "all" ? "active" : undefined}>
          All<span>{counts.all}</span>
        </Link>
      </nav>

      <div className="adm-section">
        <form action="/admin/orders" method="get" className="adm-toolbar">
          <input type="hidden" name="view" value={view} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Customer, mobile, product or loan ID"
            aria-label="Search loans"
          />
          <button type="submit" className="adm-btn adm-btn-primary">
            Search
          </button>
          {q ? (
            <Link href={tabHref(view)} className="adm-btn adm-btn-ghost">
              Clear
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <div className="adm-empty">
            {q
              ? "No loans match this search."
              : current
                ? `No loans in “${current.label}”.`
                : "No loans yet."}
          </div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Loan</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/orders/${o.id}`} className="adm-link">
                        {o.productName}
                      </Link>
                      <div className="adm-micro adm-mono">{o.id}</div>
                    </td>
                    <td>
                      <Link href={`/admin/customers/${o.customerId}`} className="adm-link">
                        {o.customerName ?? "—"}
                      </Link>
                      <div className="adm-micro adm-mono">+91 {o.customerMobile}</div>
                    </td>
                    <td>
                      {o.status === "paid" ? inr(o.amountPaid ?? o.principal) : inr(o.amountDue)}
                      {o.amountPaid && o.status !== "paid" ? (
                        <div className="adm-micro">{inr(o.amountPaid)} paid so far</div>
                      ) : null}
                    </td>
                    <td>{shortDate(o.dueDate)}</td>
                    <td>
                      <LoanBadge order={o} />
                      {o.status === "cancelled" && o.cancelReason ? (
                        <div className="adm-micro">{o.cancelReason}</div>
                      ) : null}
                      {o.status === "paid" && o.settledAt ? (
                        <div className="adm-micro">marked paid by {o.settledByName}</div>
                      ) : null}
                    </td>
                    <td>
                      {o.pendingPaymentId ? (
                        <Link href={`/admin/payments/${o.pendingPaymentId}`} className="adm-link adm-micro">
                          UTR submitted — review
                        </Link>
                      ) : o.paymentCount > 0 ? (
                        <span className="adm-micro">
                          {o.paymentCount} attempt{o.paymentCount > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="adm-micro">No UTR yet</span>
                      )}
                      <div className="adm-micro">{dateTime(o.updatedAt ?? o.createdAt)}</div>
                    </td>
                    <td>
                      <LoanActions
                        order={o}
                        pendingPaymentId={o.pendingPaymentId}
                        returnTo={returnTo}
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          basePath="/admin/orders"
          params={{ view, q }}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
        />
      </div>
    </AdminShell>
  );
}
