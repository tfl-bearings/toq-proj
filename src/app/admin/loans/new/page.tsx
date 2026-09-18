import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import NewLoanForm from "@/components/NewLoanForm";
import { getCurrentAdmin } from "@/lib/session";
import { getSettings, listCustomers } from "@/lib/db";
import { todayIst } from "@/lib/loan";

export default async function AdminNewLoanPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { customerId } = await searchParams;
  const [allCustomers, settings] = await Promise.all([listCustomers(), getSettings()]);
  // Deactivated customers can't be given new loans.
  const customers = allCustomers
    .filter((c) => c.status !== "inactive")
    .map((c) => ({ id: c.id, name: c.name, mobile: c.mobile }));
  const preselected = customers.some((c) => c.id === customerId) ? customerId : undefined;

  return (
    <AdminShell active="orders" adminName={admin.name} adminRole={admin.role}>
      <Link href={preselected ? `/admin/customers/${preselected}` : "/admin/orders"} className="adm-back">
        ← {preselected ? "Customer" : "Loans"}
      </Link>
      <h1>Create a loan</h1>
      <p className="adm-lead">
        Enter the product name, the amount the customer must repay and the due date.
        The loan appears in the customer&apos;s app straight away.
      </p>

      <div className="adm-section">
        <h2>Loan details</h2>
        {customers.length === 0 ? (
          <div className="adm-empty">
            No active customers yet.{" "}
            <Link href="/admin/customers/new" className="adm-link">
              Create a customer
            </Link>
          </div>
        ) : (
          <NewLoanForm
            customers={customers}
            defaultCustomerId={preselected}
            defaultUpiId={settings.upiId}
            today={todayIst()}
          />
        )}
      </div>
    </AdminShell>
  );
}
