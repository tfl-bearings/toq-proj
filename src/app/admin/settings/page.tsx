import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import SettingsForm from "@/components/SettingsForm";
import { getCurrentAdmin } from "@/lib/session";
import { getSettings, getUpiQrInfo } from "@/lib/db";

export default async function AdminSettingsPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const [settings, qr] = await Promise.all([getSettings(), getUpiQrInfo()]);

  return (
    <AdminShell active="settings" adminName={admin.name} adminRole={admin.role}>
      <h1>Settings</h1>
      <p className="adm-lead">App branding, UPI payment details and support.</p>

      <div className="adm-section">
        <h2>App configuration</h2>
        {admin.role !== "owner" ? (
          <p className="adm-note adm-note-top">
            Only the owner can change settings — the collection UPI ID decides where
            customer payments go.
          </p>
        ) : null}
        <SettingsForm
          settings={settings}
          qrImageUrl={qr ? `/upi-qr?v=${encodeURIComponent(qr.updatedAt)}` : null}
        />
        <p className="adm-note">
          Customers see this UPI ID, a Copy button and a QR code on every repayment
          screen. Loans follow these details unless a loan was created with its own
          UPI ID (older loans keep the UPI ID they were created with). Without an
          uploaded QR image, a UPI QR is generated from the UPI ID with the amount
          due filled in.
        </p>
      </div>
    </AdminShell>
  );
}
