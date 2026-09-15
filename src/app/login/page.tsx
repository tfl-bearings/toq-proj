import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/session";
import { getSettings } from "@/lib/db";
import LoginForm from "@/components/LoginForm";
import InstallButton from "@/components/InstallButton";

export default async function LoginPage() {
  const customer = await getCurrentCustomer();
  if (customer) redirect("/home");
  const { appName } = getSettings();

  return (
    <div className="mloan-login-page">
      <div className="mloan-app-shell">
        <main className="mloan-main mloan-login-main">
          <section className="mloan-login-screen">
            <div className="mloan-login-hero">
              <div className="mloan-login-actions">
                <InstallButton className="mloan-install-btn mloan-install-btn-login" />
                <div className="mloan-login-avatar" aria-hidden>
                  💳
                </div>
              </div>
              <h1>{appName}</h1>
              <p>Your Trusted Lending Partner</p>
              <div className="mloan-login-wave" aria-hidden />
            </div>

            <div className="mloan-login-body">
              <h2>Welcome Back!</h2>
              <p className="mloan-login-subtitle">
                Securely sign in with your registered mobile number.
              </p>
              <LoginForm />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
