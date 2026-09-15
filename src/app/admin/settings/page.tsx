import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import SettingsForm from "@/components/SettingsForm";
import { getCurrentAdmin } from "@/lib/session";
import { getSettings } from "@/lib/db";

export default async function AdminSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const settings = await getSettings();

  return (
    <AdminShell active="settings" adminName={admin.name} adminRole={admin.role}>
      <h1>Settings</h1>
      <p className="adm-lead">App branding, UPI collection details and support.</p>

      <div className="adm-section">
        <h2>App configuration</h2>
        <SettingsForm settings={settings} />
        <p className="adm-note">
          The collection UPI ID and payee name are used for new repayment
          requests. Existing loans keep the UPI details they were created with.
        </p>
      </div>
    </AdminShell>
  );
}
