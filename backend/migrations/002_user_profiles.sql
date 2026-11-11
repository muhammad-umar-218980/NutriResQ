-- 002_user_profiles.sql
-- One profile row per non-admin account, shaped by portal.

CREATE TABLE IF NOT EXISTS donor_profiles (
  user_id             uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  business_name       text NOT NULL,
  business_type       text NOT NULL,
  representative_name text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT donor_profiles_business_name_check CHECK (length(btrim(business_name)) > 0)
);

CREATE TABLE IF NOT EXISTS recipient_profiles (
  user_id             uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  organization_name   text NOT NULL,
  organization_type   text NOT NULL,
  representative_name text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recipient_profiles_org_name_check CHECK (length(btrim(organization_name)) > 0)
);

CREATE TABLE IF NOT EXISTS delivery_profiles (
  user_id            uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  company_name       text NOT NULL,
  business_type      text NOT NULL,
  fleet_manager_name text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_profiles_company_name_check CHECK (length(btrim(company_name)) > 0)
);
