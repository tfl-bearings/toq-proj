-- Optional: the app creates and migrates this schema itself on first request
-- (src/lib/db.ts, migrate()). Run this script to provision a database ahead of
-- time. Records keep the domain shape in jsonb; every statement is idempotent.

CREATE TABLE IF NOT EXISTS customers (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS products (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS orders (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS payments (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS applications (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS admins (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS admin_sessions (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS settings (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_logs (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS notifications (id text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS customers_mobile_idx ON customers ((data->>'mobile'));
CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders ((data->>'customerId'));
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments ((data->>'orderId'));
CREATE INDEX IF NOT EXISTS applications_customer_idx ON applications ((data->>'customerId'));
CREATE INDEX IF NOT EXISTS customers_invite_idx ON customers ((data->>'inviteToken'));
CREATE INDEX IF NOT EXISTS payments_customer_idx ON payments ((data->>'customerId'));
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments ((data->>'status'));
CREATE INDEX IF NOT EXISTS payments_utr_idx ON payments ((data->>'utr'));
CREATE INDEX IF NOT EXISTS audit_logs_customer_idx ON audit_logs ((data->>'customerId'));
CREATE INDEX IF NOT EXISTS audit_logs_payment_idx ON audit_logs ((data->>'paymentId'));
CREATE INDEX IF NOT EXISTS notifications_customer_idx ON notifications ((data->>'customerId'));

-- Integrity guards (the app also creates these on startup, see src/lib/db.ts).
CREATE UNIQUE INDEX IF NOT EXISTS customers_mobile_uidx ON customers ((data->>'mobile'));
CREATE UNIQUE INDEX IF NOT EXISTS payments_utr_live_uidx ON payments ((data->>'utr')) WHERE data->>'status' IN ('pending', 'approved', 'refund_pending', 'refunded');
CREATE UNIQUE INDEX IF NOT EXISTS payments_order_pending_uidx ON payments ((data->>'orderId')) WHERE data->>'status' = 'pending';

INSERT INTO settings (id, data) VALUES ('global', '{"appName":"Rupee Money","themeColor":"#66c4ff","upiId":"rupeemoney.collect@upi","payeeName":"Rupee Money","supportEmail":"support@toqcredit.example","supportPhone":"1800-000-000"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, data) VALUES
('p_personal', '{"id":"p_personal","name":"Personal Loan","icon":"💵","min":5000,"max":200000,"tenureMonths":12,"rateMonthly":1.5,"badge":"Popular"}'::jsonb),
('p_instant', '{"id":"p_instant","name":"Instant Cash","icon":"⚡","min":1000,"max":50000,"tenureMonths":3,"rateMonthly":2}'::jsonb),
('p_business', '{"id":"p_business","name":"Business Loan","icon":"🏪","min":25000,"max":500000,"tenureMonths":24,"rateMonthly":1.3}'::jsonb),
('p_gold', '{"id":"p_gold","name":"Gold Loan","icon":"🪙","min":10000,"max":300000,"tenureMonths":12,"rateMonthly":1.1}'::jsonb),
('p_education', '{"id":"p_education","name":"Education Loan","icon":"🎓","min":20000,"max":400000,"tenureMonths":36,"rateMonthly":1}'::jsonb),
('p_home', '{"id":"p_home","name":"Home Improvement","icon":"🏠","min":30000,"max":600000,"tenureMonths":36,"rateMonthly":1.2}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Demo records are safe, non-financial sample data. The app creates the demo
-- customer/admin password hashes with Node scrypt when those tables are empty.
INSERT INTO customers (id, data) VALUES ('cust_demo', '{"id":"cust_demo","mobile":"7688888884","name":"dikshant","email":"","passwordHash":"","passwordSalt":"","createdAt":"2026-01-01T00:00:00.000Z"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
INSERT INTO orders (id, data) VALUES ('ord_demo', '{"id":"ord_demo","customerId":"cust_demo","productId":"p_personal","productName":"Personal Loan","principal":25000,"amountDue":2599,"tenureMonths":12,"rateMonthly":1.5,"status":"due","upiId":"rupeemoney.collect@upi","payeeName":"Rupee Money","dueDate":"2026-12-31T00:00:00.000Z","createdAt":"2026-01-01T00:00:00.000Z"}'::jsonb)
ON CONFLICT (id) DO NOTHING;