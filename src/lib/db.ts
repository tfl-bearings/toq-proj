import { randomInt, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashPassword, newToken } from "./auth";
import { likePattern } from "./validation";
import type {
  Admin,
  Application,
  AuditLog,
  Customer,
  CustomerSummary,
  Notification,
  NotificationKind,
  Order,
  OrderRow,
  Payment,
  PaymentRow,
  PaymentStatus,
  Product,
  Session,
  Settings,
} from "./types";

// Every collection is a table of (id, data jsonb, created_at). Records keep the
// app's domain shape in `data`; frequently filtered fields are indexed.

type Row = { data: unknown };
type RecordType =
  | "customers"
  | "products"
  | "orders"
  | "payments"
  | "applications"
  | "sessions"
  | "admins"
  | "admin_sessions"
  | "settings"
  | "audit_logs"
  | "notifications";

const TABLES: RecordType[] = [
  "customers",
  "products",
  "orders",
  "payments",
  "applications",
  "sessions",
  "admins",
  "admin_sessions",
  "settings",
  "audit_logs",
  "notifications",
];

// Bump when migrate() gains new steps; each step must stay idempotent.
const SCHEMA_VERSION = 3;

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Wrong activation codes allowed before the code locks (the operator then
// issues a new one). With 8 digits this keeps guessing odds negligible.
export const ACTIVATION_MAX_ATTEMPTS = 5;

function newActivationCode(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

function database() {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return neon(url);
}

// --- Schema & seed (runs once per server process) ---------------------------

let ready: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (!ready) {
    ready = migrate().catch((error) => {
      ready = null; // retry on the next request
      throw error;
    });
  }
  return ready;
}

async function readyDatabase() {
  await ensureReady();
  return database();
}

function defaultSettings(): Settings {
  return {
    appName: "Rupee Money",
    themeColor: "#66c4ff",
    upiId: "rupeemoney.collect@upi",
    payeeName: "Rupee Money",
    supportEmail: "support@toqcredit.example",
    supportPhone: "1800-000-000",
  };
}

const PRODUCTS: Product[] = [
  { id: "p_personal", name: "Personal Loan", icon: "💵", min: 5000, max: 200000, tenureMonths: 12, rateMonthly: 1.5, badge: "Popular" },
  { id: "p_instant", name: "Instant Cash", icon: "⚡", min: 1000, max: 50000, tenureMonths: 3, rateMonthly: 2 },
  { id: "p_business", name: "Business Loan", icon: "🏪", min: 25000, max: 500000, tenureMonths: 24, rateMonthly: 1.3 },
  { id: "p_gold", name: "Gold Loan", icon: "🪙", min: 10000, max: 300000, tenureMonths: 12, rateMonthly: 1.1 },
  { id: "p_education", name: "Education Loan", icon: "🎓", min: 20000, max: 400000, tenureMonths: 36, rateMonthly: 1 },
  { id: "p_home", name: "Home Improvement", icon: "🏠", min: 30000, max: 600000, tenureMonths: 36, rateMonthly: 1.2 },
];

async function migrate(): Promise<void> {
  const db = database();

  // Version the database is upgrading from (0 = fresh or pre-versioning).
  let fromVersion = 0;
  try {
    const current = await db.query(
      "SELECT data FROM settings WHERE id = 'schema_version'",
    );
    const version = (current[0] as Row | undefined)?.data as
      | { version?: number }
      | undefined;
    fromVersion = version?.version ?? 0;
    if (fromVersion >= SCHEMA_VERSION) return;
  } catch {
    // settings table missing: fresh database, fall through and create it.
  }

  for (const table of TABLES) {
    await db.query(
      `CREATE TABLE IF NOT EXISTS ${table} (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
    );
  }

  const indexes = [
    "CREATE INDEX IF NOT EXISTS customers_mobile_idx ON customers ((data->>'mobile'))",
    "CREATE INDEX IF NOT EXISTS customers_invite_idx ON customers ((data->>'inviteToken'))",
    "CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders ((data->>'customerId'))",
    "CREATE INDEX IF NOT EXISTS payments_order_idx ON payments ((data->>'orderId'))",
    "CREATE INDEX IF NOT EXISTS payments_customer_idx ON payments ((data->>'customerId'))",
    "CREATE INDEX IF NOT EXISTS payments_status_idx ON payments ((data->>'status'))",
    "CREATE INDEX IF NOT EXISTS payments_utr_idx ON payments ((data->>'utr'))",
    "CREATE INDEX IF NOT EXISTS applications_customer_idx ON applications ((data->>'customerId'))",
    "CREATE INDEX IF NOT EXISTS audit_logs_customer_idx ON audit_logs ((data->>'customerId'))",
    "CREATE INDEX IF NOT EXISTS audit_logs_payment_idx ON audit_logs ((data->>'paymentId'))",
    "CREATE INDEX IF NOT EXISTS notifications_customer_idx ON notifications ((data->>'customerId'))",
  ];
  for (const statement of indexes) await db.query(statement);

  // Seeds -------------------------------------------------------------------
  await db.query(
    "INSERT INTO settings (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING",
    ["global", JSON.stringify(defaultSettings())],
  );
  for (const product of PRODUCTS) {
    await db.query(
      "INSERT INTO products (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING",
      [product.id, JSON.stringify(product)],
    );
  }

  const demoRows = await db.query(
    "SELECT 1 FROM customers WHERE data->>'mobile' = $1 LIMIT 1",
    ["7688888884"],
  );
  if (demoRows.length === 0) {
    const { hash, salt } = hashPassword("11223344");
    const now = new Date().toISOString();
    await db.query(
      "INSERT INTO customers (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING",
      [
        "cust_demo",
        JSON.stringify({
          id: "cust_demo",
          mobile: "7688888884",
          name: "dikshant",
          email: "",
          passwordHash: hash,
          passwordSalt: salt,
          status: "active",
          paymentMethod: "UPI",
          upiId: "",
          customerCode: "CUST-DEMO",
          passwordSetAt: now,
          activatedAt: now,
          createdAt: now,
        }),
      ],
    );
  }
  // The SQL seed script inserts the demo customer without a hash.
  const demo = rowValue<Customer>(
    (await db.query("SELECT data FROM customers WHERE id = 'cust_demo'"))[0] as
      | Row
      | undefined,
  );
  if (demo && !demo.passwordHash) {
    const { hash, salt } = hashPassword("11223344");
    await db.query(
      "UPDATE customers SET data = data || $1::jsonb WHERE id = 'cust_demo'",
      [JSON.stringify({ passwordHash: hash, passwordSalt: salt })],
    );
  }

  const admins = await db.query("SELECT 1 FROM admins LIMIT 1");
  if (admins.length === 0) {
    const { hash, salt } = hashPassword(
      process.env.ADMIN_PASSWORD || "toqadmin123",
    );
    const admin: Admin = {
      id: "admin_owner",
      username: process.env.ADMIN_USERNAME || "admin",
      name: "Owner",
      role: "owner",
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString(),
    };
    await db.query(
      "INSERT INTO admins (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING",
      [admin.id, JSON.stringify(admin)],
    );
  }

  // Data migrations -----------------------------------------------------------
  // Payment status vocabulary: review/success/failed -> pending/approved/rejected.
  for (const [from, to] of [
    ["review", "pending"],
    ["success", "approved"],
    ["failed", "rejected"],
  ]) {
    await db.query(
      "UPDATE payments SET data = jsonb_set(data, '{status}', to_jsonb($2::text)) WHERE data->>'status' = $1",
      [from, to],
    );
  }
  // paymentMethod briefly stored the UPI app name.
  await db.query(
    `UPDATE payments SET data = data || '{"paymentMethod":"UPI"}'::jsonb
     WHERE NOT data ? 'paymentMethod' OR data->>'paymentMethod' IN ('phonepe', 'paytm', 'gpay')`,
  );
  // Customers with a password are activated accounts (self-registered or seeded).
  await db.query(
    `UPDATE customers SET data = data || jsonb_build_object(
       'passwordSetAt', data->>'createdAt',
       'activatedAt', COALESCE(data->>'activatedAt', data->>'createdAt'),
       'status', CASE WHEN data->>'status' = 'inactive' THEN 'inactive' ELSE 'active' END)
     WHERE COALESCE(data->>'passwordHash', '') <> '' AND data->>'passwordSetAt' IS NULL`,
  );
  await db.query(
    `UPDATE customers SET data = data || '{"status":"pending"}'::jsonb WHERE NOT data ? 'status'`,
  );
  await db.query(
    `UPDATE customers SET data = data || jsonb_build_object('customerCode', 'CUST-' || upper(regexp_replace(id, '^cust_', '')))
     WHERE COALESCE(data->>'customerCode', '') = ''`,
  );
  // v2 only: before v2 every account got a token that no page used; left on
  // active accounts they would work as silent password-reset links. Later
  // versions issue reset links on purpose, so this must not run again.
  if (fromVersion < 2) {
    await db.query(
      `UPDATE customers SET data = data - 'inviteToken' - 'inviteLink' - 'inviteExpiresAt'
       WHERE data->>'passwordSetAt' IS NOT NULL AND data ? 'inviteToken'`,
    );
  }
  await db.query(
    `UPDATE customers SET data = data || jsonb_build_object('inviteExpiresAt', $1::text)
     WHERE data ? 'inviteToken' AND NOT data ? 'inviteExpiresAt'`,
    [new Date(Date.now() + INVITE_TTL_MS).toISOString()],
  );

  // v3: customer notifications are only for customer-relevant events. Remove
  // the ones that merely echoed operator actions (account created by an
  // operator, loan added by an operator). Self sign-up welcomes stay.
  await db.query(
    `DELETE FROM notifications
     WHERE data->>'kind' = 'loan_created'
        OR (data->>'kind' = 'account_created' AND data->>'title' = 'Your account was created')`,
  );
  // v3: pending access links also get an activation code for main-app setup.
  const needCodes = await db.query(
    "SELECT id FROM customers WHERE data ? 'inviteToken' AND NOT data ? 'activationCode'",
  );
  for (const row of needCodes as { id: string }[]) {
    await db.query(
      "UPDATE customers SET data = data || jsonb_build_object('activationCode', $2::text, 'activationAttempts', 0) WHERE id = $1",
      [row.id, newActivationCode()],
    );
  }

  // Integrity guards. Legacy data could violate one of these; the app-level
  // checks still apply if an index can't be built, so a failure is logged.
  const uniques = [
    "CREATE UNIQUE INDEX IF NOT EXISTS customers_mobile_uidx ON customers ((data->>'mobile'))",
    // A UTR identifies one bank transfer: it can't back two live payments.
    "CREATE UNIQUE INDEX IF NOT EXISTS payments_utr_live_uidx ON payments ((data->>'utr')) WHERE data->>'status' IN ('pending', 'approved', 'refund_pending', 'refunded')",
    // One payment under review per loan at a time.
    "CREATE UNIQUE INDEX IF NOT EXISTS payments_order_pending_uidx ON payments ((data->>'orderId')) WHERE data->>'status' = 'pending'",
  ];
  for (const statement of uniques) {
    try {
      await db.query(statement);
    } catch (error) {
      console.warn(`[db] could not create unique index: ${statement}`, error);
    }
  }

  await db.query(
    `INSERT INTO settings (id, data) VALUES ('schema_version', $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [JSON.stringify({ version: SCHEMA_VERSION })],
  );
}

// --- Query helpers ------------------------------------------------------------

function rowValue<T>(row: Row | undefined): T | undefined {
  return row?.data as T | undefined;
}

async function query(
  text: string,
  params: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  await ensureReady();
  return (await database().query(text, params)) as Record<string, unknown>[];
}

async function rows<T>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await query(text, params)).map((row) => row.data as T);
}

async function find<T>(table: RecordType, id: string): Promise<T | undefined> {
  return (await rows<T>(`SELECT data FROM ${table} WHERE id = $1`, [id]))[0];
}

async function insert(table: RecordType, id: string, data: unknown) {
  await query(`INSERT INTO ${table} (id, data) VALUES ($1, $2::jsonb)`, [
    id,
    JSON.stringify(data),
  ]);
}

// Atomic merge: no read-modify-write, so concurrent patches can't clobber
// each other. `remove` deletes keys.
async function update<T extends { id: string }>(
  table: RecordType,
  id: string,
  patch: Partial<T>,
  remove: string[] = [],
): Promise<T | undefined> {
  return (
    await rows<T>(
      `UPDATE ${table} SET data = (data || $2::jsonb) - $3::text[] WHERE id = $1 RETURNING data`,
      [id, JSON.stringify(patch), remove],
    )
  )[0];
}

async function all<T>(table: RecordType): Promise<T[]> {
  return rows<T>(`SELECT data FROM ${table} ORDER BY created_at DESC`);
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export type Page<T> = { rows: T[]; total: number };

type Reviewer = { id: string; name: string };

function paginate(page: number, pageSize: number) {
  const size = Math.min(Math.max(1, Math.floor(pageSize)), 100);
  const current = Math.max(1, Math.floor(page) || 1);
  return { limit: size, offset: (current - 1) * size };
}

// --- Customers ----------------------------------------------------------------

const CUSTOMER_PUBLIC = "c.data - 'passwordHash' - 'passwordSalt'";

export async function getCustomerByMobile(
  mobile: string,
): Promise<Customer | undefined> {
  return (
    await rows<Customer>(
      "SELECT data FROM customers WHERE data->>'mobile' = $1 LIMIT 1",
      [mobile],
    )
  )[0];
}

export async function getCustomerById(id: string): Promise<Customer | undefined> {
  return find<Customer>("customers", id);
}

export async function getCustomerByInviteToken(
  token: string,
): Promise<Customer | undefined> {
  if (!token) return undefined;
  return (
    await rows<Customer>(
      "SELECT data FROM customers WHERE data->>'inviteToken' = $1 LIMIT 1",
      [token],
    )
  )[0];
}

export async function getCustomersByIds(
  ids: string[],
): Promise<Map<string, CustomerSummary>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const found = await rows<CustomerSummary>(
    `SELECT ${CUSTOMER_PUBLIC} AS data FROM customers c WHERE c.id = ANY($1::text[])`,
    [unique],
  );
  return new Map(found.map((c) => [c.id, c]));
}

export class DuplicateMobileError extends Error {
  constructor() {
    super("A customer with this mobile number already exists.");
  }
}

// One activation credential set: the access link token and the activation
// code are issued, expire and are burned together.
function inviteFields() {
  const now = Date.now();
  return {
    inviteToken: newToken(),
    activationCode: newActivationCode(),
    activationAttempts: 0,
    inviteCreatedAt: new Date(now).toISOString(),
    inviteExpiresAt: new Date(now + INVITE_TTL_MS).toISOString(),
  };
}

// With a password the account is active at once (self-registration); without
// one it is pending and gets a single-use access link for password setup.
export async function createCustomer(input: {
  mobile: string;
  name: string;
  password?: string;
  email?: string;
  upiId?: string;
  paymentMethod?: string;
  createdBy?: string;
}): Promise<Customer> {
  const now = new Date().toISOString();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
  const base = {
    id: `cust_${suffix}`,
    mobile: input.mobile,
    name: input.name,
    email: input.email ?? "",
    paymentMethod: input.paymentMethod ?? "UPI",
    upiId: input.upiId ?? "",
    customerCode: `CUST-${suffix.toUpperCase()}`,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };
  let customer: Customer;
  if (input.password) {
    const { hash, salt } = hashPassword(input.password);
    customer = {
      ...base,
      passwordHash: hash,
      passwordSalt: salt,
      status: "active",
      passwordSetAt: now,
      passwordSetVia: "self_signup",
      activatedAt: now,
    };
  } else {
    customer = {
      ...base,
      passwordHash: "",
      passwordSalt: "",
      status: "pending",
      ...inviteFields(),
    };
  }
  try {
    await insert("customers", customer.id, customer);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateMobileError();
    throw error;
  }
  return customer;
}

type CustomerPatch = Partial<
  Pick<
    Customer,
    | "name"
    | "mobile"
    | "email"
    | "photo"
    | "status"
    | "paymentMethod"
    | "upiId"
    | "lastActivityAt"
    | "lastLoginAt"
    | "deactivatedAt"
  >
>;

export async function updateCustomer(
  id: string,
  patch: CustomerPatch,
  remove: (keyof Customer)[] = [],
): Promise<Customer | undefined> {
  try {
    return await update<Customer>(
      "customers",
      id,
      { ...patch, updatedAt: new Date().toISOString() },
      remove,
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateMobileError();
    throw error;
  }
}

export async function touchCustomer(id: string, login = false): Promise<void> {
  const now = new Date().toISOString();
  await update<Customer>(
    "customers",
    id,
    login ? { lastActivityAt: now, lastLoginAt: now } : { lastActivityAt: now },
  );
}

// Issues a fresh single-use access link, invalidating any previous one.
export async function rotateCustomerInvite(
  id: string,
): Promise<Customer | undefined> {
  return update<Customer>("customers", id, inviteFields(), [
    "inviteOpenedAt",
    "inviteLink",
  ]);
}

// Records the first time the access link is opened. Returns true only once.
export async function markInviteOpened(id: string): Promise<boolean> {
  const updated = await query(
    `UPDATE customers SET data = data || jsonb_build_object('inviteOpenedAt', $2::text)
     WHERE id = $1 AND data->>'inviteOpenedAt' IS NULL RETURNING id`,
    [id, new Date().toISOString()],
  );
  return updated.length > 0;
}

export function inviteIsUsable(customer: Customer): boolean {
  if (!customer.inviteToken || customer.status === "inactive") return false;
  if (!customer.inviteExpiresAt) return true;
  return new Date(customer.inviteExpiresAt).getTime() > Date.now();
}

// Consumes an access link and sets the password in one atomic statement, so a
// link can never be used twice.
export async function completeCustomerInvite(
  token: string,
  password: string,
): Promise<Customer | undefined> {
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();
  return (
    await rows<Customer>(
      `UPDATE customers
       SET data = (data || jsonb_build_object(
         'passwordHash', $2::text,
         'passwordSalt', $3::text,
         'passwordSetAt', $4::text,
         'activatedAt', COALESCE(data->>'activatedAt', $4::text),
         'status', 'active',
         'inviteUsedAt', $4::text,
         'passwordSetVia', 'invite_link',
         'lastActivityAt', $4::text,
         'lastLoginAt', $4::text,
         'updatedAt', $4::text))
         - 'inviteToken' - 'inviteExpiresAt' - 'inviteLink' - 'activationCode' - 'activationAttempts'
       WHERE data->>'inviteToken' = $1
         AND COALESCE(data->>'status', '') <> 'inactive'
         AND (data->>'inviteExpiresAt' IS NULL OR (data->>'inviteExpiresAt')::timestamptz > now())
       RETURNING data`,
      [token, hash, salt, now],
    )
  )[0];
}

// Main-app account setup: mobile number + activation code. Atomic like the
// access link: checks the code, the attempt limit, expiry and status, sets the
// password and burns both the code and the link in one statement.
export async function completeCustomerActivation(
  mobile: string,
  code: string,
  password: string,
): Promise<Customer | undefined> {
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();
  return (
    await rows<Customer>(
      `UPDATE customers
       SET data = (data || jsonb_build_object(
         'passwordHash', $3::text,
         'passwordSalt', $4::text,
         'passwordSetAt', $5::text,
         'activatedAt', COALESCE(data->>'activatedAt', $5::text),
         'status', 'active',
         'inviteUsedAt', $5::text,
         'passwordSetVia', 'activation_code',
         'lastActivityAt', $5::text,
         'lastLoginAt', $5::text,
         'updatedAt', $5::text))
         - 'inviteToken' - 'inviteExpiresAt' - 'inviteLink' - 'activationCode' - 'activationAttempts'
       WHERE data->>'mobile' = $1
         AND data->>'activationCode' = $2
         AND COALESCE((data->>'activationAttempts')::int, 0) < $6
         AND COALESCE(data->>'status', '') <> 'inactive'
         AND (data->>'inviteExpiresAt' IS NULL OR (data->>'inviteExpiresAt')::timestamptz > now())
       RETURNING data`,
      [mobile, code, hash, salt, now, ACTIVATION_MAX_ATTEMPTS],
    )
  )[0];
}

// Counts a wrong activation code against the account. Returns the new count,
// or undefined if that mobile has no activation code outstanding.
export async function recordFailedActivation(mobile: string): Promise<number | undefined> {
  const result = await query(
    `UPDATE customers SET data = data || jsonb_build_object(
       'activationAttempts', COALESCE((data->>'activationAttempts')::int, 0) + 1)
     WHERE data->>'mobile' = $1 AND data ? 'activationCode'
     RETURNING (data->>'activationAttempts')::int AS attempts`,
    [mobile],
  );
  return result.length ? num(result[0].attempts) : undefined;
}

export async function listCustomersAdmin(filters: {
  q?: string;
  status?: string;
  password?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}): Promise<Page<CustomerSummary>> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.q) {
    const p = add(likePattern(filters.q));
    where.push(
      `(c.data->>'name' ILIKE ${p} OR c.data->>'mobile' ILIKE ${p} OR c.data->>'email' ILIKE ${p} OR c.data->>'customerCode' ILIKE ${p} OR c.id ILIKE ${p})`,
    );
  }
  if (filters.status && ["active", "pending", "inactive"].includes(filters.status)) {
    where.push(`c.data->>'status' = ${add(filters.status)}`);
  }
  if (filters.password === "set") {
    where.push("c.data->>'passwordSetAt' IS NOT NULL");
  } else if (filters.password === "not_set") {
    where.push("c.data->>'passwordSetAt' IS NULL AND c.data->>'inviteOpenedAt' IS NULL");
  } else if (filters.password === "pending") {
    where.push("c.data->>'passwordSetAt' IS NULL AND c.data->>'inviteOpenedAt' IS NOT NULL");
  }

  const order =
    {
      oldest: "c.created_at ASC",
      name: "lower(c.data->>'name') ASC, c.created_at DESC",
      activity: "(c.data->>'lastActivityAt') DESC NULLS LAST",
    }[filters.sort ?? ""] ?? "c.created_at DESC";

  const { limit, offset } = paginate(filters.page ?? 1, filters.pageSize ?? 20);
  const result = await query(
    `SELECT ${CUSTOMER_PUBLIC} AS data,
       (SELECT count(*)::int FROM orders o WHERE o.data->>'customerId' = c.id) AS loan_count,
       (SELECT COALESCE(sum((o.data->>'amountDue')::numeric), 0)::float8 FROM orders o
          WHERE o.data->>'customerId' = c.id AND o.data->>'status' IN ('due', 'overdue', 'review')) AS outstanding,
       (SELECT count(*)::int FROM payments p WHERE p.data->>'customerId' = c.id) AS payment_count,
       (SELECT p.data->>'status' FROM payments p WHERE p.data->>'customerId' = c.id
          ORDER BY p.created_at DESC LIMIT 1) AS last_payment_status,
       count(*) OVER()::int AS total
     FROM customers c
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ${order}
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return {
    rows: result.map((row) => ({
      ...(row.data as CustomerSummary),
      loanCount: num(row.loan_count),
      outstanding: num(row.outstanding),
      paymentCount: num(row.payment_count),
      lastPaymentStatus: (row.last_payment_status as PaymentStatus | null) ?? undefined,
    })),
    total: result.length ? num(result[0].total) : 0,
  };
}

// Lightweight list for pickers (no password material).
export async function listCustomers(): Promise<
  Pick<Customer, "id" | "name" | "mobile" | "status" | "customerCode">[]
> {
  return rows(
    `SELECT jsonb_build_object('id', id, 'name', data->>'name', 'mobile', data->>'mobile',
       'status', data->>'status', 'customerCode', data->>'customerCode') AS data
     FROM customers ORDER BY created_at DESC`,
  );
}

export async function customerHasRecords(id: string): Promise<boolean> {
  const result = await query(
    `SELECT EXISTS (SELECT 1 FROM orders WHERE data->>'customerId' = $1)
         OR EXISTS (SELECT 1 FROM payments WHERE data->>'customerId' = $1)
         OR EXISTS (SELECT 1 FROM applications WHERE data->>'customerId' = $1) AS has`,
    [id],
  );
  return Boolean(result[0]?.has);
}

// Hard delete is only allowed for customers without any financial history;
// the check and the delete happen in one statement.
export async function deleteCustomerIfUnused(id: string): Promise<boolean> {
  const results = await (await readyDatabase()).transaction((txn) => [
    txn.query(
      `DELETE FROM customers WHERE id = $1
         AND NOT EXISTS (SELECT 1 FROM orders WHERE data->>'customerId' = $1)
         AND NOT EXISTS (SELECT 1 FROM payments WHERE data->>'customerId' = $1)
         AND NOT EXISTS (SELECT 1 FROM applications WHERE data->>'customerId' = $1)
       RETURNING id`,
      [id],
    ),
    txn.query(
      "DELETE FROM sessions WHERE data->>'customerId' = $1 AND NOT EXISTS (SELECT 1 FROM customers WHERE id = $1)",
      [id],
    ),
    txn.query(
      "DELETE FROM notifications WHERE data->>'customerId' = $1 AND NOT EXISTS (SELECT 1 FROM customers WHERE id = $1)",
      [id],
    ),
  ]);
  return (results[0] as unknown[]).length > 0;
}

// --- Customer sessions --------------------------------------------------------

export async function createSession(token: string, customerId: string) {
  await insert("sessions", token, {
    token,
    customerId,
    createdAt: new Date().toISOString(),
  });
}

export async function getSession(token: string): Promise<Session | undefined> {
  return find<Session>("sessions", token);
}

export async function deleteSession(token: string) {
  await query("DELETE FROM sessions WHERE id = $1", [token]);
}

export async function deleteSessionsForCustomer(customerId: string) {
  await query("DELETE FROM sessions WHERE data->>'customerId' = $1", [customerId]);
}

// --- Products -----------------------------------------------------------------

export async function getProducts(): Promise<Product[]> {
  return all<Product>("products");
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return find<Product>("products", id);
}

// --- Orders (loans) -----------------------------------------------------------

export async function getOrdersForCustomer(customerId: string): Promise<Order[]> {
  return rows<Order>(
    "SELECT data FROM orders WHERE data->>'customerId' = $1 ORDER BY created_at DESC",
    [customerId],
  );
}

export async function getOrder(id: string): Promise<Order | undefined> {
  return find<Order>("orders", id);
}

export async function updateOrder(
  id: string,
  patch: Partial<Order>,
): Promise<Order | undefined> {
  return update<Order>("orders", id, patch);
}

export async function listAllOrders(): Promise<(Order & { customerName?: string })[]> {
  return rows(
    `SELECT o.data || jsonb_build_object('customerName', c.data->>'name') AS data
     FROM orders o LEFT JOIN customers c ON c.id = o.data->>'customerId'
     ORDER BY o.created_at DESC`,
  );
}

// Creates a loan. Without an explicit UPI ID the loan follows the collection
// UPI configured in Settings (see repaymentUpi in lib/loan.ts).
export async function createOrder(input: {
  customerId: string;
  productName: string;
  principal: number;
  amountDue: number;
  dueDate: string;
  productId?: string;
  tenureMonths?: number;
  rateMonthly?: number;
  upiId?: string;
  payeeName?: string;
  applicationId?: string;
  createdBy?: string;
}): Promise<Order> {
  const now = new Date().toISOString();
  const order: Order = {
    id: `ord_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
    customerId: input.customerId,
    productName: input.productName,
    principal: input.principal,
    amountDue: input.amountDue,
    amountPaid: 0,
    status: "due",
    upiId: input.upiId ?? "",
    payeeName: input.payeeName ?? "",
    dueDate: input.dueDate,
    createdAt: now,
    updatedAt: now,
    ...(input.productId ? { productId: input.productId } : {}),
    ...(input.tenureMonths ? { tenureMonths: input.tenureMonths } : {}),
    ...(input.rateMonthly ? { rateMonthly: input.rateMonthly } : {}),
    ...(input.applicationId ? { applicationId: input.applicationId } : {}),
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
  };
  await insert("orders", order.id, order);
  return order;
}

