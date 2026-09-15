import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "./auth";
import type {
  Admin,
  Application,
  Customer,
  Order,
  Payment,
  Product,
  Session,
  Settings,
} from "./types";

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
  | "settings";

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return neon(url);
}

function rowValue<T>(row: Row | undefined): T | undefined {
  return row?.data as T | undefined;
}

async function find<T>(table: RecordType, id: string): Promise<T | undefined> {
  const rows = await database().query(
    `SELECT data FROM ${table} WHERE id = $1`,
    [id],
  );
  return rowValue<T>(rows[0] as Row | undefined);
}

async function insert(table: RecordType, id: string, data: unknown) {
  await database().query(
    `INSERT INTO ${table} (id, data) VALUES ($1, $2::jsonb)`,
    [id, JSON.stringify(data)],
  );
}

async function update<T extends { id: string }>(
  table: RecordType,
  id: string,
  patch: Partial<T>,
): Promise<T | undefined> {
  const current = await find<T>(table, id);
  if (!current) return undefined;
  const next = { ...current, ...patch };
  await database().query(
    `UPDATE ${table} SET data = $1::jsonb WHERE id = $2`,
    [JSON.stringify(next), id],
  );
  return next;
}

async function all<T>(table: RecordType): Promise<T[]> {
  const rows = await database().query(
    `SELECT data FROM ${table} ORDER BY created_at DESC`,
  );
  return rows.map((row) => (row as Row).data as T);
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

async function ensureDefaults(): Promise<void> {
  const db = database();
  await db.query(
    "INSERT INTO settings (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING",
    ["global", JSON.stringify(defaultSettings())],
  );

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
    await insert("admins", admin.id, admin);
  }

  const demoRows = await db.query(
    "SELECT data FROM customers WHERE id = $1",
    ["cust_demo"],
  );
  const demo = rowValue<Customer>(demoRows[0] as Row | undefined);
  if (demo && !demo.passwordHash) {
    const { hash, salt } = hashPassword("11223344");
    await db.query(
      "UPDATE customers SET data = data || $1::jsonb WHERE id = $2",
      [JSON.stringify({ passwordHash: hash, passwordSalt: salt }), "cust_demo"],
    );
  }
}

export async function getCustomerByMobile(
  mobile: string,
): Promise<Customer | undefined> {
  const rows = await database().query(
    "SELECT data FROM customers WHERE data->>'mobile' = $1 LIMIT 1",
    [mobile],
  );
  return rowValue<Customer>(rows[0] as Row | undefined);
}

export async function getCustomerById(id: string): Promise<Customer | undefined> {
  return find<Customer>("customers", id);
}

export async function createCustomer(input: {
  mobile: string;
  name: string;
  password: string;
}): Promise<Customer> {
  const { hash, salt } = hashPassword(input.password);
  const customer: Customer = {
    id: `cust_${randomUUID().slice(0, 8)}`,
    mobile: input.mobile,
    name: input.name,
    email: "",
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };
  await insert("customers", customer.id, customer);
  return customer;
}

export async function updateCustomer(
  id: string,
  patch: Partial<Pick<Customer, "name" | "mobile" | "email" | "photo">>,
): Promise<Customer | undefined> {
  return update<Customer>("customers", id, patch);
}

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
  await database().query("DELETE FROM sessions WHERE id = $1", [token]);
}

export async function getProducts(): Promise<Product[]> {
  return all<Product>("products");
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return find<Product>("products", id);
}

