import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import Flash from "@/components/admin/Flash";
import Pager from "@/components/admin/Pager";
import { CustomerStatusBadge, PasswordBadge, PaymentBadge } from "@/components/admin/Badges";
import { getCurrentAdmin } from "@/lib/session";
import { listCustomersAdmin } from "@/lib/db";
import { dateTime, inr, shortDate } from "@/lib/format";

const PAGE_SIZE = 20;

type Search = {
  q?: string;
  status?: string;
  password?: string;
  sort?: string;
  page?: string;
  notice?: string;
};

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listCustomersAdmin({
    q,
    status: sp.status,
    password: sp.password,
    sort: sp.sort,
    page,
    pageSize: PAGE_SIZE,
  });
  const filtered = Boolean(q || sp.status || sp.password);

  return (
    <AdminShell active="customers" adminName={admin.name} adminRole={admin.role}>
      <Flash notice={sp.notice} />
      <div className="adm-page-head">
        <div>
          <h1>Customers</h1>
          <p className="adm-lead">Create customers, share access links and track activation.</p>
        </div>
        <Link href="/admin/customers/new" className="adm-btn adm-btn-primary">
          + New customer
        </Link>
      </div>

      <div className="adm-section">
        <form action="/admin/customers" method="get" className="adm-toolbar">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, mobile, email or customer ID"
            aria-label="Search customers"
          />
          <select name="status" defaultValue={sp.status ?? ""} aria-label="Account status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending activation</option>
            <option value="inactive">Deactivated</option>
          </select>
          <select name="password" defaultValue={sp.password ?? ""} aria-label="Password status">
            <option value="">Any password status</option>
            <option value="not_set">Password Not Set</option>
            <option value="pending">Pending (link opened)</option>
            <option value="set">Password Set</option>
          </select>
          <select name="sort" defaultValue={sp.sort ?? ""} aria-label="Sort">
            <option value="">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
            <option value="activity">Last activity</option>
          </select>
          <button type="submit" className="adm-btn adm-btn-primary">
            Apply
          </button>
          {filtered || sp.sort ? (
            <Link href="/admin/customers" className="adm-btn adm-btn-ghost">
              Clear
            </Link>
          ) : null}
        </form>

        {rows.length === 0 ? (
          <div className="adm-empty">
            {filtered ? "No customers match these filters." : "No customers yet."}{" "}
            <Link href="/admin/customers/new" className="adm-link">
              Create a customer
            </Link>
          </div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Account</th>
                  <th>Password</th>
                  <th>Last payment</th>
                  <th>Loans</th>
                  <th>Outstanding</th>
                  <th>Last activity</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/customers/${c.id}`} className="adm-link">
                        {c.name}
                      </Link>
                      <div className="adm-micro">{c.customerCode ?? c.id}</div>
                    </td>
                    <td className="adm-mono">+91 {c.mobile}</td>
                    <td>
                      <CustomerStatusBadge status={c.status} />
                    </td>
                    <td>
                      <PasswordBadge customer={c} />
                    </td>
                    <td>
                      {c.lastPaymentStatus ? (
                        <Link href={`/admin/payments?status=all&q=${encodeURIComponent(c.mobile)}`}>
                          <PaymentBadge status={c.lastPaymentStatus} />
                        </Link>
                      ) : (
                        "—"
                      )}
                      {c.paymentCount > 1 ? (
                        <div className="adm-micro">{c.paymentCount} payments</div>
                      ) : null}
                    </td>
                    <td>{c.loanCount}</td>
                    <td>{c.outstanding > 0 ? inr(c.outstanding) : "—"}</td>
                    <td>{c.lastActivityAt ? dateTime(c.lastActivityAt) : "—"}</td>
                    <td>{shortDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          basePath="/admin/customers"
          params={{ q, status: sp.status, password: sp.password, sort: sp.sort }}
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
        />
      </div>
    </AdminShell>
  );
}
