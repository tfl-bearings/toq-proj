import Link from "next/link";
import { redirect } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { getCurrentAdmin } from "@/lib/session";
import {
  listAllOrders,
  listApplications,
  listCustomers,
  listPayments,
} from "@/lib/db";
import { inr } from "@/lib/format";

export default async function AdminDashboard() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const customers = listCustomers();
  const orders = listAllOrders();
  const payments = listPayments();

  const pendingReviews = payments.filter((p) => p.status === "review").length;
  const pendingApps = listApplications().filter(
    (a) => a.status === "pending",
  ).length;
  const activeLoans = orders.filter((o) => o.status !== "paid").length;
  const outstanding = orders
    .filter((o) => o.status === "due" || o.status === "overdue")
    .reduce((sum, o) => sum + o.amountDue, 0);

  return (
    <AdminShell active="dashboard" adminName={admin.name} adminRole={admin.role}>
      <h1>Dashboard</h1>
      <p className="adm-lead">Overview of customers, loans and repayments.</p>

      <div className="adm-cards">
        <div className="adm-card">
          <b>{customers.length}</b>
          <small>Customers</small>
        </div>
        <div className="adm-card">
          <b>{activeLoans}</b>
          <small>Active loans</small>
        </div>
        <div className={pendingApps > 0 ? "adm-card alert" : "adm-card"}>
          <b>{pendingApps}</b>
          <small>Applications pending</small>
        </div>
        <div className={pendingReviews > 0 ? "adm-card alert" : "adm-card"}>
          <b>{pendingReviews}</b>
          <small>Payments awaiting review</small>
        </div>
        <div className="adm-card">
          <b>{inr(outstanding)}</b>
          <small>Outstanding due</small>
        </div>
      </div>

      <div className="adm-section">
        <h2>Needs your attention</h2>
        <div className="adm-note">
          {pendingApps > 0 ? (
            <>
              {pendingApps} loan application{pendingApps > 1 ? "s" : ""} awaiting
              a decision.{" "}
              <Link href="/admin/applications">Review applications →</Link>
              <br />
            </>
          ) : null}
          {pendingReviews > 0 ? (
            <>
              {pendingReviews} payment{pendingReviews > 1 ? "s" : ""} submitted a
              UTR and{" "}
              {pendingReviews > 1 ? "are" : "is"} waiting for manual
              verification.{" "}
              <Link href="/admin/payments">Go to the review queue →</Link>
            </>
          ) : null}
          {pendingApps === 0 && pendingReviews === 0 ? (
            <>Nothing needs your attention right now.</>
          ) : null}
        </div>
      </div>
    </AdminShell>
  );
}
