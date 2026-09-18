import Link from "next/link";
import { adminLogoutAction } from "@/app/admin/actions";
import { adminNavCounts, getSettings } from "@/lib/db";

const NAV = [
  { key: "dashboard", href: "/admin", label: "Dashboard" },
  { key: "customers", href: "/admin/customers", label: "Customers" },
  { key: "payments", href: "/admin/payments", label: "Payments" },
  { key: "applications", href: "/admin/applications", label: "Applications" },
  { key: "orders", href: "/admin/orders", label: "Loans" },
  { key: "activity", href: "/admin/activity", label: "Activity" },
  { key: "settings", href: "/admin/settings", label: "Settings" },
] as const;

export default async function AdminShell({
  active,
  adminName,
  adminRole,
  children,
}: {
  active: string;
  adminName: string;
  adminRole: string;
  children: React.ReactNode;
}) {
  const [{ appName }, counts] = await Promise.all([getSettings(), adminNavCounts()]);
  const badge = (key: string) => {
    const count =
      key === "payments" ? counts.payments : key === "applications" ? counts.applications : 0;
    return count > 0 ? (
      <span className="adm-nav-count" aria-label={`${count} pending`}>
        {count}
      </span>
    ) : null;
  };
  const links = NAV.map((n) => (
    <Link
      key={n.key}
      href={n.href}
      className={active === n.key ? "active" : undefined}
      aria-current={active === n.key ? "page" : undefined}
    >
      {n.label}
      {badge(n.key)}
    </Link>
  ));

  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <span className="adm-brand">{appName} · Operator</span>
        <nav className="adm-nav">{links}</nav>
        <details className="adm-mobile-menu">
          <summary>
            Menu
            {counts.payments + counts.applications > 0 ? (
              <span className="adm-nav-count">{counts.payments + counts.applications}</span>
            ) : null}
          </summary>
          <nav>{links}</nav>
        </details>
        <span className="adm-user">
          {adminName} ({adminRole})
        </span>
        <form action={adminLogoutAction}>
          <button type="submit" className="adm-logout">
            Log out
          </button>
        </form>
      </header>
      <main className="adm-main">{children}</main>
    </div>
  );
}