// --- Operator actions on a loan, independent of any payment -------------------

// Marks a loan awaiting payment as paid without a customer payment/UTR (e.g.
// cash or a transfer confirmed outside the app). No payment row is created.
// Refused while a payment is under review, so a submitted UTR is always
// reviewed on its own.
export async function markLoanPaid(input: {
  orderId: string;
  reviewer: Reviewer;
  note?: string;
}): Promise<Order | undefined> {
  const now = new Date().toISOString();
  return (
    await rows<Order>(
      `UPDATE orders o SET data = o.data || jsonb_build_object(
         'status', 'paid',
         'settledAmount', (o.data->>'amountDue')::numeric,
         'amountPaid', COALESCE((o.data->>'amountPaid')::numeric, 0) + (o.data->>'amountDue')::numeric,
         'amountDue', 0,
         'paidAt', $2::text,
         'settledAt', $2::text,
         'settledBy', $3::text,
         'settledByName', $4::text,
         'settlementNote', $5::text,
         'updatedAt', $2::text)
       WHERE o.id = $1 AND o.data->>'status' IN ('due', 'overdue')
         AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.data->>'orderId' = o.id AND p.data->>'status' = 'pending')
       RETURNING o.data`,
      [input.orderId, now, input.reviewer.id, input.reviewer.name, input.note ?? ""],
    )
  )[0];
}

