import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/AdminLoginForm";
import { getCurrentAdmin } from "@/lib/session";

export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin");

  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <h1>Operator Console</h1>
        <p className="sub">Sign in to manage loans and verify payments.</p>
        <AdminLoginForm />
      </div>
    </div>
  );
}
