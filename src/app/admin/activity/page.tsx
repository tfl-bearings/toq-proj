import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import Pager from "@/components/admin/Pager";
import { getCurrentAdmin } from "@/lib/session";
import { listAuditLogs } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { AUDIT_ACTION_LABEL, auditLabel } from "@/lib/status";

const PAGE_SIZE = 30;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; customerId?: string; page?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const action = sp.action && sp.action in AUDIT_ACTION_LABEL ? sp.action : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listAuditLogs({
    q,
    action,
    customerId: sp.customerId,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <AdminShell active="activity" adminName={admin.name} adminRole={admin.role}>
      <h1>Activity</h1>
      <p className="adm-lead">
        Audit trail of operator and customer actions: who did what, to whom, and when.
      </p>

      <div className="adm-section">
        <form action="/admin/activity" method="get" className="adm-toolbar">
          {sp.customerId ? <input type="hidden" name="customerId" value={sp.customerId} /> : null}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search operator, customer, payment ID or details"
            aria-label="Search activity"
          />
          <select name="action" defaultValue={action ?? ""} aria-label="Action">
            <option value="">All actions</option>
            {Object.entries(AUDIT_ACTION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="adm-btn adm-btn-primary">
            Apply
          </button>
          {q || action || sp.customerId ? (
            <Link href="/admin/activity" className="adm-btn adm-btn-ghost">
              Clear
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <div className="adm-empty">No activity matches.</div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>By</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => (
                  <tr key={log.id}>
                    <td>{dateTime(log.createdAt)}</td>
                    <td>{auditLabel(log.action)}</td>
                    <td>
                      {log.userName}
                      <div className="adm-micro">{log.userType}</div>
                    </td>
                    <td>
                      {log.customerId ? (
                        log.customerName ? (
                          <Link href={`/admin/customers/${log.customerId}`} className="adm-link">
                            {log.customerName}
                          </Link>
                        ) : (
                          <span className="adm-micro adm-mono">{log.customerId} (deleted)</span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {log.paymentId ? (
                        <Link href={`/admin/payments/${log.paymentId}`} className="adm-link adm-mono">
                          {log.paymentId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="wrap adm-reason">
                      {log.reason ? <div>Reason: {log.reason}</div> : null}
                      {log.details ?? (log.reason ? null : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          basePath="/admin/activity"
          params={{ q, action, customerId: sp.customerId }}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
        />
      </div>
    </AdminShell>
  );
}