export async function getOrdersForCustomer(customerId: string): Promise<Order[]> {
  const rows = await database().query(
    "SELECT data FROM orders WHERE data->>'customerId' = $1 ORDER BY created_at DESC",
    [customerId],
  );
  return rows.map((row) => (row as Row).data as Order);
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

export async function createPayment(input: {
  orderId: string;
  customerId: string;
  amount: number;
  upiId: string;
  utr: string;
  payApp: Payment["payApp"];
}): Promise<Payment> {
  const payment: Payment = {
    id: `pay_${randomUUID().slice(0, 8)}`,
    ...input,
    status: "review",
    createdAt: new Date().toISOString(),
  };
  await insert("payments", payment.id, payment);
  return payment;
}

export async function getPaymentsForOrder(orderId: string): Promise<Payment[]> {
  const rows = await database().query(
    "SELECT data FROM payments WHERE data->>'orderId' = $1 ORDER BY created_at DESC",
    [orderId],
  );
  return rows.map((row) => (row as Row).data as Payment);
}

export async function getPayment(id: string): Promise<Payment | undefined> {
  return find<Payment>("payments", id);
}

export async function updatePayment(
  id: string,
  patch: Partial<Payment>,
): Promise<Payment | undefined> {
  return update<Payment>("payments", id, patch);
}

export async function listPayments(): Promise<Payment[]> {
  return all<Payment>("payments");
}

export async function getAdminByUsername(
  username: string,
): Promise<Admin | undefined> {
  const rows = await database().query(
    "SELECT data FROM admins WHERE lower(data->>'username') = lower($1) LIMIT 1",
    [username],
  );
  return rowValue<Admin>(rows[0] as Row | undefined);
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
  await database().query("DELETE FROM admin_sessions WHERE id = $1", [token]);
}

export async function listCustomers(): Promise<Customer[]> {
  return all<Customer>("customers");
}

export async function listAllOrders(): Promise<Order[]> {
  return all<Order>("orders");
}

export async function getSettings(): Promise<Settings> {
  await ensureDefaults();
  return (await find<Settings>("settings", "global")) ?? defaultSettings();
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await database().query("UPDATE settings SET data = $1::jsonb WHERE id = $2", [
    JSON.stringify(next),
    "global",
  ]);
  return next;
}

export async function createOrder(input: {
  customerId: string;
  productId: string;
  productName: string;
  principal: number;
  amountDue: number;
  tenureMonths: number;
  rateMonthly: number;
  dueDate: string;
  upiId?: string;
  payeeName?: string;
  applicationId?: string;
}): Promise<Order> {
  const settings = await getSettings();
  const order: Order = {
    id: `ord_${randomUUID().slice(0, 6)}`,
    customerId: input.customerId,
    productId: input.productId,
    productName: input.productName,
    principal: input.principal,
    amountDue: input.amountDue,
    tenureMonths: input.tenureMonths,
    rateMonthly: input.rateMonthly,
    status: "due",
    upiId: input.upiId ?? settings.upiId,
    payeeName: input.payeeName ?? settings.payeeName,
    dueDate: input.dueDate,
    createdAt: new Date().toISOString(),
    applicationId: input.applicationId,
  };
  await insert("orders", order.id, order);
  return order;
}

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
  const rows = await database().query(
    "SELECT data FROM applications WHERE data->>'customerId' = $1 ORDER BY created_at DESC",
    [customerId],
  );
  return rows.map((row) => (row as Row).data as Application);
}

export async function updateApplication(
  id: string,
  patch: Partial<Application>,
): Promise<Application | undefined> {
  return update<Application>("applications", id, patch);
}
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "./auth";
import type { Admin, Application, Customer, Order, Payment, Product, Session, Settings } from "./types";

type Sql = ReturnType<typeof neon>;
type Row = { data: unknown };

