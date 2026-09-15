import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentCustomer } from "@/lib/session";
import { getOrdersForCustomer, getProducts, getSettings } from "@/lib/db";
import { inr } from "@/lib/format";

export default async function HomePage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();
  const firstName = customer.name.split(" ")[0] || "there";
  const products = getProducts();
  const orders = getOrdersForCustomer(customer.id);
  const due = orders.find((o) => o.status === "due" || o.status === "overdue");
  const last4 = customer.mobile.slice(-4);
  const { appName } = getSettings();

  return (
    <AppShell variant="home" title={appName} initial={initial}>
      <section className="mloan-hero">
        <div>
          <h1>Hello, {firstName}</h1>
          <p>Borrow smart. Repay on time. No surprises.</p>
          <Link className="mloan-btn mloan-btn-primary" href="/orders">
            {due ? `Repay ${inr(due.amountDue)}` : "View my loans"}
          </Link>
        </div>
        <div className="mloan-hero-art" aria-hidden>
          <span>%</span>
          <div className="mloan-person">🧑‍💼</div>
        </div>
      </section>

      <div className="mloan-quick-grid">
        <Link href="/orders">
          <span aria-hidden>💳</span>
          <b>My Loans</b>
        </Link>
        <Link href="/orders">
          <span aria-hidden>📆</span>
          <b>Repay</b>
        </Link>
        <Link href="/faq">
          <span aria-hidden>❓</span>
          <b>FAQ</b>
        </Link>
        <Link href="/support">
          <span aria-hidden>💬</span>
          <b>Support</b>
        </Link>
      </div>

      <section className="mloan-bank-card-visual">
        <div className="mloan-bank-logo">{appName}</div>
        <div className="mloan-card-number">•••• •••• •••• {last4}</div>
        <div className="mloan-card-footer">
          <span>{customer.name}</span>
          <span>Credit Wallet</span>
        </div>
      </section>

      <div className="mloan-section-heading">
        <h2>Loan products</h2>
        <Link href="/orders">My loans</Link>
      </div>
      <section className="mloan-popular-grid">
        {products.map((p) => (
          <Link
            key={p.id}
            className="mloan-product-card-link"
            href={`/loan/${p.id}`}
          >
            <div className="mloan-product-card compact">
              <div className="mloan-product-icon" aria-hidden>
                {p.icon}
              </div>
              <div className="mloan-product-body">
                <div className="mloan-card-title-row">
                  <h3>{p.name}</h3>
                  {p.badge ? (
                    <span className="mloan-badge">{p.badge}</span>
                  ) : null}
                </div>
                <div className="mloan-amount-range">
                  {inr(p.min)} – {inr(p.max)}
                </div>
                <div className="mloan-muted">
                  {p.rateMonthly}% / mo · {p.tenureMonths} mo
                </div>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <p className="mloan-tiny-note">
        Representative rates shown. Actual rate, fees and eligibility are
        confirmed before any loan is disbursed.
      </p>
    </AppShell>
  );
}
