import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentCustomer } from "@/lib/session";
import { getSettings } from "@/lib/db";

export default async function SupportPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");
  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();
  const { appName, supportEmail, supportPhone } = await getSettings();

  return (
    <AppShell variant="inner" title="Support" initial={initial} back="/profile">
      <section className="mloan-support">
        <h2>We&apos;re here to help</h2>
        <p>
          Questions about your loan, a repayment, or your account? Reach our
          team and we&apos;ll get back to you.
        </p>
        <p>
          {supportEmail ? (
            <>
              📧 <strong>{supportEmail}</strong>
              <br />
            </>
          ) : null}
          {supportPhone ? (
            <>
              ☎️ <strong>{supportPhone}</strong> (Mon–Sat, 10am–6pm)
            </>
          ) : null}
        </p>
        <p>
          <small>
            {appName} will never call or message you asking for an OTP, your
            password, or an advance fee to release a loan. If you get such a
            request, it isn&apos;t us.
          </small>
        </p>
      </section>
    </AppShell>
  );
}
