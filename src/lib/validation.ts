// Input validation shared by customer and operator Server Actions.

export const MOBILE_RE = /^[6-9][0-9]{9}$/;
export const UTR_RE = /^[0-9]{12}$/;
// UPI VPA: handle@provider (NPCI allows letters, digits, dot, hyphen, underscore).
export const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const PAYMENT_METHODS = ["UPI", "Bank transfer", "Cash"] as const;

export function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function validateCustomerFields(input: {
  name: string;
  mobile: string;
  email: string;
  upiId: string;
  paymentMethod: string;
}): string | null {
  if (input.name.length < 2 || input.name.length > 80) {
    return "Enter the customer's name (2–80 characters).";
  }
  if (!MOBILE_RE.test(input.mobile)) {
    return "Enter a valid 10-digit Indian mobile number (starts with 6–9).";
  }
  if (input.email && !EMAIL_RE.test(input.email)) {
    return "Enter a valid email address or leave it blank.";
  }
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.paymentMethod)) {
    return "Choose a payment method.";
  }
  if (input.upiId && !UPI_RE.test(input.upiId)) {
    return "Enter a valid UPI ID like name@bank, or leave it blank.";
  }
  if (input.paymentMethod === "UPI" && !input.upiId) {
    return "Enter the customer's UPI ID for the UPI payment method.";
  }
  return null;
}

export function validatePassword(password: string, confirm: string): string | null {
  if (password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  }
  if (password.length > PASSWORD_MAX) {
    return `Password must be at most ${PASSWORD_MAX} characters.`;
  }
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

// Escape LIKE wildcards so a search for "50%" matches literally.
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
