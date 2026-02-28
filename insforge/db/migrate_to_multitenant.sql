-- =============================================================================
-- Migration : Transformation mono-tenant → multi-tenant
-- À exécuter UNE SEULE FOIS sur une base de données existante
-- =============================================================================

-- 1. Créer une clinique par défaut pour les données existantes
INSERT INTO clinics (id, name, slug, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Ma Clinique',
  'ma-clinique',
  'active'
) ON CONFLICT (id) DO NOTHING;

-- 2. Créer un abonnement enterprise actif pour cette clinique
INSERT INTO subscriptions (clinic_id, plan, status, trial_ends_at, current_period_end)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'enterprise',
  'active',
  NULL,
  (NOW() + INTERVAL '1 year')
) ON CONFLICT DO NOTHING;

-- 3. Assigner toutes les données existantes à cette clinique
UPDATE clinic_staff        SET clinic_id = '00000000-0000-0000-0000-000000000001' WHERE clinic_id IS NULL;
UPDATE clinic_patients     SET clinic_id = '00000000-0000-0000-0000-000000000001' WHERE clinic_id IS NULL;
UPDATE clinic_appointments SET clinic_id = '00000000-0000-0000-0000-000000000001' WHERE clinic_id IS NULL;
UPDATE clinic_dossiers     SET clinic_id = '00000000-0000-0000-0000-000000000001' WHERE clinic_id IS NULL;
UPDATE chat_conversations  SET clinic_id = '00000000-0000-0000-0000-000000000001' WHERE clinic_id IS NULL;
UPDATE logs                SET clinic_id = '00000000-0000-0000-0000-000000000001' WHERE clinic_id IS NULL;

-- 4. Assigner les paramètres clinique existants
UPDATE clinic_settings
  SET clinic_id = '00000000-0000-0000-0000-000000000001'
WHERE clinic_id IS NULL
  AND id = (SELECT id FROM clinic_settings WHERE clinic_id IS NULL LIMIT 1);

-- 5. Créer clinic_users pour tous les utilisateurs existants (propriétaires)
INSERT INTO clinic_users (user_id, clinic_id, role)
SELECT id, '00000000-0000-0000-0000-000000000001', 'owner'
FROM auth_users
ON CONFLICT (user_id, clinic_id) DO NOTHING;

-- Vérification
SELECT 'clinics'        AS tbl, count(*) FROM clinics
UNION ALL SELECT 'subscriptions', count(*) FROM subscriptions
UNION ALL SELECT 'clinic_users', count(*) FROM clinic_users
UNION ALL SELECT 'clinic_staff', count(*) FROM clinic_staff WHERE clinic_id IS NOT NULL
UNION ALL SELECT 'clinic_patients', count(*) FROM clinic_patients WHERE clinic_id IS NOT NULL
UNION ALL SELECT 'clinic_appointments', count(*) FROM clinic_appointments WHERE clinic_id IS NOT NULL;