// Cancels a loan awaiting payment. Same guards as markLoanPaid.
export async function cancelLoan(input: {
  orderId: string;
  reviewer: Reviewer;
  reason: string;
  note?: string;
}): Promise<Order | undefined> {
  const now = new Date().toISOString();
  return (
    await rows<Order>(
      `UPDATE orders o SET data = o.data || jsonb_build_object(
         'status', 'cancelled',
         'cancelledAt', $2::text,
         'cancelledBy', $3::text,
         'cancelledByName', $4::text,
         'cancelReason', $5::text,
         'cancelNote', $6::text,
         'updatedAt', $2::text)
       WHERE o.id = $1 AND o.data->>'status' IN ('due', 'overdue')
         AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.data->>'orderId' = o.id AND p.data->>'status' = 'pending')
       RETURNING o.data`,
      [input.orderId, now, input.reviewer.id, input.reviewer.name, input.reason, input.note ?? ""],
    )
  )[0];
}

const ORDER_LIST = `o.data || jsonb_build_object(
  'customerName', c.data->>'name',
  'customerMobile', c.data->>'mobile',
  'pendingPaymentId', (SELECT p.id FROM payments p WHERE p.data->>'orderId' = o.id AND p.data->>'status' = 'pending' LIMIT 1),
  'paymentCount', (SELECT count(*) FROM payments p WHERE p.data->>'orderId' = o.id))`;

