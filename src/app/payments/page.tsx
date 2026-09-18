import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import CustomerPayments from "@/components/CustomerPayments";
import { getCurrentCustomer } from "@/lib/session";
import { listPaymentsForCustomer } from "@/lib/db";

// Every payment the signed-in customer has submitted, across all loans. The
// query is scoped to the session's customer id, never to a request parameter.
export default async function MyPaymentsPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();
  const payments = await listPaymentsForCustomer(customer.id);

  return (
    <AppShell variant="inner" title="My Payments" initial={initial} back="/home">
      <section className="mloan-payment-page">
        <p className="mloan-payment-intro">
          Each payment you submit is reviewed by our team. Its status updates here.
        </p>
        <CustomerPayments payments={payments} showLoan />
      </section>
    </AppShell>
  );
}
