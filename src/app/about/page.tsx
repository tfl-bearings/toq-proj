import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentCustomer } from "@/lib/session";
import { getSettings } from "@/lib/db";

export default async function AboutPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");
  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();
  const { appName } = getSettings();

  return (
    <AppShell variant="inner" title="About us" initial={initial} back="/profile">
      <section className="mloan-about">
        <h2>About {appName}</h2>
        <p>
          {appName} is a credit-wallet app for managing personal loans and
          repayments in one place. You can view your active loans, see exactly
          what&apos;s due and when, and repay by UPI with a reference you can
          verify.
        </p>
        <p>
          <strong>Our promises:</strong>
        </p>
        <p>• We show the full cost of a loan before you take it.</p>
        <p>
          • We never ask for an upfront &ldquo;processing&rdquo;,
          &ldquo;release&rdquo; or &ldquo;insurance&rdquo; fee to hand over a
          loan. If anyone asks you to pay to receive a loan, it&apos;s a scam.
        </p>
        <p>• We don&apos;t read your contacts or photos to pressure you.</p>
        <p className="mloan-tiny-note">
          This is a demonstration build. No real money is lent or collected.
        </p>
      </section>
    </AppShell>
  );
}