const LOAN_VIEW_STATUSES: Record<string, string[]> = {
  awaiting: ["due", "overdue"],
  review: ["review"],
  paid: ["paid"],
  cancelled: ["cancelled"],
};

export async function getOrderRow(id: string): Promise<OrderRow | undefined> {
  const row = (
    await rows<OrderRow>(
      `SELECT ${ORDER_LIST} AS data FROM orders o LEFT JOIN customers c ON c.id = o.data->>'customerId' WHERE o.id = $1`,
      [id],
    )
  )[0];
  return row && { ...row, paymentCount: num(row.paymentCount), pendingPaymentId: row.pendingPaymentId ?? undefined };
}

export async function listOrdersAdmin(filters: {
  view?: string;
  q?: string;
  customerId?: string;
  page?: number;
  pageSize?: number;
}): Promise<Page<OrderRow>> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  const statuses = LOAN_VIEW_STATUSES[filters.view ?? ""];
  if (statuses) where.push(`o.data->>'status' = ANY(${add(statuses)}::text[])`);
  if (filters.customerId) where.push(`o.data->>'customerId' = ${add(filters.customerId)}`);
  if (filters.q) {
    const p = add(likePattern(filters.q));
    where.push(
      `(o.id ILIKE ${p} OR o.data->>'productName' ILIKE ${p} OR c.data->>'name' ILIKE ${p} OR c.data->>'mobile' ILIKE ${p} OR c.data->>'customerCode' ILIKE ${p})`,
    );
  }
  // Open loans: soonest due first. Closed loans: most recently changed first.
  const order =
    filters.view === "awaiting" || filters.view === "review"
      ? "(o.data->>'dueDate') ASC, o.created_at ASC"
      : "COALESCE(o.data->>'updatedAt', o.data->>'createdAt') DESC";
  const { limit, offset } = paginate(filters.page ?? 1, filters.pageSize ?? 20);
  const result = await query(
    `SELECT ${ORDER_LIST} AS data, count(*) OVER()::int AS total
     FROM orders o LEFT JOIN customers c ON c.id = o.data->>'customerId'
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ${order}
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return {
    rows: result.map((row) => {
      const data = row.data as OrderRow;
      return { ...data, paymentCount: num(data.paymentCount), pendingPaymentId: data.pendingPaymentId ?? undefined };
    }),
    total: result.length ? num(result[0].total) : 0,
  };
}

export async function loanViewCounts(): Promise<Record<string, number>> {
  const result = await query(
    `SELECT CASE data->>'status' WHEN 'due' THEN 'awaiting' WHEN 'overdue' THEN 'awaiting' ELSE data->>'status' END AS view,
       count(*)::int AS n FROM orders GROUP BY 1`,
  );
  const counts: Record<string, number> = { awaiting: 0, review: 0, paid: 0, cancelled: 0, all: 0 };
  for (const row of result) {
    counts[String(row.view)] = num(row.n);
    counts.all += num(row.n);
  }
  return counts;
}

// --- Payments -----------------------------------------------------------------

// Every list query drops the screenshot payload (up to 5 MB each); it is only
// read by the authenticated proof endpoint.
const PAYMENT_LIST = `(p.data - 'proofImage') || jsonb_build_object(
  'hasProof', COALESCE(p.data->>'proofImage', '') <> '',
  'customerName', c.data->>'name',
  'customerMobile', c.data->>'mobile',
  'customerCode', c.data->>'customerCode',
  'productName', o.data->>'productName')`;
const PAYMENT_JOINS = `LEFT JOIN customers c ON c.id = p.data->>'customerId'
  LEFT JOIN orders o ON o.id = p.data->>'orderId'`;

export class DuplicatePaymentError extends Error {
  constructor(public kind: "utr" | "order") {
    super(
      kind === "utr"
        ? "This UTR has already been submitted for another payment."
        : "A payment for this loan is already under review.",
    );
  }
}

export async function createPayment(input: {
  orderId: string;
  customerId: string;
  amount: number;
  amountDueAtSubmission: number;
  productName: string;
  upiId: string;
  utr: string;
  payApp?: Payment["payApp"];
  paymentDate: string;
  proofImage?: string;
  proofMime?: string;
  proofFilename?: string;
  previousPaymentId?: string;
}): Promise<Payment> {
  const payment: Payment = {
    id: `pay_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
    ...input,
    status: "pending",
    paymentMethod: "UPI",
    createdAt: new Date().toISOString(),
  };
  let inserted: unknown[];
  try {
    // Claim the loan first: only a loan still awaiting payment (and owned by
    // this customer) moves to review. The payment row is inserted only if this
    // very submission made that move, so a UTR can never reopen a loan an
    // operator has just marked paid or cancelled, and concurrent submissions
    // can't both land.
    const [, insertRows] = await (await readyDatabase()).transaction((txn) => [
      txn.query(
        `UPDATE orders SET data = data || jsonb_build_object(
           'status', 'review', 'reviewPaymentId', $3::text, 'updatedAt', $4::text)
         WHERE id = $1 AND data->>'customerId' = $2 AND data->>'status' IN ('due', 'overdue')`,
        [payment.orderId, payment.customerId, payment.id, payment.createdAt],
      ),
      txn.query(
        `INSERT INTO payments (id, data)
         SELECT $1, $2::jsonb WHERE EXISTS (
           SELECT 1 FROM orders WHERE id = $3 AND data->>'reviewPaymentId' = $1 AND data->>'status' = 'review')
         RETURNING id`,
        [payment.id, JSON.stringify(payment), payment.orderId],
      ),
    ]);
    inserted = insertRows as unknown[];
  } catch (error) {
    if (isUniqueViolation(error)) {
      const constraint = String((error as { constraint?: string }).constraint ?? "");
      throw new DuplicatePaymentError(constraint.includes("order") ? "order" : "utr");
    }
    throw error;
  }
  if (inserted.length === 0) throw new LoanNotPayableError();
  return payment;
}

