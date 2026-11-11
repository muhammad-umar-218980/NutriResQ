-- 001_users.sql
-- Authentication identity table. Kept separate from the scenario/domain tables
-- (see BACKEND_SCHEMA.md section 9): this table holds credentials and account
-- status only, never operational food-rescue data.

CREATE TABLE IF NOT EXISTS users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL,
  phone             text,
  password_hash     text NOT NULL,
  role              text NOT NULL,
  status            text NOT NULL DEFAULT 'active',
  email_verified_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check
    CHECK (role IN ('donor', 'recipient', 'delivery', 'admin')),
  CONSTRAINT users_status_check
    CHECK (status IN ('active', 'suspended')),
  CONSTRAINT users_email_shape
    CHECK (position('@' IN email) > 1 AND length(btrim(email)) <= 254)
);

-- Case-insensitive uniqueness without relying on the citext extension.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_role_status_idx ON users (role, status);
