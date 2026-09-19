"use client";

import { useState } from "react";
import Link from "next/link";
import type { Order, PaymentStatus } from "@/lib/types";
import { PaymentStatusPill } from "./CustomerPayments";
import { inr, shortDate } from "@/lib/format";
import { isOverdue } from "@/lib/loan";

const TABS = [
  { key: "all", label: "All" },
  { key: "due", label: "Pending Loans" },
  { key: "review", label: "Under Review" },
  { key: "paid", label: "Completed" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function stateMeta(status: Order["status"]) {
  switch (status) {
    case "paid":
      return { cls: "is-paid", label: "Paid" };
    case "cancelled":
      return { cls: "status-overdue", label: "Cancelled" };
    case "overdue":
      return { cls: "status-overdue", label: "Overdue" };
    case "review":
      return { cls: "is-not-paid", label: "Under review" };
    default:
      return { cls: "is-not-paid", label: "Due" };
  }
}

function inTab(order: Order, tab: TabKey): boolean {
  if (tab === "all") return true;
  if (tab === "due") return order.status === "due" || order.status === "overdue";
  return order.status === tab;
}

export default function OrderTabs({
  orders,
  lastPayment = {},
}: {
  orders: Order[];
  lastPayment?: Record<string, { status: PaymentStatus; reason?: string }>;
}) {
  const [tab, setTab] = useState<TabKey>("all");
  const visible = orders.filter((o) => inTab(o, tab));

  return (
    <>
      <div className="mloan-tabs mloan-order-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mloan-empty-state">Nothing here yet.</div>
      ) : (
        <div className="mloan-order-list">
          {visible.map((o) => {
            const meta = stateMeta(isOverdue(o) && o.status === "due" ? "overdue" : o.status);
            return (
              <div className="mloan-order-card" key={o.id}>
                <div className="mloan-order-head">
                  <b>{o.productName}</b>
                  <span className={`mloan-order-pay-state ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Loan ID</dt>
                    <dd>{o.id}</dd>
                  </div>
                  <div>
                    <dt>Loan amount</dt>
                    <dd>{inr(o.principal)}</dd>
                  </div>
                  <div>
                    <dt>Amount due</dt>
                    <dd>{o.amountDue > 0 ? inr(o.amountDue) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Due date</dt>
                    <dd>{shortDate(o.dueDate)}</dd>
                  </div>
                  {lastPayment[o.id] ? (
                    <div>
                      <dt>Last payment</dt>
                      <dd>
                        <PaymentStatusPill status={lastPayment[o.id].status} />
                        {lastPayment[o.id].reason ? (
                          <small className="mloan-dd-note">{lastPayment[o.id].reason}</small>
                        ) : null}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Action</dt>
                    <dd>
                      {o.status === "paid" || o.status === "cancelled" ? (
                        <Link className="mloan-pill" href={`/repay/${o.id}`}>
                          {o.status === "paid" ? "Closed" : "Cancelled"}
                        </Link>
                      ) : (
                        <Link className="mloan-pill" href={`/repay/${o.id}`}>
                          {o.status === "review"
                            ? "View status"
                            : lastPayment[o.id] && lastPayment[o.id].status !== "approved"
                              ? "Pay again"
                              : "Repay now"}
                        </Link>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