// The loan is no longer awaiting payment (paid, cancelled or under review).
export class LoanNotPayableError extends Error {
  constructor() {
    super("This loan is no longer accepting payments. Refresh to see its current status.");
  }
}

// A UTR still attached to a live (not rejected) payment.
export async function findLivePaymentByUtr(utr: string): Promise<Payment | undefined> {
  return (
    await rows<Payment>(
      `SELECT data - 'proofImage' AS data FROM payments
       WHERE data->>'utr' = $1 AND data->>'status' IN ('pending', 'approved', 'refund_pending', 'refunded')
       LIMIT 1`,
      [utr],
    )
  )[0];
}

export async function getPaymentsForOrder(orderId: string): Promise<Payment[]> {
  return rows<Payment>(
    `SELECT (data - 'proofImage') || jsonb_build_object('hasProof', COALESCE(data->>'proofImage', '') <> '') AS data
     FROM payments WHERE data->>'orderId' = $1 ORDER BY created_at DESC`,
    [orderId],
  );
}

export async function getPayment(id: string): Promise<PaymentRow | undefined> {
  return (
    await rows<PaymentRow>(
      `SELECT ${PAYMENT_LIST} AS data FROM payments p ${PAYMENT_JOINS} WHERE p.id = $1`,
      [id],
    )
  )[0];
}

