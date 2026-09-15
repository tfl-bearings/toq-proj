// Loan term maths. This app models a single lump-sum repayment: the customer
// repays principal + simple interest over the tenure, in one UPI payment.

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
