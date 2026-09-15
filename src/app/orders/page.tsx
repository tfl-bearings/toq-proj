import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import OrderTabs from "@/components/OrderTabs";
import { getCurrentCustomer } from "@/lib/session";
import { getApplicationsForCustomer, getOrdersForCustomer } from "@/lib/db";
import { inr, shortDate } from "@/lib/format";
import type { ApplicationStatus } from "@/lib/types";

const APP_STATE: Record<ApplicationStatus, { cls: string; label: string }> = {
  pending: { cls: "is-not-paid", label: "Under review" },
  approved: { cls: "is-paid", label: "Approved" },
  rejected: { cls: "status-overdue", label: "Rejected" },
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ applied?: string }>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");

  const { applied } = await searchParams;
  const initial = (customer.name.trim()[0] ?? "U").toUpperCase();
  const orders = await getOrdersForCustomer(customer.id);
  const applications = await getApplicationsForCustomer(customer.id);

  return (
    <AppShell variant="inner" title="My Loans" initial={initial}>
      {applied ? (
        <div className="mloan-alert success" style={{ margin: 16 }}>
          Application submitted — our team will review it shortly.
        </div>
      ) : null}

      {applications.length > 0 ? (
        <>
          <div className="mloan-section-heading simple" style={{ margin: 16 }}>
            <h2>Applications</h2>
          </div>
          <div className="mloan-order-list" style={{ margin: "0 16px 8px" }}>
            {applications.map((a) => {
              const meta = APP_STATE[a.status];
              return (
                <div className="mloan-order-card" key={a.id}>
                  <div className="mloan-order-head">
                    <b>{a.productName}</b>
                    <span className={`mloan-order-pay-state ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Requested</dt>
                      <dd>{inr(a.amount)}</dd>
                    </div>
                    <div>
                      <dt>Tenure</dt>
                      <dd>{a.tenureMonths} months</dd>
                    </div>
                    <div>
                      <dt>Applied</dt>
                      <dd>{shortDate(a.createdAt)}</dd>
                    </div>
                    {a.status === "approved" ? (
                      <div>
                        <dt>Status</dt>
                        <dd>
                          <Link className="mloan-pill" href="#loans">
                            Loan active below
                          </Link>
                        </dd>
                      </div>
                    ) : null}
                    {a.status === "rejected" && a.reason ? (
                      <div>
                        <dt>Reason</dt>
                        <dd>{a.reason}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      <div className="mloan-section-heading simple" id="loans" style={{ margin: 16 }}>
        <h2>Your loans &amp; repayments</h2>
      </div>
      <OrderTabs orders={orders} />
    </AppShell>
  );
}