export async function getPaymentProof(
  id: string,
): Promise<{ proofImage?: string; proofFilename?: string } | undefined> {
  return (
    await rows<{ proofImage?: string; proofFilename?: string }>(
      `SELECT jsonb_build_object('proofImage', data->>'proofImage', 'proofFilename', data->>'proofFilename') AS data
       FROM payments WHERE id = $1`,
      [id],
    )
  )[0];
}

export async function listPaymentsForCustomer(customerId: string): Promise<PaymentRow[]> {
  return rows<PaymentRow>(
    `SELECT ${PAYMENT_LIST} AS data FROM payments p ${PAYMENT_JOINS}
     WHERE p.data->>'customerId' = $1 ORDER BY p.created_at DESC`,
    [customerId],
  );
}

export type PaymentFilters = {
  status?: string;
  q?: string;
  method?: string;
  customerId?: string;
  from?: string; // YYYY-MM-DD (submitted date, IST)
  to?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export async function listPaymentsAdmin(
  filters: PaymentFilters,
): Promise<Page<PaymentRow>> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.status && filters.status !== "all") {
    where.push(`p.data->>'status' = ${add(filters.status)}`);
  }
  if (filters.q) {
    const p = add(likePattern(filters.q));
    where.push(
      `(p.data->>'utr' ILIKE ${p} OR p.id ILIKE ${p} OR p.data->>'orderId' ILIKE ${p} OR c.data->>'name' ILIKE ${p} OR c.data->>'mobile' ILIKE ${p} OR c.data->>'customerCode' ILIKE ${p})`,
    );
  }
  if (filters.method && ["phonepe", "paytm", "gpay"].includes(filters.method)) {
    where.push(`p.data->>'payApp' = ${add(filters.method)}`);
  }
  if (filters.customerId) {
    where.push(`p.data->>'customerId' = ${add(filters.customerId)}`);
  }
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (filters.from && DATE_RE.test(filters.from)) {
    where.push(`p.created_at >= (${add(filters.from)}::date)::timestamp AT TIME ZONE 'Asia/Kolkata'`);
  }
  if (filters.to && DATE_RE.test(filters.to)) {
    where.push(
      `p.created_at < ((${add(filters.to)}::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')`,
    );
  }

  const order =
    {
      date_asc: "p.created_at ASC",
      amount_desc: "(p.data->>'amount')::numeric DESC, p.created_at DESC",
      amount_asc: "(p.data->>'amount')::numeric ASC, p.created_at DESC",
      paid_desc: "(p.data->>'paymentDate') DESC NULLS LAST, p.created_at DESC",
      utr: "p.data->>'utr' ASC",
    }[filters.sort ?? ""] ?? "p.created_at DESC";

  const { limit, offset } = paginate(filters.page ?? 1, filters.pageSize ?? 20);
  const result = await query(
    `SELECT ${PAYMENT_LIST} AS data, count(*) OVER()::int AS total
     FROM payments p ${PAYMENT_JOINS}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ${order}
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return {
    rows: result.map((row) => row.data as PaymentRow),
    total: result.length ? num(result[0].total) : 0,
  };
}

export async function paymentStatusCounts(): Promise<
  Record<PaymentStatus, { count: number; amount: number }>
> {
  const result = await query(
    `SELECT data->>'status' AS status, count(*)::int AS count,
       COALESCE(sum(COALESCE((data->>'approvedAmount')::numeric, (data->>'amount')::numeric)), 0)::float8 AS amount
     FROM payments GROUP BY 1`,
  );
  const counts = {
    pending: { count: 0, amount: 0 },
    approved: { count: 0, amount: 0 },
    rejected: { count: 0, amount: 0 },
    repayment_required: { count: 0, amount: 0 },
    refund_pending: { count: 0, amount: 0 },
    refunded: { count: 0, amount: 0 },
  } satisfies Record<PaymentStatus, { count: number; amount: number }>;
  for (const row of result) {
    const key = row.status as PaymentStatus;
    if (key in counts) counts[key] = { count: num(row.count), amount: num(row.amount) };
  }
  return counts;
}


// Approves a pending payment and applies it to the loan in one transaction.
// The status guard makes a second approval (double click, two operators) a
// no-op instead of a duplicate credit. Returns undefined if not pending.
export async function approvePayment(input: {
  paymentId: string;
  reviewer: Reviewer;
  approvedAmount: number;
  note?: string;
}): Promise<Payment | undefined> {
  const reviewedAt = new Date().toISOString();
  const patch = {
    status: "approved",
    approvedAmount: input.approvedAmount,
    reviewedBy: input.reviewer.id,
    reviewedByName: input.reviewer.name,
    reviewedAt,
    ...(input.note ? { reviewNote: input.note } : {}),
  };
  const [paymentRows] = await (await readyDatabase()).transaction((txn) => [
    txn.query(
      `UPDATE payments SET data = data || $2::jsonb
       WHERE id = $1 AND data->>'status' = 'pending'
       RETURNING data - 'proofImage' AS data`,
      [input.paymentId, JSON.stringify(patch)],
    ),
    txn.query(
      `UPDATE orders o SET data = o.data || jsonb_build_object(
         'amountDue', GREATEST(0, (o.data->>'amountDue')::numeric - $2::numeric),
         'amountPaid', COALESCE((o.data->>'amountPaid')::numeric, 0) + $2::numeric,
         'status', CASE
           WHEN (o.data->>'amountDue')::numeric - $2::numeric <= 0 THEN 'paid'
           WHEN (o.data->>'dueDate')::timestamptz < now() THEN 'overdue'
           ELSE 'due' END,
         'paidAt', CASE
           WHEN (o.data->>'amountDue')::numeric - $2::numeric <= 0 THEN to_jsonb($4::text)
           ELSE COALESCE(o.data->'paidAt', 'null'::jsonb) END,
         'updatedAt', $4::text)
       WHERE o.id = (SELECT p.data->>'orderId' FROM payments p WHERE p.id = $1)
         AND EXISTS (SELECT 1 FROM payments p WHERE p.id = $1
                     AND p.data->>'status' = 'approved' AND p.data->>'reviewedAt' = $4
                     AND p.data->>'reviewedBy' = $3)`,
      [input.paymentId, input.approvedAmount, input.reviewer.id, reviewedAt],
    ),
  ]);
  return rowValue<Payment>((paymentRows as Row[])[0]);
}

// Rejects a pending payment. The loan returns to due/overdue so the customer
// can submit a NEW payment; this record is never overwritten.
export async function rejectPayment(input: {
  paymentId: string;
  reviewer: Reviewer;
  outcome: "rejected" | "repayment_required" | "refund_pending";
  reason: string;
  note?: string;
}): Promise<Payment | undefined> {
  const reviewedAt = new Date().toISOString();
  const patch: Partial<Payment> = {
    status: input.outcome,
    reviewedBy: input.reviewer.id,
    reviewedByName: input.reviewer.name,
    reviewedAt,
    reason: input.reason,
    ...(input.note ? { reviewNote: input.note } : {}),
    ...(input.outcome === "refund_pending"
      ? {
          refundInitiatedAt: reviewedAt,
          refundInitiatedBy: input.reviewer.id,
          refundInitiatedByName: input.reviewer.name,
        }
      : {}),
  };
  const [paymentRows] = await (await readyDatabase()).transaction((txn) => [
    txn.query(
      `UPDATE payments SET data = data || $2::jsonb
       WHERE id = $1 AND data->>'status' = 'pending'
       RETURNING data - 'proofImage' AS data`,
      [input.paymentId, JSON.stringify(patch)],
    ),
    txn.query(
      `UPDATE orders o SET data = o.data || jsonb_build_object(
         'status', CASE WHEN (o.data->>'dueDate')::timestamptz < now() THEN 'overdue' ELSE 'due' END,
         'updatedAt', $2::text)
       WHERE o.id = (SELECT p.data->>'orderId' FROM payments p WHERE p.id = $1)
         AND o.data->>'status' = 'review'
         AND EXISTS (SELECT 1 FROM payments p WHERE p.id = $1
                     AND p.data->>'reviewedAt' = $2 AND p.data->>'reviewedBy' = $3)`,
      [input.paymentId, reviewedAt, input.reviewer.id],
    ),
  ]);
  return rowValue<Payment>((paymentRows as Row[])[0]);
}

export async function initiateRefund(input: {
  paymentId: string;
  reviewer: Reviewer;
  note?: string;
}): Promise<Payment | undefined> {
  const now = new Date().toISOString();
  return (
    await rows<Payment>(
      `UPDATE payments SET data = data || $2::jsonb
       WHERE id = $1 AND data->>'status' IN ('rejected', 'repayment_required')
       RETURNING data - 'proofImage' AS data`,
      [
        input.paymentId,
        JSON.stringify({
          status: "refund_pending",
          refundInitiatedAt: now,
          refundInitiatedBy: input.reviewer.id,
          refundInitiatedByName: input.reviewer.name,
          ...(input.note ? { refundNote: input.note } : {}),
        }),
      ],
    )
  )[0];
}

export async function completeRefund(input: {
  paymentId: string;
  reviewer: Reviewer;
  reference: string;
  refundedAt: string;
  note?: string;
}): Promise<Payment | undefined> {
  return (
    await rows<Payment>(
      `UPDATE payments SET data = data || $2::jsonb
       WHERE id = $1 AND data->>'status' = 'refund_pending'
       RETURNING data - 'proofImage' AS data`,
      [
        input.paymentId,
        JSON.stringify({
          status: "refunded",
          refundedAt: input.refundedAt,
          refundedBy: input.reviewer.id,
          refundedByName: input.reviewer.name,
          refundReference: input.reference,
          ...(input.note ? { refundNote: input.note } : {}),
        }),
      ],
    )
  )[0];
}

// --- Admins -------------------------------------------------------------------

export async function getAdminByUsername(
  username: string,
): Promise<Admin | undefined> {
  return (
    await rows<Admin>(
      "SELECT data FROM admins WHERE lower(data->>'username') = lower($1) LIMIT 1",
      [username],
    )
  )[0];
}

export async function getAdminById(id: string): Promise<Admin | undefined> {
  return find<Admin>("admins", id);
}

export async function createAdminSession(token: string, adminId: string) {
  await insert("admin_sessions", token, {
    token,
    adminId,
    createdAt: new Date().toISOString(),
  });
}

export async function getAdminSession(
  token: string,
): Promise<{ token: string; adminId: string; createdAt: string } | undefined> {
  return find("admin_sessions", token);
}

export async function deleteAdminSession(token: string) {
  await query("DELETE FROM admin_sessions WHERE id = $1", [token]);
}

// --- Dashboard ----------------------------------------------------------------

export async function dashboardStats() {
  const [row] = await query(
    `SELECT
       (SELECT count(*)::int FROM customers) AS customers_total,
       (SELECT count(*)::int FROM customers WHERE data->>'status' = 'active') AS customers_active,
       (SELECT count(*)::int FROM customers WHERE data->>'status' = 'pending') AS customers_pending,
       (SELECT count(*)::int FROM customers WHERE data->>'status' = 'inactive') AS customers_inactive,
       (SELECT count(*)::int FROM applications WHERE data->>'status' = 'pending') AS applications_pending,
       (SELECT count(*)::int FROM orders WHERE data->>'status' NOT IN ('paid', 'cancelled')) AS loans_active,
       (SELECT count(*)::int FROM orders WHERE data->>'status' IN ('due', 'overdue')) AS loans_awaiting,
       (SELECT count(*)::int FROM orders WHERE data->>'status' = 'cancelled') AS loans_cancelled,
       (SELECT COALESCE(sum((data->>'amountDue')::numeric), 0)::float8 FROM orders
          WHERE data->>'status' IN ('due', 'overdue', 'review')) AS outstanding`,
  );
  return {
    customersTotal: num(row.customers_total),
    customersActive: num(row.customers_active),
    customersPending: num(row.customers_pending),
    customersInactive: num(row.customers_inactive),
    applicationsPending: num(row.applications_pending),
    loansActive: num(row.loans_active),
    loansAwaiting: num(row.loans_awaiting),
    loansCancelled: num(row.loans_cancelled),
    outstanding: num(row.outstanding),
    payments: await paymentStatusCounts(),
  };
}

// Counts shown as badges in the operator navigation.
export async function adminNavCounts(): Promise<{ payments: number; applications: number }> {
  const [row] = await query(
    `SELECT
       (SELECT count(*)::int FROM payments WHERE data->>'status' = 'pending') AS payments,
       (SELECT count(*)::int FROM applications WHERE data->>'status' = 'pending') AS applications`,
  );
  return { payments: num(row?.payments), applications: num(row?.applications) };
}

// --- Audit log ------------------------------------------------------------------

export async function createAuditLog(input: {
  action: string;
  userType: AuditLog["userType"];
  userId: string;
  userName: string;
  customerId?: string;
  orderId?: string;
  paymentId?: string;
  reason?: string;
  details?: string;
}): Promise<AuditLog> {
  const log: AuditLog = {
    id: `audit_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  await insert("audit_logs", log.id, log);
  return log;
}

