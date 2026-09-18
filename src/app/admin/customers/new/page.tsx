import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import CustomerForm from "@/components/admin/CustomerForm";
import { createCustomerAdminAction } from "@/app/admin/actions";
import { getCurrentAdmin } from "@/lib/session";

export default async function NewCustomerPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <AdminShell active="customers" adminName={admin.name} adminRole={admin.role}>
      <Link href="/admin/customers" className="adm-back">
        ← Customers
      </Link>
      <h1>New customer</h1>
      <p className="adm-lead">
        Creates the customer&apos;s account and a personal, single-use access link. The
        customer opens the link to choose their own password — you never see or set it.
      </p>
      <div className="adm-section">
        <h2>Customer details</h2>
        <CustomerForm action={createCustomerAdminAction} submitLabel="Create customer & link" />
      </div>
    </AdminShell>
  );
}
