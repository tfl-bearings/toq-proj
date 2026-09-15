// Shared domain types for toq-app (a loan / credit-wallet management app).

export type OrderStatus =
  | "due" // repayment is due / not yet paid
  | "review" // customer submitted a UTR, awaiting manual verification
  | "paid" // verified & closed
  | "overdue"; // past due date, still unpaid

export type PaymentStatus = "review" | "success" | "failed";

export type PayApp = "phonepe" | "paytm" | "gpay";

export interface Customer {
  id: string;
  mobile: string; // 10-digit Indian mobile, no +91
  name: string;
  email?: string;
  photo?: string; // optional avatar URL / data URI
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  icon: string; // emoji used as the product glyph
  min: number;
  max: number;
  tenureMonths: number;
  rateMonthly: number; // % per month, shown honestly
  badge?: string;
}

export interface Order {
  id: string;
  customerId: string;
  productId: string;
  productName: string;
  principal: number; // amount originally borrowed
  amountDue: number; // total amount to repay
  tenureMonths: number; // term of the loan
  rateMonthly: number; // % per month applied
  status: OrderStatus;
  upiId: string; // collection VPA for repayment
  payeeName: string; // name shown on the UPI request
  dueDate: string; // ISO date
  createdAt: string;
  applicationId?: string; // origin application, if created from one
}

export type ApplicationStatus = "pending" | "approved" | "rejected";

export interface Application {
  id: string;
  customerId: string;
  productId: string;
  productName: string;
  amount: number; // requested principal
  tenureMonths: number; // requested term
  purpose?: string;
  status: ApplicationStatus;
  reason?: string; // rejection reason / admin note
  orderId?: string; // loan created on approval
  createdAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  customerId: string;
  amount: number;
  upiId: string;
  utr: string; // 12-digit UPI transaction reference the customer enters
  payApp: PayApp;
  status: PaymentStatus;
  createdAt: string;
  // Audit trail for the manual review decision.
  reviewedBy?: string; // admin id
  reviewedByName?: string; // admin name, denormalised for display
  reviewedAt?: string; // ISO timestamp of approve/reject
  reason?: string; // reason captured on rejection
}

export interface Session {
  token: string;
  customerId: string;
  createdAt: string;
}

// --- Operator (admin) side ---------------------------------------------------

export type AdminRole = "owner" | "staff";

export interface Admin {
  id: string;
  username: string;
  name: string;
  role: AdminRole;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
}

export interface AdminSession {
  token: string;
  adminId: string;
  createdAt: string;
}

export interface Settings {
  appName: string;
  themeColor: string;
  upiId: string;
  payeeName: string;
  supportEmail: string;
  supportPhone: string;
}

export interface DB {
  customers: Customer[];
  products: Product[];
  orders: Order[];
  payments: Payment[];
  applications: Application[];
  sessions: Session[];
  admins: Admin[];
  adminSessions: AdminSession[];
  settings: Settings;
}