function sql(): Sql { const url = process.env.DATABASE_URL; if (!url) throw new Error("DATABASE_URL is required"); return neon(url); }
function table(name: string): string { if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid database table"); return name; }
function rowValue<T>(row: Row | undefined): T | undefined { return row?.data as T | undefined; }
async function find<T>(name: string, id: string): Promise<T | undefined> { const rows = await sql()(`SELECT data FROM ${table(name)} WHERE id = ${id}`); return rowValue<T>(rows[0] as Row | undefined); }
async function insert(name: string, id: string, data: unknown): Promise<void> { await sql()(`INSERT INTO ${table(name)} (id, data) VALUES (${id}, ${JSON.stringify(data)}::jsonb)`); }
async function update<T extends { id: string }>(name: string, id: string, patch: Partial<T>): Promise<T | undefined> { const current = await find<T>(name, id); if (!current) return undefined; const next = { ...current, ...patch }; await sql()(`UPDATE ${table(name)} SET data = ${JSON.stringify(next)}::jsonb WHERE id = ${id}`); return next; }
async function all<T>(name: string): Promise<T[]> { const rows = await sql()(`SELECT data FROM ${table(name)} ORDER BY created_at DESC`); return rows.map((row) => (row as Row).data as T); }
function defaultSettings(): Settings { return { appName: "Rupee Money", themeColor: "#66c4ff", upiId: "rupeemoney.collect@upi", payeeName: "Rupee Money", supportEmail: "support@toqcredit.example", supportPhone: "1800-000-000" }; }
async function ensureDefaults(): Promise<void> { const db = sql(); if (!(await db`SELECT 1 FROM settings WHERE id = 'global'`).length) await db`INSERT INTO settings (id, data) VALUES ('global', ${JSON.stringify(defaultSettings())}::jsonb)`; if (!(await db`SELECT 1 FROM admins LIMIT 1`).length) { const { hash, salt } = hashPassword(process.env.ADMIN_PASSWORD || "toqadmin123"); const admin: Admin = { id: "admin_owner", username: process.env.ADMIN_USERNAME || "admin", name: "Owner", role: "owner", passwordHash: hash, passwordSalt: salt, createdAt: new Date().toISOString() }; await insert("admins", admin.id, admin); } const demo = await db`SELECT data FROM customers WHERE id = 'cust_demo'`; const demoData = (demo[0] as Row | undefined)?.data as Customer | undefined; if (demoData && !demoData.passwordHash) { const { hash, salt } = hashPassword("11223344"); await db`UPDATE customers SET data = data || ${JSON.stringify({ passwordHash: hash, passwordSalt: salt })}::jsonb WHERE id = 'cust_demo'`; } }
async function ensureDefaults(): Promise<void> { const db = sql(); if (!(await db`SELECT 1 FROM settings WHERE id = 'global'`).length) await db`INSERT INTO settings (id, data) VALUES ('global', ${JSON.stringify(defaultSettings())}::jsonb)`; if (!(await db`SELECT 1 FROM admins LIMIT 1`).length) { const { hash, salt } = hashPassword(process.env.ADMIN_PASSWORD || "toqadmin123"); const admin: Admin = { id: "admin_owner", username: process.env.ADMIN_USERNAME || "admin", name: "Owner", role: "owner", passwordHash: hash, passwordSalt: salt, createdAt: new Date().toISOString() }; await insert("admins", admin.id, admin); } const demo = await db`SELECT data FROM customers WHERE id = 'cust_demo'`; if (demo.length && !(demo[0] as Row).data || (demo[0] as Row | undefined)?.data && !((demo[0] as Row).data as Customer).passwordHash) { const { hash, salt } = hashPassword("11223344"); await db`UPDATE customers SET data = data || ${JSON.stringify({ passwordHash: hash, passwordSalt: salt })}::jsonb WHERE id = 'cust_demo'`; } }

export async function getCustomerByMobile(mobile: string): Promise<Customer | undefined> { const rows = await sql()`SELECT data FROM customers WHERE data->>'mobile' = ${mobile} LIMIT 1`; return rowValue<Customer>(rows[0] as Row | undefined); }
export async function getCustomerById(id: string): Promise<Customer | undefined> { return find<Customer>("customers", id); }
export async function createCustomer(input: { mobile: string; name: string; password: string }): Promise<Customer> { const { hash, salt } = hashPassword(input.password); const customer: Customer = { id: `cust_${randomUUID().slice(0, 8)}`, mobile: input.mobile, name: input.name, email: "", passwordHash: hash, passwordSalt: salt, createdAt: new Date().toISOString() }; await insert("customers", customer.id, customer); return customer; }
export async function updateCustomer(id: string, patch: Partial<Pick<Customer, "name" | "mobile" | "email" | "photo">>): Promise<Customer | undefined> { return update<Customer>("customers", id, patch); }
export async function createSession(token: string, customerId: string): Promise<void> { await insert("sessions", token, { token, customerId, createdAt: new Date().toISOString() }); }
export async function getSession(token: string): Promise<Session | undefined> { return find<Session>("sessions", token); }
export async function deleteSession(token: string): Promise<void> { await sql()`DELETE FROM sessions WHERE id = ${token}`; }
export async function getProducts(): Promise<Product[]> { return all<Product>("products"); }
export async function getProduct(id: string): Promise<Product | undefined> { return find<Product>("products", id); }
export async function getOrdersForCustomer(customerId: string): Promise<Order[]> { const rows = await sql()`SELECT data FROM orders WHERE data->>'customerId' = ${customerId} ORDER BY created_at DESC`; return rows.map((row) => (row as Row).data as Order); }
export async function getOrder(id: string): Promise<Order | undefined> { return find<Order>("orders", id); }
export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order | undefined> { return update<Order>("orders", id, patch); }
export async function createPayment(input: { orderId: string; customerId: string; amount: number; upiId: string; utr: string; payApp: Payment["payApp"] }): Promise<Payment> { const payment: Payment = { id: `pay_${randomUUID().slice(0, 8)}`, ...input, status: "review", createdAt: new Date().toISOString() }; await insert("payments", payment.id, payment); return payment; }
export async function getPaymentsForOrder(orderId: string): Promise<Payment[]> { const rows = await sql()`SELECT data FROM payments WHERE data->>'orderId' = ${orderId} ORDER BY created_at DESC`; return rows.map((row) => (row as Row).data as Payment); }
export async function getPayment(id: string): Promise<Payment | undefined> { return find<Payment>("payments", id); }
export async function updatePayment(id: string, patch: Partial<Payment>): Promise<Payment | undefined> { return update<Payment>("payments", id, patch); }
export async function listPayments(): Promise<Payment[]> { return all<Payment>("payments"); }
export async function getAdminByUsername(username: string): Promise<Admin | undefined> { const rows = await sql()`SELECT data FROM admins WHERE lower(data->>'username') = lower(${username}) LIMIT 1`; return rowValue<Admin>(rows[0] as Row | undefined); }
export async function getAdminById(id: string): Promise<Admin | undefined> { return find<Admin>("admins", id); }
export async function createAdminSession(token: string, adminId: string): Promise<void> { await insert("admin_sessions", token, { token, adminId, createdAt: new Date().toISOString() }); }
export async function getAdminSession(token: string): Promise<{ token: string; adminId: string; createdAt: string } | undefined> { return find("admin_sessions", token); }
export async function deleteAdminSession(token: string): Promise<void> { await sql()`DELETE FROM admin_sessions WHERE id = ${token}`; }
export async function listCustomers(): Promise<Customer[]> { return all<Customer>("customers"); }
export async function listAllOrders(): Promise<Order[]> { return all<Order>("orders"); }
export async function getSettings(): Promise<Settings> { await ensureDefaults(); return (await find<Settings>("settings", "global")) ?? defaultSettings(); }
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> { const next = { ...(await getSettings()), ...patch }; await sql()`UPDATE settings SET data = ${JSON.stringify(next)}::jsonb WHERE id = 'global'`; return next; }
export async function createOrder(input: { customerId: string; productId: string; productName: string; principal: number; amountDue: number; tenureMonths: number; rateMonthly: number; dueDate: string; upiId?: string; payeeName?: string; applicationId?: string }): Promise<Order> { const settings = await getSettings(); const order: Order = { id: `ord_${randomUUID().slice(0, 6)}`, customerId: input.customerId, productId: input.productId, productName: input.productName, principal: input.principal, amountDue: input.amountDue, tenureMonths: input.tenureMonths, rateMonthly: input.rateMonthly, status: "due", upiId: input.upiId ?? settings.upiId, payeeName: input.payeeName ?? settings.payeeName, dueDate: input.dueDate, createdAt: new Date().toISOString(), applicationId: input.applicationId }; await insert("orders", order.id, order); return order; }
export async function createApplication(input: { customerId: string; productId: string; productName: string; amount: number; tenureMonths: number; purpose?: string }): Promise<Application> { const application: Application = { id: `app_${randomUUID().slice(0, 6)}`, ...input, status: "pending", createdAt: new Date().toISOString() }; await insert("applications", application.id, application); return application; }
export async function getApplication(id: string): Promise<Application | undefined> { return find<Application>("applications", id); }
export async function listApplications(): Promise<Application[]> { return all<Application>("applications"); }
export async function getApplicationsForCustomer(customerId: string): Promise<Application[]> { const rows = await sql()`SELECT data FROM applications WHERE data->>'customerId' = ${customerId} ORDER BY created_at DESC`; return rows.map((row) => (row as Row).data as Application); }
export async function updateApplication(id: string, patch: Partial<Application>): Promise<Application | undefined> { return update<Application>("applications", id, patch); }
/*
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "./auth";
import type { Admin, Application, Customer, Order, Payment, Product, Session, Settings } from "./types";

type Sql = ReturnType<typeof neon>;
type Row = { data: unknown };

function sql(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  return neon(url);
}
function table(name: string): string { if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid database table"); return name; }
function rowValue<T>(row: Row | undefined): T | undefined { return row?.data as T | undefined; }
async function find<T>(name: string, id: string): Promise<T | undefined> { const rows = await sql()(`SELECT data FROM ${table(name)} WHERE id = ${id}`); return rowValue<T>(rows[0] as Row | undefined); }
async function insert(name: string, id: string, data: unknown): Promise<void> { await sql()(`INSERT INTO ${table(name)} (id, data) VALUES (${id}, ${JSON.stringify(data)}::jsonb)`); }
async function update<T extends { id: string }>(name: string, id: string, patch: Partial<T>): Promise<T | undefined> { const current = await find<T>(name, id); if (!current) return undefined; const next = { ...current, ...patch }; await sql()(`UPDATE ${table(name)} SET data = ${JSON.stringify(next)}::jsonb WHERE id = ${id}`); return next; }
async function all<T>(name: string): Promise<T[]> { const rows = await sql()(`SELECT data FROM ${table(name)} ORDER BY created_at DESC`); return rows.map((row) => (row as Row).data as T); }

function defaultSettings(): Settings { return { appName: "Rupee Money", themeColor: "#66c4ff", upiId: "rupeemoney.collect@upi", payeeName: "Rupee Money", supportEmail: "support@toqcredit.example", supportPhone: "1800-000-000" }; }
async function ensureDefaults(): Promise<void> {
  const db = sql();
  if (!(await db`SELECT 1 FROM settings WHERE id = 'global'`).length) await db`INSERT INTO settings (id, data) VALUES ('global', ${JSON.stringify(defaultSettings())}::jsonb)`;
  if (!(await db`SELECT 1 FROM admins LIMIT 1`).length) { const { hash, salt } = hashPassword(process.env.ADMIN_PASSWORD || "toqadmin123"); const admin: Admin = { id: "admin_owner", username: process.env.ADMIN_USERNAME || "admin", name: "Owner", role: "owner", passwordHash: hash, passwordSalt: salt, createdAt: new Date().toISOString() }; await insert("admins", admin.id, admin); }
}

export async function getCustomerByMobile(mobile: string): Promise<Customer | undefined> { const rows = await sql()`SELECT data FROM customers WHERE data->>'mobile' = ${mobile} LIMIT 1`; return rowValue<Customer>(rows[0] as Row | undefined); }
export async function getCustomerById(id: string): Promise<Customer | undefined> { return find<Customer>("customers", id); }
export async function createCustomer(input: { mobile: string; name: string; password: string }): Promise<Customer> { const { hash, salt } = hashPassword(input.password); const customer: Customer = { id: `cust_${randomUUID().slice(0, 8)}`, mobile: input.mobile, name: input.name, email: "", passwordHash: hash, passwordSalt: salt, createdAt: new Date().toISOString() }; await insert("customers", customer.id, customer); return customer; }
export async function updateCustomer(id: string, patch: Partial<Pick<Customer, "name" | "mobile" | "email" | "photo">>): Promise<Customer | undefined> { return update<Customer>("customers", id, patch); }
export async function createSession(token: string, customerId: string): Promise<void> { await insert("sessions", token, { token, customerId, createdAt: new Date().toISOString() }); }
export async function getSession(token: string): Promise<Session | undefined> { return find<Session>("sessions", token); }
export async function deleteSession(token: string): Promise<void> { await sql()`DELETE FROM sessions WHERE id = ${token}`; }
export async function getProducts(): Promise<Product[]> { return all<Product>("products"); }
export async function getProduct(id: string): Promise<Product | undefined> { return find<Product>("products", id); }
export async function getOrdersForCustomer(customerId: string): Promise<Order[]> { const rows = await sql()`SELECT data FROM orders WHERE data->>'customerId' = ${customerId} ORDER BY created_at DESC`; return rows.map((row) => (row as Row).data as Order); }
export async function getOrder(id: string): Promise<Order | undefined> { return find<Order>("orders", id); }
export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order | undefined> { return update<Order>("orders", id, patch); }
export async function createPayment(input: { orderId: string; customerId: string; amount: number; upiId: string; utr: string; payApp: Payment["payApp"] }): Promise<Payment> { const payment: Payment = { id: `pay_${randomUUID().slice(0, 8)}`, ...input, status: "review", createdAt: new Date().toISOString() }; await insert("payments", payment.id, payment); return payment; }
export async function getPaymentsForOrder(orderId: string): Promise<Payment[]> { const rows = await sql()`SELECT data FROM payments WHERE data->>'orderId' = ${orderId} ORDER BY created_at DESC`; return rows.map((row) => (row as Row).data as Payment); }
export async function getPayment(id: string): Promise<Payment | undefined> { return find<Payment>("payments", id); }
export async function updatePayment(id: string, patch: Partial<Payment>): Promise<Payment | undefined> { return update<Payment>("payments", id, patch); }
export async function listPayments(): Promise<Payment[]> { return all<Payment>("payments"); }
export async function getAdminByUsername(username: string): Promise<Admin | undefined> { const rows = await sql()`SELECT data FROM admins WHERE lower(data->>'username') = lower(${username}) LIMIT 1`; return rowValue<Admin>(rows[0] as Row | undefined); }
export async function getAdminById(id: string): Promise<Admin | undefined> { return find<Admin>("admins", id); }
export async function createAdminSession(token: string, adminId: string): Promise<void> { await insert("admin_sessions", token, { token, adminId, createdAt: new Date().toISOString() }); }
export async function getAdminSession(token: string): Promise<{ token: string; adminId: string; createdAt: string } | undefined> { return find("admin_sessions", token); }
export async function deleteAdminSession(token: string): Promise<void> { await sql()`DELETE FROM admin_sessions WHERE id = ${token}`; }
export async function listCustomers(): Promise<Customer[]> { return all<Customer>("customers"); }
export async function listAllOrders(): Promise<Order[]> { return all<Order>("orders"); }
export async function getSettings(): Promise<Settings> { await ensureDefaults(); return (await find<Settings>("settings", "global")) ?? defaultSettings(); }
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> { const next = { ...(await getSettings()), ...patch }; await sql()`UPDATE settings SET data = ${JSON.stringify(next)}::jsonb WHERE id = 'global'`; return next; }
export async function createOrder(input: { customerId: string; productId: string; productName: string; principal: number; amountDue: number; tenureMonths: number; rateMonthly: number; dueDate: string; upiId?: string; payeeName?: string; applicationId?: string }): Promise<Order> { const settings = await getSettings(); const order: Order = { id: `ord_${randomUUID().slice(0, 6)}`, customerId: input.customerId, productId: input.productId, productName: input.productName, principal: input.principal, amountDue: input.amountDue, tenureMonths: input.tenureMonths, rateMonthly: input.rateMonthly, status: "due", upiId: input.upiId ?? settings.upiId, payeeName: input.payeeName ?? settings.payeeName, dueDate: input.dueDate, createdAt: new Date().toISOString(), applicationId: input.applicationId }; await insert("orders", order.id, order); return order; }
export async function createApplication(input: { customerId: string; productId: string; productName: string; amount: number; tenureMonths: number; purpose?: string }): Promise<Application> { const application: Application = { id: `app_${randomUUID().slice(0, 6)}`, ...input, status: "pending", createdAt: new Date().toISOString() }; await insert("applications", application.id, application); return application; }
export async function getApplication(id: string): Promise<Application | undefined> { return find<Application>("applications", id); }
export async function listApplications(): Promise<Application[]> { return all<Application>("applications"); }
export async function getApplicationsForCustomer(customerId: string): Promise<Application[]> { const rows = await sql()`SELECT data FROM applications WHERE data->>'customerId' = ${customerId} ORDER BY created_at DESC`; return rows.map((row) => (row as Row).data as Application); }
export async function updateApplication(id: string, patch: Partial<Application>): Promise<Application | undefined> { return update<Application>("applications", id, patch); }import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { hashPassword } from "./auth";
import type {
  Admin,
  Application,
  Customer,
  DB,
  Order,
  Payment,
  Product,
  Session,
  Settings,
} from "./types";

// A tiny JSON-file "database". This is a prototype persistence layer — good
// enough for a single-process dev app. Swap it for a real DB in production.

const DB_FILE =
  process.env.TOQ_DB_FILE ??
  (process.env.VERCEL
    ? path.join("/tmp", "toq-app", "db.json")
    : path.join(process.cwd(), "data", "db.json"));
const DATA_DIR = path.dirname(DB_FILE);

function seed(): DB {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const daysFromNow = (n: number) =>
    new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  // Demo customer mirrors the profile you shared (name + number), so you can
  // sign in to the clone with the same credentials.
  const { hash, salt } = hashPassword("11223344");
  const dikshant: Customer = {
    id: "cust_dikshant",
    mobile: "7688888884",
    name: "dikshant",
    email: "",
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: iso(now),
  };

  const products: Product[] = [
    {
      id: "p_personal",
      name: "Personal Loan",
      icon: "💵",
      min: 5000,
      max: 200000,
      tenureMonths: 12,
      rateMonthly: 1.5,
      badge: "Popular",
    },
    {
      id: "p_instant",
      name: "Instant Cash",
      icon: "⚡",
      min: 1000,
      max: 50000,
      tenureMonths: 3,
      rateMonthly: 2.0,
    },
    {
      id: "p_business",
      name: "Business Loan",
      icon: "🏪",
      min: 25000,
      max: 500000,
      tenureMonths: 24,
      rateMonthly: 1.3,
    },
    {
      id: "p_gold",
      name: "Gold Loan",
      icon: "🪙",
      min: 10000,
      max: 300000,
      tenureMonths: 12,
      rateMonthly: 1.1,
    },
    {
      id: "p_education",
      name: "Education Loan",
      icon: "🎓",
      min: 20000,
      max: 400000,
      tenureMonths: 36,
      rateMonthly: 1.0,
    },
    {
      id: "p_home",
      name: "Home Improvement",
      icon: "🏠",
      min: 30000,
      max: 600000,
      tenureMonths: 36,
      rateMonthly: 1.2,
    },
  ];

  const orders: Order[] = [
    {
      id: "ord_1001",
      customerId: dikshant.id,
      productId: "p_personal",
      productName: "Personal Loan",
      principal: 25000,
      amountDue: 2599,
      tenureMonths: 12,
      rateMonthly: 1.5,
      status: "due",
      upiId: "rupeemoney.collect@upi",
      payeeName: "Rupee Money",
      dueDate: iso(daysFromNow(5)),
      createdAt: iso(daysFromNow(-25)),
    },
    {
      id: "ord_1002",
      customerId: dikshant.id,
      productId: "p_instant",
      productName: "Instant Cash",
      principal: 8000,
      amountDue: 1360,
      tenureMonths: 3,
      rateMonthly: 2.0,
      status: "review",
      upiId: "rupeemoney.collect@upi",
      payeeName: "Rupee Money",
      dueDate: iso(daysFromNow(-1)),
      createdAt: iso(daysFromNow(-31)),
    },
    {
      id: "ord_1003",
      customerId: dikshant.id,
      productId: "p_gold",
      productName: "Gold Loan",
      principal: 15000,
      amountDue: 0,
      tenureMonths: 12,
      rateMonthly: 1.1,
      status: "paid",
      upiId: "rupeemoney.collect@upi",
      payeeName: "Rupee Money",
      dueDate: iso(daysFromNow(-40)),
      createdAt: iso(daysFromNow(-70)),
    },
  ];

  const payments: Payment[] = [
    {
      id: "pay_5001",
      orderId: "ord_1002",
      customerId: dikshant.id,
      amount: 1360,
      upiId: "rupeemoney.collect@upi",
      utr: "402113889077",
      payApp: "phonepe",
      status: "review",
      createdAt: iso(daysFromNow(-1)),
    },
  ];

  const applications: Application[] = [
    {
      id: "app_9001",
      customerId: dikshant.id,
      productId: "p_business",
      productName: "Business Loan",
      amount: 60000,
      tenureMonths: 24,
      purpose: "Expand my shop inventory",
      status: "pending",
      createdAt: iso(daysFromNow(-1)),
    },
  ];

  return {
    customers: [dikshant],
    products,
    orders,
    payments,
    applications,
    sessions: [],
    admins: [seedOwnerAdmin()],
    adminSessions: [],
    settings: defaultSettings(),
  };
}

// First operator account. Credentials come from env in real deploys; a known
// default is used for local dev so you can sign in immediately (change it!).
function seedOwnerAdmin(): Admin {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "toqadmin123";
  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      "[toq-app] No ADMIN_PASSWORD set — seeding default admin login (admin / toqadmin123). Set ADMIN_USERNAME / ADMIN_PASSWORD before deploying.",
    );
  }
  const { hash, salt } = hashPassword(password);
  return {
    id: "admin_owner",
    username,
    name: "Owner",
    role: "owner",
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };
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

function load(): DB {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) {
    const fresh = seed();
    writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
  const db = JSON.parse(readFileSync(DB_FILE, "utf8")) as Partial<DB>;
  // Forward-compat: fill in fields added after an older db.json was written.
  let changed = false;
  if (!db.admins || db.admins.length === 0) {
    db.admins = [seedOwnerAdmin()];
    changed = true;
  }
  if (!db.adminSessions) {
    db.adminSessions = [];
    changed = true;
  }
  if (!db.settings) {
    db.settings = defaultSettings();
    changed = true;
  }
  if (!db.applications) {
    db.applications = [];
    changed = true;
  }
  const full = db as DB;
  if (changed) writeFileSync(DB_FILE, JSON.stringify(full, null, 2), "utf8");
  return full;
}

function save(db: DB): void {
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

// --- Customers ---------------------------------------------------------------

export function getCustomerByMobile(mobile: string): Customer | undefined {
  return load().customers.find((c) => c.mobile === mobile);
}

export function getCustomerById(id: string): Customer | undefined {
  return load().customers.find((c) => c.id === id);
}

export function createCustomer(input: {
  mobile: string;
  name: string;
  password: string;
}): Customer {
  const db = load();
  const { hash, salt } = hashPassword(input.password);
  const customer: Customer = {
    id: `cust_${randomUUID().slice(0, 8)}`,
    mobile: input.mobile,
    name: input.name,
    email: "",
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
  };
  db.customers.push(customer);
  save(db);
  return customer;
}

export function updateCustomer(
  id: string,
  patch: Partial<Pick<Customer, "name" | "mobile" | "email" | "photo">>,
): Customer | undefined {
  const db = load();
  const customer = db.customers.find((c) => c.id === id);
  if (!customer) return undefined;
  Object.assign(customer, patch);
  save(db);
  return customer;
}

// --- Sessions ----------------------------------------------------------------

export function createSession(token: string, customerId: string): void {
  const db = load();
  db.sessions.push({
    token,
    customerId,
    createdAt: new Date().toISOString(),
  });
  save(db);
}

export function getSession(token: string): Session | undefined {
  return load().sessions.find((s) => s.token === token);
}

export function deleteSession(token: string): void {
  const db = load();
  db.sessions = db.sessions.filter((s) => s.token !== token);
  save(db);
}

// --- Products ----------------------------------------------------------------

export function getProducts(): Product[] {
  return load().products;
}

export function getProduct(id: string): Product | undefined {
  return load().products.find((p) => p.id === id);
}

// --- Orders ------------------------------------------------------------------

export function getOrdersForCustomer(customerId: string): Order[] {
  return load()
    .orders.filter((o) => o.customerId === customerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getOrder(id: string): Order | undefined {
  return load().orders.find((o) => o.id === id);
}

export function updateOrder(
  id: string,
  patch: Partial<Order>,
): Order | undefined {
  const db = load();
  const order = db.orders.find((o) => o.id === id);
  if (!order) return undefined;
  Object.assign(order, patch);
  save(db);
  return order;
}

// --- Payments ----------------------------------------------------------------

export function createPayment(input: {
  orderId: string;
  customerId: string;
  amount: number;
  upiId: string;
  utr: string;
  payApp: Payment["payApp"];
}): Payment {
  const db = load();
  const payment: Payment = {
    id: `pay_${randomUUID().slice(0, 8)}`,
    ...input,
    status: "review",
    createdAt: new Date().toISOString(),
  };
  db.payments.push(payment);
  save(db);
  return payment;
}

export function getPaymentsForOrder(orderId: string): Payment[] {
  return load().payments.filter((p) => p.orderId === orderId);
}

export function getPayment(id: string): Payment | undefined {
  return load().payments.find((p) => p.id === id);
}

export function updatePayment(
  id: string,
  patch: Partial<Payment>,
): Payment | undefined {
  const db = load();
  const payment = db.payments.find((p) => p.id === id);
  if (!payment) return undefined;
  Object.assign(payment, patch);
  save(db);
  return payment;
}

export function listPayments(): Payment[] {
  return load().payments.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// --- Admin accounts & sessions ----------------------------------------------

export function getAdminByUsername(username: string): Admin | undefined {
  return load().admins.find(
    (a) => a.username.toLowerCase() === username.toLowerCase(),
  );
}

export function getAdminById(id: string): Admin | undefined {
  return load().admins.find((a) => a.id === id);
}

export function createAdminSession(token: string, adminId: string): void {
  const db = load();
  db.adminSessions.push({
    token,
    adminId,
    createdAt: new Date().toISOString(),
  });
  save(db);
}

export function getAdminSession(token: string) {
  return load().adminSessions.find((s) => s.token === token);
}

export function deleteAdminSession(token: string): void {
  const db = load();
  db.adminSessions = db.adminSessions.filter((s) => s.token !== token);
  save(db);
}

// --- Admin-facing queries ----------------------------------------------------

export function listCustomers(): Customer[] {
  return load().customers.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function listAllOrders(): Order[] {
  return load().orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// --- Settings ----------------------------------------------------------------

export function getSettings(): Settings {
  return load().settings;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const db = load();
  Object.assign(db.settings, patch);
  save(db);
  return db.settings;
}

// --- Loan origination --------------------------------------------------------

export function createOrder(input: {
  customerId: string;
  productId: string;
  productName: string;
  principal: number;
  amountDue: number;
  tenureMonths: number;
  rateMonthly: number;
  dueDate: string;
  upiId?: string;
  payeeName?: string;
  applicationId?: string;
}): Order {
  const db = load();
  const order: Order = {
    id: `ord_${randomUUID().slice(0, 6)}`,
    customerId: input.customerId,
    productId: input.productId,
    productName: input.productName,
    principal: input.principal,
    amountDue: input.amountDue,
    tenureMonths: input.tenureMonths,
    rateMonthly: input.rateMonthly,
    status: "due",
    upiId: input.upiId ?? db.settings.upiId,
    payeeName: input.payeeName ?? db.settings.payeeName,
    dueDate: input.dueDate,
    createdAt: new Date().toISOString(),
    applicationId: input.applicationId,
  };
  db.orders.push(order);
  save(db);
  return order;
}

export function createApplication(input: {
  customerId: string;
  productId: string;
  productName: string;
  amount: number;
  tenureMonths: number;
  purpose?: string;
}): Application {
  const db = load();
  const application: Application = {
    id: `app_${randomUUID().slice(0, 6)}`,
    ...input,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  db.applications.push(application);
  save(db);
  return application;
}

export function getApplication(id: string): Application | undefined {
  return load().applications.find((a) => a.id === id);
}

export function listApplications(): Application[] {
  return load().applications.sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}

export function getApplicationsForCustomer(customerId: string): Application[] {
  return load()
    .applications.filter((a) => a.customerId === customerId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function updateApplication(
  id: string,
  patch: Partial<Application>,
): Application | undefined {
  const db = load();
  const application = db.applications.find((a) => a.id === id);
  if (!application) return undefined;
  Object.assign(application, patch);
  save(db);
  return application;
}
*/
