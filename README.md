# Toq Credit — Credit Wallet (toq-app)

A mobile-first **loan / credit-wallet management app** built with **Next.js (App
Router) + TypeScript**. It reproduces the structure and look of a reference
mobile-loan PWA — login, dashboard, loan products, profile, and a **UPI + UTR
repayment flow** — rebuilt as an **honest** collection tool.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Set `DATABASE_URL` to the Neon connection string. On its first request the app
creates and migrates its tables itself (`migrate()` in `src/lib/db.ts`,
versioned and idempotent); `scripts/neon-schema.sql` is optional for
provisioning ahead of time. Keep the connection string server-side; it is never
exposed to the browser.

Optional: `APP_URL` (e.g. `https://pay.example.com`) fixes the host used in
customer access links; otherwise the host of the operator's request is used.
`ADMIN_COOKIE_SECRET` signs operator cookies (falls back to `DATABASE_URL`).

Production build:

```bash
npm run build
npm start
```

### Demo customer login

The app seeds one demo customer on first run (matching the reference profile):

| Field | Value |
|-------|-------|
| Mobile | `7688888884` |
| Password | `11223344` |

Signing in with **any other** 10-digit number + an 8+ char password creates a
new account.

### Operator (admin) login — `/admin`

The operator console is at **`/admin`**. On first run an **owner** account is
seeded from environment variables, falling back to a dev default:

| Field | Env var | Dev default |
|-------|---------|-------------|
| Username | `ADMIN_USERNAME` | `admin` |
| Password | `ADMIN_PASSWORD` | `toqadmin123` |

Set real values before deploying:

```bash
ADMIN_USERNAME=you ADMIN_PASSWORD='a-strong-password' npm start
```

## What's inside

| Route | Page |
|-------|------|
| `/login` | Mobile + password sign-in / register (PWA, installable) |
| `/setup` | **First-time setup** from the main app: mobile + 8-digit activation code + new password |
| `/invite/[token]` | First-time setup from the personal access link |
| `/home` | Dashboard: **Pending Loans / Dues** (product, amount, due date, Repay), latest payment status, quick actions, loan products |
| `/loan/[id]` | Loan product detail: amount range, why-us, reviews, FAQ |
| `/orders` | Your loans with filter tabs (Due / Under review / Completed) |
| `/repay/[orderId]` | Product, amount due, due date · UPI ID with **Copy UPI ID** · UPI QR · 12-digit UTR (+ optional screenshot) |
| `/loan/[id]/apply` | **Apply for a loan** — amount, tenure, purpose (with live repayable estimate) |
| `/profile`, `/profile/edit` | View + edit name/email (mobile is the login ID) |
| `/about`, `/faq`, `/support` | Info pages |

### Operator console (`/admin`)

| Route | Page |
|-------|------|
| `/admin/login` | Operator sign-in (DB-backed, hashed, seeded from env) |
| `/admin` | Dashboard: customers, active loans, pending applications, pending reviews, outstanding |
| `/admin/applications` | **Application review** — edit product/amount/tenure, then approve (creates the loan) or reject with a reason |
| `/admin/loans/new` | **Create a loan**: customer, free-text product name, amount and exact due date (optional per-loan UPI ID) |
| `/admin/payments` | **Payment review** — status tabs (PENDING / APPROVED / REJECTED / REPAYMENT_REQUIRED / REFUND_PENDING / REFUNDED), search + filters + pagination; review cards with inline screenshot (zoom/rotate), approve (confirm + verified amount) / reject (reason + next step) |
| `/admin/payments/[id]` | Full payment record, every attempt for the same loan, audit trail, refund actions |
| `/admin/orders` | **Loans**: Awaiting customer payment / Payment submitted / Paid / Cancelled; **Mark Paid**, **Cancel** (reason) or **Keep Pending** without any customer UTR |
| `/admin/orders/[id]` | Loan detail: closure info, every payment attempt, audit trail |
| `/admin/customers` | Customers with search / filters / pagination, account + password status, last payment |
| `/admin/customers/new` | **Create a customer** — issues a personal single-use access link |
| `/admin/customers/[id]` | Profile, password & activation timestamps, access link (copy / WhatsApp / SMS / email / regenerate), edit, deactivate / reactivate / delete, payment history, loans, activity |
| `/admin/activity` | Audit log of operator and customer actions, filterable |
| `/admin/settings` | **App name + theme color**, collection **UPI ID** / payee, optional uploaded **UPI QR image**, support contact — all applied live |

