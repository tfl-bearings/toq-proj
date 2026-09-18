import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import NewLoanForm from "@/components/NewLoanForm";
import { getCurrentAdmin } from "@/lib/session";
import { getProducts, listCustomers } from "@/lib/db";

export default async function AdminNewLoanPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  // Deactivated customers can't be given new loans.
  const customers = (await listCustomers())
    .filter((c) => c.status !== "inactive")
    .map((c) => ({ id: c.id, name: c.name, mobile: c.mobile }));
  const products = (await getProducts()).map((p) => ({
    id: p.id,
    name: p.name,
    rateMonthly: p.rateMonthly,
    tenureMonths: p.tenureMonths,
  }));

  return (
    <AdminShell active="orders" adminName={admin.name} adminRole={admin.role}>
      <h1>Create a loan</h1>
      <p className="adm-lead">
        Directly assign a loan to a customer. Total repayable is calculated from
        the product rate and tenure.
      </p>

      <div className="adm-section">
        <h2>Loan details</h2>
        <NewLoanForm customers={customers} products={products} />
      </div>
    </AdminShell>
  );
}
