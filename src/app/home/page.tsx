import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { PaymentStatusNote, PaymentStatusPill } from "@/components/CustomerPayments";
import { getCurrentCustomer } from "@/lib/session";
import {
  countUnreadNotifications,
  getOrdersForCustomer,
  getProducts,
  getSettings,
  listPaymentsForCustomer,
} from "@/lib/db";
import { inr, shortDate } from "@/lib/format";
import { isOverdue } from "@/lib/loan";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const { welcome } = await searchParams;
  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();
  const firstName = customer.name.split(" ")[0] || "there";
  const [products, orders, payments, unread, { appName }] = await Promise.all([
    getProducts(),
    getOrdersForCustomer(customer.id),
    listPaymentsForCustomer(customer.id),
    countUnreadNotifications(customer.id),
    getSettings(),
  ]);
  // Everything not yet repaid, soonest due first.
  const pending = orders
    .filter((o) => o.status !== "paid")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const due = pending.find((o) => o.status === "due" || o.status === "overdue");
  const latestPayment = payments[0];
  const last4 = customer.mobile.slice(-4);

  return (
    <AppShell variant="home" title={appName} initial={initial} unread={unread}>
      {welcome ? (
        <div className="mloan-alert success" role="status" style={{ margin: 16 }}>
          Your password is set and your account is active. Welcome, {firstName}!
        </div>
      ) : null}

      <section className="mloan-hero">
        <div>
          <h1>Hello, {firstName}</h1>
          <p>Borrow smart. Repay on time. No surprises.</p>
          <Link
            className="mloan-btn mloan-btn-primary"
            href={due ? `/repay/${due.id}` : "/orders"}
          >
            {due ? `Repay ${inr(due.amountDue)}` : "View my loans"}
          </Link>
        </div>
        <div className="mloan-hero-art" aria-hidden>
          <span>%</span>
          <div className="mloan-person">🧑‍💼</div>
        </div>
      </section>

      <section className="mloan-dues">
        <div className="mloan-section-heading simple">
          <h2>Pending Loans / Dues</h2>
          {orders.length > pending.length ? <Link href="/orders">All loans</Link> : null}
        </div>
        {pending.length === 0 ? (
          <div className="mloan-dues-empty">You have no pending dues. 🎉</div>
        ) : (
          <ul>
            {pending.map((o) => (
              <li key={o.id} className="mloan-due-card">
                <div className="mloan-due-card-main">
                  <b>{o.productName}</b>
                  <strong>{inr(o.amountDue)}</strong>
                  <span>
                    Due Date: {shortDate(o.dueDate)}
                    {isOverdue(o) ? <em className="mloan-overdue-tag">Overdue</em> : null}
                  </span>
                </div>
                {o.status === "review" ? (
                  <Link className="mloan-due-card-status" href={`/repay/${o.id}`}>
                    Payment pending
                  </Link>
                ) : (
                  <Link className="mloan-btn mloan-btn-primary" href={`/repay/${o.id}`}>
                    Repay
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {latestPayment ? (
        <section className="mloan-status-card">
          <div className="mloan-status-card-head">
            <small>Latest payment</small>
            <PaymentStatusPill status={latestPayment.status} />
          </div>
          <strong>
            {inr(latestPayment.amount)} · {latestPayment.productName ?? "Loan"}
          </strong>
          <p>
            <PaymentStatusNote payment={latestPayment} />
          </p>
          <Link href={`/repay/${latestPayment.orderId}`}>View details →</Link>
        </section>
      ) : null}

      <div className="mloan-quick-grid">
        <Link href="/orders">
          <span aria-hidden>💳</span>
          <b>My Loans</b>
        </Link>
        <Link href="/payments">
          <span aria-hidden>🧾</span>
          <b>Payments</b>
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