### Dynamic branding

`/admin/settings` changes are persisted and loaded per-request — no hardcoded
name or color:

- **App name** flows to the login hero, home top bar + virtual card, About/
  Support copy, the admin brand, the page `<title>`, and the PWA manifest.
- **Theme color** is injected by the root layout as `--mloan-primary`, so
  buttons, headers, links, tabs, badges and the admin accent all re-theme. A
  contrast-aware `--mloan-on-primary` (WCAG luminance) keeps text legible on any
  chosen color — light picks get dark text automatically.

### Loan origination flow

```
Customer applies (/loan/[id]/apply)  ─►  Application (pending)
        │                                      │
        │                     Admin reviews (/admin/applications):
        │                       • edit product / amount / tenure
        │                       • Approve ─► creates Loan (status: due)   ─► shows on customer dashboard
        │                       • Reject  ─► reason shown to customer
        │
Admin can also create a loan directly (/admin/loans/new):
        │   product name + amount + due date — no rate or tenure
        │
Customer repays the loan by UPI + UTR  ─►  Payment (review)
        │
Admin approves the payment (/admin/payments)  ─►  Loan paid & closed
```

Each customer can hold **multiple applications and multiple loans**, tracked
independently. Total repayable = `principal + principal × rateMonthly% ×
tenureMonths` (single lump-sum repayment).

Two roles (`owner` / `staff`). Approvals and rejections are recorded against the
acting admin — a real audit trail, since this screen moves money. Only the owner
can change settings (the collection UPI ID) or permanently delete a customer.

### Customer & payment workflow

```
Admin creates customer ─► single-use access link (/invite/<token>, 7 days)
        │
Customer opens link ─► sets own password ─► account ACTIVE (link burned)
        │
Customer pays by UPI, submits UTR + amount + date + screenshot ─► PENDING
        │
Admin reviews (screenshot, UTR, amount)
   ├─ Approve ─► APPROVED, loan balance reduced (paid when it reaches 0)
   └─ Reject (reason) ─► REJECTED | REPAYMENT_REQUIRED | REFUND_PENDING
                            │                         └─► mark REFUNDED (ref + date)
                            └─► customer pays again ─► NEW payment record
```

Every attempt is its own record (never overwritten), linked to the attempt it
retries. Review decisions are atomic conditional updates, so a double click or
two operators can't approve twice; a UTR can back only one live payment, and a
loan has at most one payment under review. Each step writes an audit entry and
an in-app notification for the customer (bell on the home screen).

## Architecture

- **UI**: the original theme's CSS is ported verbatim into `src/app/globals.css`
  (same `mloan-*` class names), primary color `#66c4ff`.
- **Auth**: mobile-number login with a `scrypt`-hashed password (Node built-in,
  no external crypto dep) and an httpOnly session cookie (`src/lib/session.ts`).
- **Data**: Neon PostgreSQL via `@neondatabase/serverless`, configured with
  `DATABASE_URL`. Run `scripts/neon-schema.sql` once to create the tables and
  seed products/settings/demo records. The app initializes the demo scrypt
  password hash on first read.
- **Mutations**: React 19 **Server Actions** in `src/app/actions.ts`
  (login/register, logout, profile update, repayment submission), consumed with
  `useActionState`.
- **Repayment**: `src/lib/upi.ts` builds a standard `upi://pay?...` deep link and
  renders it as a QR (`qrcode`). Submitting a UTR records the payment as
  **`pending`** — it is **never auto-approved**; a human verifies it against the
  bank statement. Screenshots (JPG/PNG/WebP, ≤ 4 MB, checked by file content)
  are served only to signed-in operators via `/admin/payments/[id]/proof`.

## Design boundaries (why this is the "honest" version)

This app deliberately **does not** include the manipulative mechanics common to
predatory instant-loan apps:

- No fabricated/inflated balances or fake "urgency" to pressure payment. The
  countdown only reflects UPI QR validity and never threatens the loan.
- **No upfront "processing / release / insurance" fee to receive a loan** — the
  app states plainly that any such request is a scam.
- No harvesting of contacts, photos, or SMS.
- No auto-flipping a submitted payment to "success"/"failed" to fake a lender.

> This is a demonstration build. No real loan is issued and no real money is
> collected. Wire it to a licensed lender's systems and a real payment
> reconciliation process before any production use.

