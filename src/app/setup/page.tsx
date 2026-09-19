import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SetupAccountForm from "@/components/SetupAccountForm";
import { getSettings } from "@/lib/db";
import { getCurrentCustomer } from "@/lib/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// First-time account setup from the main app: mobile number + the activation
// code we issued + a new password. The alternative to the personal access link.
export default async function SetupPage() {
  if (await getCurrentCustomer()) redirect("/home");
  const { appName } = await getSettings();

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
              <h2>First-time setup</h2>
              <p className="mloan-login-subtitle">
                Enter your registered mobile number and the 8-digit activation code we
                gave you, then choose your password.
              </p>
              <SetupAccountForm />
              <p className="mloan-setup-help">
                Don&apos;t have a code? Contact us and we&apos;ll give you one. We never ask
                for your password.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
