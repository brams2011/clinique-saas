-- =============================================================================
-- InsForge — Schéma PostgreSQL
-- =============================================================================

-- ─── Rôles PostgREST ──────────────────────────────────────────────────────────
DO $$ BEGIN CREATE ROLE web_anon NOLOGIN; EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN DUPLICATE_OBJECT THEN NULL; END $$;

GRANT web_anon TO postgres;
GRANT authenticated TO postgres;

-- ─── Auth ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_users (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT        UNIQUE NOT NULL,
  password_hash TEXT       NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth_users(id) ON DELETE CASCADE,
  token      TEXT        UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- ─── SaaS — Cliniques (tenants) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinics (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        UNIQUE NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SaaS — Abonnements ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id               UUID  NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT  UNIQUE,
  stripe_subscription_id  TEXT  UNIQUE,
  plan                    TEXT  NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','pro','enterprise')),
  status                  TEXT  NOT NULL DEFAULT 'trialing'
                                CHECK (status IN ('trialing','active','past_due','cancelled','suspended')),
  trial_ends_at           TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SaaS — Membres d'une clinique ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_users (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID  NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  clinic_id  UUID  NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role       TEXT  NOT NULL CHECK (role IN ('owner','admin','practitioner','receptionist')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, clinic_id)
);

-- ─── Chat ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_conversations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID        REFERENCES clinics(id) ON DELETE CASCADE,
  user_id    UUID        REFERENCES auth_users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL DEFAULT 'Nouvelle conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth_users(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT        NOT NULL DEFAULT '',
  image_key       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Clinique ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_staff (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID        REFERENCES clinics(id) ON DELETE CASCADE,
  user_id    UUID        REFERENCES auth_users(id),
  role       TEXT        NOT NULL CHECK (role IN ('admin', 'practitioner', 'receptionist')),
  first_name TEXT        NOT NULL,
  last_name  TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  phone      TEXT,
  specialty  TEXT,
  is_active  BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinic_patients (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id              UUID        REFERENCES clinics(id) ON DELETE CASCADE,
  first_name             TEXT        NOT NULL,
  last_name              TEXT        NOT NULL,
  email                  TEXT,
  phone                  TEXT,
  date_of_birth          DATE,
  gender                 TEXT        CHECK (gender IN ('male', 'female', 'other')),
  address                TEXT,
  city                   TEXT,
  postal_code            TEXT,
  health_card_number     TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  notes                  TEXT,
  is_active              BOOLEAN     DEFAULT true,
  created_by             UUID        REFERENCES auth_users(id),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinic_appointments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id       UUID        REFERENCES clinic_patients(id) ON DELETE CASCADE,
  practitioner_id  UUID        REFERENCES clinic_staff(id),
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ NOT NULL,
  type             TEXT        NOT NULL DEFAULT 'consultation',
  status           TEXT        NOT NULL DEFAULT 'scheduled'
                               CHECK (status IN ('scheduled','confirmed','cancelled','completed','no_show')),
  reason           TEXT,
  notes            TEXT,
  google_event_id  TEXT,
  created_by       UUID        REFERENCES auth_users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinic_dossiers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID        REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id       UUID        REFERENCES clinic_patients(id) ON DELETE CASCADE,
  practitioner_id  UUID        REFERENCES clinic_staff(id),
  appointment_id   UUID        REFERENCES clinic_appointments(id),
  type             TEXT        NOT NULL
                               CHECK (type IN ('note','consultation','prescription','lab_result','imaging','referral','other')),
  title            TEXT        NOT NULL,
  content          TEXT,
  is_confidential  BOOLEAN     DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Paramètres de la clinique ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_settings (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id                  UUID        UNIQUE REFERENCES clinics(id) ON DELETE CASCADE,
  clinic_name                TEXT        NOT NULL DEFAULT 'Ma Clinique',
  clinic_type                TEXT        DEFAULT '',
  responsible_name           TEXT        DEFAULT '',
  responsible_title          TEXT        DEFAULT '',
  phone                      TEXT        DEFAULT '',
  email                      TEXT        DEFAULT '',
  address                    TEXT        DEFAULT '',
  city                       TEXT        DEFAULT '',
  postal_code                TEXT        DEFAULT '',
  country                    TEXT        DEFAULT 'Canada',
  timezone                   TEXT        DEFAULT 'America/Toronto',
  website                    TEXT        DEFAULT '',
  appointment_duration_mins  INT         DEFAULT 30,
  working_hours_start        TEXT        DEFAULT '08:00',
  working_hours_end          TEXT        DEFAULT '18:00',
  working_days               TEXT        DEFAULT '["monday","tuesday","wednesday","thursday","friday"]',
  voice_agent_base_url       TEXT        DEFAULT '',
  elevenlabs_agent_id        TEXT        DEFAULT '',
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);
-- (clinic_settings are created per-clinic during registration)

-- ─── Voice / ElevenLabs (app vocale) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT        UNIQUE,
  name       TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id          UUID        REFERENCES clients(id),
  appointment_id     UUID        REFERENCES clinic_appointments(id),
  transcript         TEXT        NOT NULL DEFAULT '',
  ai_summary         TEXT        DEFAULT '',
  raw_payload        JSONB,
  airtable_record_id TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Logs ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID        REFERENCES clinics(id),
  event_type    TEXT        NOT NULL,
  severity      TEXT        NOT NULL DEFAULT 'info',
  payload       JSONB,
  client_id     UUID,
  function_name TEXT,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Index multi-tenant ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clinic_staff_clinic        ON clinic_staff(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_patients_clinic     ON clinic_patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_appointments_clinic ON clinic_appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_dossiers_clinic     ON clinic_dossiers(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_settings_clinic     ON clinic_settings(clinic_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_clinic  ON chat_conversations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_users_user          ON clinic_users(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_clinic       ON subscriptions(clinic_id);

-- ─── Fonction rate limit (retourne toujours true en dev) ─────────────────────
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip             TEXT,
  p_endpoint       TEXT,
  p_max_hits       INT,
  p_window_seconds INT
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  RETURN true;
END;
$$;

-- ─── Permissions PostgREST ────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO web_anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO web_anon, authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO web_anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO web_anon, authenticated;

-- Future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO web_anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO web_anon, authenticated;
