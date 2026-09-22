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
        Creates the customer&apos;s account with an activation code and a personal
        access link. The customer sets their own password with either one — you never
        see or set it. Loan and UPI details are added when you create a loan.
      </p>
      <div className="adm-section">
        <h2>Customer details</h2>
        <CustomerForm action={createCustomerAdminAction} submitLabel="Create customer & link" />
      </div>
    </AdminShell>
  );
}
