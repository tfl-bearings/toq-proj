import type { Order, Settings } from "./types";

// Loan helpers.
//
// Operator-created loans carry an exact amount and due date. Loans approved
// from a customer application still use the catalogue rate: principal + simple
// interest over the tenure, repaid in one UPI payment.

export function totalRepayable(
  principal: number,
  rateMonthly: number,
  tenureMonths: number,
): number {
  const interest = principal * (rateMonthly / 100) * tenureMonths;
  return Math.round(principal + interest);
}

export function addMonthsIso(months: number, from = new Date()): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Today's calendar date in India (YYYY-MM-DD).
export function todayIst(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// A due date picked as a calendar day is due until the end of that day, IST.
export function dueDateFromDay(day: string): string {
  return new Date(`${day}T23:59:59.999+05:30`).toISOString();
}

// The calendar day (YYYY-MM-DD, IST) of a stored due date.
export function dueDay(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function isOverdue(order: Pick<Order, "status" | "dueDate">): boolean {
  return order.status !== "paid" && new Date(order.dueDate).getTime() < Date.now();
}

// Where the customer should pay for a loan: the loan's own UPI ID if the
// operator set one, otherwise the collection UPI configured in Settings.
export function repaymentUpi(
  order: Pick<Order, "upiId" | "payeeName">,
  settings: Pick<Settings, "upiId" | "payeeName">,
): { upiId: string; payeeName: string } {
  return {
    upiId: order.upiId || settings.upiId,
    payeeName: order.payeeName || settings.payeeName,
  };
}
