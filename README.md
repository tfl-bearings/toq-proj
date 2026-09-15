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
| `/home` | Dashboard: greeting, quick actions, virtual card, loan products |
| `/loan/[id]` | Loan product detail: amount range, why-us, reviews, FAQ |
| `/orders` | Your loans with filter tabs (Due / Under review / Completed) |
| `/repay/[orderId]` | UPI QR + copyable UPI ID + countdown + UTR proof form |
| `/loan/[id]/apply` | **Apply for a loan** — amount, tenure, purpose (with live repayable estimate) |
| `/profile`, `/profile/edit` | View + edit name/email (mobile is the login ID) |
| `/about`, `/faq`, `/support` | Info pages |

### Operator console (`/admin`)

| Route | Page |
|-------|------|
| `/admin/login` | Operator sign-in (DB-backed, hashed, seeded from env) |
| `/admin` | Dashboard: customers, active loans, pending applications, pending reviews, outstanding |
| `/admin/applications` | **Application review** — edit product/amount/tenure, then approve (creates the loan) or reject with a reason |
| `/admin/loans/new` | **Create a loan** directly for any customer |
| `/admin/payments` | **UTR review queue** — approve (closes loan) / reject (with reason); logs who + when |
| `/admin/orders` | All loans and their status |
| `/admin/customers` | All registered customers |
| `/admin/settings` | **App name + theme color** (preset swatches / picker), collection UPI/payee, support contact — all applied live |

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
Admin can also create a loan directly (/admin/loans/new)
        │
Customer repays the loan by UPI + UTR  ─►  Payment (review)
        │
Admin approves the payment (/admin/payments)  ─►  Loan paid & closed
```

Each customer can hold **multiple applications and multiple loans**, tracked
independently. Total repayable = `principal + principal × rateMonthly% ×
tenureMonths` (single lump-sum repayment).

Two roles (`owner` / `staff`). Approvals and rejections are recorded against the
acting admin — a real audit trail, since this screen moves money.

## Architecture

- **UI**: the original theme's CSS is ported verbatim into `src/app/globals.css`
  (same `mloan-*` class names), primary color `#66c4ff`.
- **Auth**: mobile-number login with a `scrypt`-hashed password (Node built-in,
  no external crypto dep) and an httpOnly session cookie (`src/lib/session.ts`).
- **Data**: a tiny JSON-file store at `data/db.json`, seeded on first read
  (`src/lib/db.ts`). Swap it for a real database in production.
- **Mutations**: React 19 **Server Actions** in `src/app/actions.ts`
  (login/register, logout, profile update, repayment submission), consumed with
  `useActionState`.
- **Repayment**: `src/lib/upi.ts` builds a standard `upi://pay?...` deep link and
  renders it as a QR (`qrcode`). Submitting a UTR records the payment as
  **`review`** — it is **never auto-approved**; a human verifies it against the
  bank statement.

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

# toq-proj
