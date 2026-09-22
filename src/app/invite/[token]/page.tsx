import Link from "next/link";
import type { Metadata } from "next";
import SetPasswordForm from "@/components/SetPasswordForm";
import {
  createAuditLog,
  getCustomerByInviteToken,
  getSettings,
  inviteIsUsable,
  markInviteOpened,
} from "@/lib/db";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Personal access link: the customer sets their own password here. The token is
// single-use and expires, and the page reveals nothing about the account — the
// customer must also enter the mobile number it is registered to. Opening the
// link never signs anyone in.
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [{ appName }, customer] = await Promise.all([
    getSettings(),
    getCustomerByInviteToken(token),
  ]);
  const usable = customer ? inviteIsUsable(customer) : false;

  if (customer && usable && (await markInviteOpened(customer.id))) {
    await createAuditLog({
      action: "application_link_opened",
      userType: "customer",
      userId: customer.id,
      userName: customer.name,
      customerId: customer.id,
      details: "Customer opened their access link",
    });
  }

  return (
    <div className="mloan-login-page">
      <div className="mloan-app-shell">
        <main className="mloan-main mloan-login-main">
          <section className="mloan-login-screen">
            <div className="mloan-login-hero">
              <div className="mloan-login-actions">
                <div className="mloan-login-avatar" aria-hidden>
                  🔐
                </div>
              </div>
              <h1>{appName}</h1>
              <p>Set up your account</p>
              <div className="mloan-login-wave" aria-hidden />
            </div>

            <div className="mloan-login-body">
              {customer && usable ? (
                <>
                  <h2>Set your password</h2>
                  <p className="mloan-login-subtitle">
                    Enter the mobile number your account is registered to and choose a
                    password. You&apos;ll then sign in with that number and password.
                  </p>
                  <SetPasswordForm token={token} />
                </>
              ) : (
                <>
                  <h2>Link not valid</h2>
                  <div className="mloan-alert mloan-alert-error">
                    This access link is invalid, has expired, or has already been used.
                    If you already set your password, just sign in. Otherwise ask us
                    for a new link.
                  </div>
                  <Link className="mloan-login-submit mloan-link-button" href="/login">
                    Go to sign in
                  </Link>
                </>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
