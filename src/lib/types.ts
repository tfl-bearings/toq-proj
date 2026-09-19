// Shared domain types for toq-app (a loan / credit-wallet management app).

// A loan's lifecycle is independent of payments: a loan can exist, be marked
// paid or be cancelled without any payment (UTR) ever being submitted.
export type OrderStatus =
  | "due" // awaiting customer payment
  | "overdue" // awaiting customer payment, past the due date
  | "review" // customer submitted a UTR, awaiting manual verification
  | "paid" // closed: approved payment(s) or marked paid by an operator
  | "cancelled"; // closed by an operator without payment

// pending  = created by an operator, password not yet set
// active   = password set, can sign in
// inactive = deactivated by an operator, cannot sign in
export type CustomerStatus = "active" | "pending" | "inactive";
export type PasswordSetupStatus = "not_set" | "pending" | "set" | "activated";

// Every payment attempt is its own record and moves through these states.
// Legacy values ("review" / "success" / "failed") are migrated on startup.
export type PaymentStatus =
  | "pending" // submitted by the customer, awaiting manual review
  | "approved" // verified against the bank statement
  | "rejected" // not accepted; no follow-up requested
  | "repayment_required" // not accepted; customer must pay again
  | "refund_pending" // not accepted; money received will be returned
  | "refunded"; // refund sent back to the customer

export type PayApp = "phonepe" | "paytm" | "gpay";

export interface Customer {
  id: string;
  mobile: string; // 10-digit Indian mobile, no +91
  name: string;
  email?: string;
  photo?: string; // optional avatar URL / data URI
  passwordHash: string;
  passwordSalt: string;
  status?: CustomerStatus;
  paymentMethod?: string;
  upiId?: string;
  customerCode?: string;
  // Single-use access link for password setup. Cleared once used.
  inviteToken?: string;
  inviteLink?: string; // legacy: links are now built from the token
  inviteCreatedAt?: string;
  inviteExpiresAt?: string;
  inviteOpenedAt?: string;
  // Activation code: the same single-use credential as the access link, for
  // setting up the account from the main app (mobile + code). Issued, rotated,
  // expired and burned together with inviteToken.
  activationCode?: string;
  activationAttempts?: number; // wrong codes entered; locked at the limit
  passwordSetAt?: string;
  passwordSetVia?: "invite_link" | "activation_code" | "self_signup";
  activatedAt?: string;
  lastActivityAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  createdBy?: string; // admin id, when created from the operator console
  updatedAt?: string;
  deactivatedAt?: string;
}

// Customer row as returned by admin list queries (no password material).
export type CustomerSummary = Omit<Customer, "passwordHash" | "passwordSalt"> & {
  loanCount: number;
  outstanding: number;
  paymentCount: number;
  lastPaymentStatus?: PaymentStatus;
};

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

// A loan. Operators create loans with a free-text product name, an amount and
// an exact due date. Loans approved from a customer application (and older
// loans) also carry the catalogue product, tenure and monthly rate.
export interface Order {
  id: string;
  customerId: string;
  productId?: string; // catalogue product, application-originated loans only
  productName: string;
  principal: number; // amount originally lent
  amountDue: number; // amount still to repay
  amountPaid?: number; // sum of approved payments
  tenureMonths?: number; // application-originated loans only
  rateMonthly?: number; // % per month, application-originated loans only
  status: OrderStatus;
  // Collection VPA / payee for this loan. Empty means "use the collection UPI
  // from Settings", so repayment details follow the operator's configuration.
  upiId: string;
  payeeName: string;
  dueDate: string; // ISO timestamp (end of the due day, IST)
  createdAt: string;
  createdBy?: string; // admin id, for operator-created loans
  updatedAt?: string;
  paidAt?: string;
  applicationId?: string; // origin application, if created from one
  // Marked paid by an operator without a customer payment/UTR.
  settledBy?: string;
  settledByName?: string;
  settledAt?: string;
  settledAmount?: number;
  settlementNote?: string;
  // Cancelled by an operator.
  cancelledBy?: string;
  cancelledByName?: string;
  cancelledAt?: string;
  cancelReason?: string;
  cancelNote?: string;
}

// Loan row joined with its customer and live payment state, for admin lists.
export type OrderRow = Order & {
  customerName?: string;
  customerMobile?: string;
  pendingPaymentId?: string;
  paymentCount: number;
};

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
  amount: number; // amount submitted (the amount due at submission)
  productName?: string; // loan product, denormalised for history
  approvedAmount?: number; // amount verified by the reviewer
  amountDueAtSubmission?: number;
  upiId: string; // collection VPA the customer paid to
  utr: string; // 12-digit UPI transaction reference the customer enters
  payApp?: PayApp; // UPI app, recorded on older submissions
  status: PaymentStatus;
  paymentMethod?: string;
  paymentDate?: string;
  proofImage?: string; // data URI; never selected by list queries
  proofMime?: string;
  proofFilename?: string;
  hasProof?: boolean; // computed by list queries
  previousPaymentId?: string; // earlier rejected attempt for the same loan
  createdAt: string;
  // Audit trail for the manual review decision.
  reviewedBy?: string; // admin id
  reviewedByName?: string; // admin name, denormalised for display
  reviewedAt?: string; // ISO timestamp of approve/reject
  reason?: string; // reason captured on rejection
  reviewNote?: string; // optional explanation shown to the customer
  // Refund trail.
  refundInitiatedAt?: string;
  refundInitiatedBy?: string;
  refundInitiatedByName?: string;
  refundedAt?: string;
  refundedBy?: string;
  refundedByName?: string;
  refundReference?: string;
  refundNote?: string;
}

// Payment row joined with its customer, for admin lists.
export type PaymentRow = Payment & {
  customerName?: string;
  customerMobile?: string;
  customerCode?: string;
  productName?: string;
};

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

export interface AuditLog {
  id: string;
  action: string;
  userType: "admin" | "customer" | "system";
  userId: string;
  userName: string;
  customerId?: string;
  orderId?: string;
  paymentId?: string;
  reason?: string;
  details?: string;
  createdAt: string;
}

export type NotificationKind =
  | "account_created"
  | "password_set"
  | "payment_submitted"
  | "payment_approved"
  | "payment_rejected"
  | "repayment_required"
  | "refund_pending"
  | "refunded"
  | "loan_paid"
  | "loan_cancelled"
  | "application_approved"
  | "application_rejected";

export interface Notification {
  id: string;
  customerId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  paymentId?: string;
  orderId?: string;
  readAt?: string;
  createdAt: string;
}
