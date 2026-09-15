import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentCustomer } from "@/lib/session";
import { getProduct } from "@/lib/db";
import { inr } from "@/lib/format";

const REVIEWS = [
  { name: "Ananya R.", text: "Clear terms and the repayment reminders are helpful." },
  { name: "Vikram S.", text: "Applied and got a callback the same day. Smooth." },
  { name: "Priya M.", text: "No hidden charges — exactly what was shown upfront." },
];

const FAQS = [
  {
    q: "How is the interest calculated?",
    a: "Interest is charged monthly on the outstanding principal at the rate shown. The exact schedule is confirmed in your loan agreement before disbursal.",
  },
  {
    q: "Are there any upfront fees to receive a loan?",
    a: "No. You should never pay a fee to 'unlock' or 'release' a loan. Any processing fee is deducted transparently from the disbursed amount and shown in your agreement.",
  },
  {
    q: "How do I repay?",
    a: "From ‘My Loans’, open the loan and pay the due amount to the shown UPI ID, then submit your UPI reference (UTR). We verify it against our bank records.",
  },
];

export default async function LoanProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();

  return (
    <AppShell variant="inner" title={product.name} initial={initial} back="/home">
      <section className="mloan-info-card">
        <div className="mloan-product-card">
          <div className="mloan-product-icon" aria-hidden>
            {product.icon}
          </div>
          <div className="mloan-product-body">
            <h3>{product.name}</h3>
            <div className="mloan-amount-range">
              {inr(product.min)} – {inr(product.max)}
            </div>
            <div className="mloan-muted">
              {product.rateMonthly}% per month · up to {product.tenureMonths}{" "}
              months
            </div>
          </div>
        </div>
      </section>

      <section className="mloan-details">
        <div>
          <dt>Loan amount</dt>
          <dd>
            {inr(product.min)} – {inr(product.max)}
          </dd>
        </div>
        <div>
          <dt>Interest</dt>
          <dd>{product.rateMonthly}% / month</dd>
        </div>
        <div>
          <dt>Tenure</dt>
          <dd>up to {product.tenureMonths} months</dd>
        </div>
        <div>
          <dt>Processing fee</dt>
          <dd>Shown transparently before disbursal</dd>
        </div>
      </section>

      <section className="mloan-why">
        <h2>Why choose us</h2>
        <p>✔ Transparent rates — what you see is what you pay.</p>
        <p>✔ No upfront “release” fees, ever.</p>
        <p>✔ Repay easily by UPI with a verifiable reference.</p>
      </section>

      <section className="mloan-info-card">
        <h2>What customers say</h2>
        <div className="mloan-list-stack">
          {REVIEWS.map((r) => (
            <div className="mloan-review-card" key={r.name}>
              <strong>{r.name}</strong>
              <p>{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mloan-faq">
        <h2>FAQ</h2>
        {FAQS.map((f) => (
          <details key={f.q}>
            <summary>
              <span>{f.q}</span>
              <span aria-hidden>＋</span>
            </summary>
            <div>{f.a}</div>
          </details>
        ))}
      </section>

      <section className="mloan-info-card">
        <Link
          className="mloan-btn mloan-btn-primary mloan-btn-block"
          href={`/loan/${product.id}/apply`}
        >
          Apply for this loan
        </Link>
        <p className="mloan-tiny-note">
          Loan approval is subject to eligibility and verification. This is a
          demo build; no real loan is issued.
        </p>
      </section>
    </AppShell>
  );
}
