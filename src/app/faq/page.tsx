import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentCustomer } from "@/lib/session";

const FAQS = [
  {
    q: "How do I repay a loan?",
    a: "Open ‘My Loans’, pick the loan, pay the exact due amount to the UPI ID shown, then enter your 12-digit UPI reference (UTR). We verify it against our bank statement before marking it complete.",
  },
  {
    q: "Do I ever pay a fee to receive a loan?",
    a: "No. A genuine lender deducts any fee from the amount disbursed — it never asks you to pay money first to ‘unlock’ or ‘release’ a loan. Treat any such request as a scam.",
  },
  {
    q: "Why is my payment ‘under review’?",
    a: "UPI references are checked by a person against our bank records. Until that match is confirmed, the payment stays under review. It is never auto-approved.",
  },
  {
    q: "Can I change my mobile number?",
    a: "Your mobile number is your login ID, so it can’t be changed in-app. Contact support if you need to update it.",
  },
];

export default async function FaqPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");
  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();

  return (
    <AppShell variant="inner" title="FAQ" initial={initial} back="/profile">
      <section className="mloan-faq">
        <h2>Frequently asked questions</h2>
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
    </AppShell>
  );
}
