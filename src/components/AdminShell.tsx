import Link from "next/link";
import { adminLogoutAction } from "@/app/admin/actions";
import { getSettings } from "@/lib/db";

const NAV = [
  { key: "dashboard", href: "/admin", label: "Dashboard" },
  { key: "applications", href: "/admin/applications", label: "Applications" },
  { key: "payments", href: "/admin/payments", label: "Payments" },
  { key: "orders", href: "/admin/orders", label: "Loans" },
  { key: "customers", href: "/admin/customers", label: "Customers" },
  { key: "settings", href: "/admin/settings", label: "Settings" },
];

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
  const { appName } = await getSettings();
  return (
    <div className="adm-shell">
      <header className="adm-topbar">
        <span className="adm-brand">{appName} · Operator</span>
        <nav className="adm-nav">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              className={active === n.key ? "active" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <details className="adm-mobile-menu">
          <summary>Menu</summary>
          <nav>
            {NAV.map((n) => (
              <Link
                key={n.key}
                href={n.href}
                className={active === n.key ? "active" : undefined}
              >
                {n.label}
              </Link>
            ))}
          </nav>
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