export async function listAuditLogs(filters: {
  customerId?: string;
  paymentId?: string;
  orderId?: string;
  action?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<Page<AuditLog & { customerName?: string }>> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  if (filters.customerId) where.push(`a.data->>'customerId' = ${add(filters.customerId)}`);
  if (filters.paymentId) where.push(`a.data->>'paymentId' = ${add(filters.paymentId)}`);
  if (filters.orderId) where.push(`a.data->>'orderId' = ${add(filters.orderId)}`);
  if (filters.action) where.push(`a.data->>'action' = ${add(filters.action)}`);
  if (filters.q) {
    const p = add(likePattern(filters.q));
    where.push(
      `(a.data->>'userName' ILIKE ${p} OR a.data->>'details' ILIKE ${p} OR a.data->>'reason' ILIKE ${p} OR a.data->>'paymentId' ILIKE ${p} OR c.data->>'name' ILIKE ${p} OR c.data->>'mobile' ILIKE ${p})`,
    );
  }
  const { limit, offset } = paginate(filters.page ?? 1, filters.pageSize ?? 30);
  const result = await query(
    `SELECT a.data || jsonb_build_object('customerName', c.data->>'name') AS data,
       count(*) OVER()::int AS total
     FROM audit_logs a LEFT JOIN customers c ON c.id = a.data->>'customerId'
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY a.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return {
    rows: result.map((row) => row.data as AuditLog & { customerName?: string }),
    total: result.length ? num(result[0].total) : 0,
  };
}

// --- Customer notifications ---------------------------------------------------

export async function createNotification(input: {
  customerId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  paymentId?: string;
  orderId?: string;
}): Promise<void> {
  const notification: Notification = {
    id: `ntf_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  await insert("notifications", notification.id, notification);
}

export async function listNotifications(
  customerId: string,
  limit = 50,
): Promise<Notification[]> {
  return rows<Notification>(
    `SELECT data FROM notifications WHERE data->>'customerId' = $1
     ORDER BY created_at DESC LIMIT ${Math.min(Math.max(1, limit), 200)}`,
    [customerId],
  );
}

export async function countUnreadNotifications(customerId: string): Promise<number> {
  const [row] = await query(
    `SELECT count(*)::int AS count FROM notifications
     WHERE data->>'customerId' = $1 AND data->>'readAt' IS NULL`,
    [customerId],
  );
  return num(row?.count);
}

export async function markNotificationsRead(customerId: string): Promise<void> {
  await query(
    `UPDATE notifications SET data = data || jsonb_build_object('readAt', $2::text)
     WHERE data->>'customerId' = $1 AND data->>'readAt' IS NULL`,
    [customerId, new Date().toISOString()],
  );
}

// --- Settings -----------------------------------------------------------------

export async function getSettings(): Promise<Settings> {
  return (await find<Settings>("settings", "global")) ?? defaultSettings();
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await query("UPDATE settings SET data = $1::jsonb WHERE id = $2", [
    JSON.stringify(next),
    "global",
  ]);
  return next;
}

// Optional uploaded UPI QR (e.g. the merchant QR from the bank). Stored in its
// own settings row so the settings read on every page stays small.
export async function getUpiQrInfo(): Promise<{ updatedAt: string } | undefined> {
  return (
    await rows<{ updatedAt: string }>(
      "SELECT jsonb_build_object('updatedAt', data->>'updatedAt') AS data FROM settings WHERE id = 'upi_qr'",
    )
  )[0];
}

export async function getUpiQrImage(): Promise<string | undefined> {
  return (
    await rows<{ image: string }>("SELECT data FROM settings WHERE id = 'upi_qr'")
  )[0]?.image;
}

export async function setUpiQrImage(image: string): Promise<void> {
  await query(
    `INSERT INTO settings (id, data) VALUES ('upi_qr', $1::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [JSON.stringify({ image, updatedAt: new Date().toISOString() })],
  );
}

export async function clearUpiQrImage(): Promise<void> {
  await query("DELETE FROM settings WHERE id = 'upi_qr'");
}

// --- Loan applications ----------------------------------------------------------

export async function createApplication(input: {
  customerId: string;
  productId: string;
  productName: string;
  amount: number;
  tenureMonths: number;
  purpose?: string;
}): Promise<Application> {
  const application: Application = {
    id: `app_${randomUUID().slice(0, 6)}`,
    ...input,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await insert("applications", application.id, application);
  return application;
}

export async function getApplication(id: string): Promise<Application | undefined> {
  return find<Application>("applications", id);
}

export async function listApplications(): Promise<Application[]> {
  return all<Application>("applications");
}

export async function getApplicationsForCustomer(
  customerId: string,
): Promise<Application[]> {
  return rows<Application>(
    "SELECT data FROM applications WHERE data->>'customerId' = $1 ORDER BY created_at DESC",
    [customerId],
  );
}

// Moves a pending application to a decision exactly once.
export async function decideApplication(
  id: string,
  patch: Partial<Application>,
): Promise<Application | undefined> {
  return (
    await rows<Application>(
      `UPDATE applications SET data = data || $2::jsonb
       WHERE id = $1 AND data->>'status' = 'pending' RETURNING data`,
      [id, JSON.stringify(patch)],
    )
  )[0];
}

export async function updateApplication(
  id: string,
  patch: Partial<Application>,
): Promise<Application | undefined> {
  return update<Application>("applications", id, patch);
}
