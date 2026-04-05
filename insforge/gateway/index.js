'use strict';

const express  = require('express');
const cors     = require('cors');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { Pool } = require('pg');
const multer   = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs       = require('fs');
const path     = require('path');
const Stripe   = require('stripe');
const { google } = require('googleapis');

const PORT          = parseInt(process.env.PORT  || '7130');
const JWT_SECRET    = process.env.JWT_SECRET     || 'insforge-dev-secret-change-in-prod';
const JWT_EXPIRY    = parseInt(process.env.JWT_EXPIRY || '3600');
const POSTGREST_URL = process.env.POSTGREST_URL  || 'http://postgrest:3000';
const STORAGE_PATH  = process.env.STORAGE_PATH  || '/data/storage';
const APP_URL       = process.env.APP_URL        || 'http://localhost:5173';

const STRIPE_SECRET          = process.env.STRIPE_SECRET_KEY       || '';
const STRIPE_WEBHOOK_SECRET  = process.env.STRIPE_WEBHOOK_SECRET   || '';
const STRIPE_PRICE_STARTER   = process.env.STRIPE_PRICE_STARTER    || '';
const STRIPE_PRICE_PRO       = process.env.STRIPE_PRICE_PRO        || '';
const STRIPE_PRICE_ENTERPRISE= process.env.STRIPE_PRICE_ENTERPRISE || '';

const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET, { apiVersion: '2023-10-16' }) : null;

// ─── Nodemailer + Patient JWT ──────────────────────────────────────────────────
const nodemailer = require('nodemailer');
const SMTP_HOST          = process.env.SMTP_HOST          || '';
const SMTP_PORT          = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER          = process.env.SMTP_USER          || '';
const SMTP_PASS          = process.env.SMTP_PASS          || '';
const GOOGLE_CLIENT_ID   = process.env.GOOGLE_CLIENT_ID   || '';
const GOOGLE_CLIENT_SEC  = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REFRESH_TOK = process.env.GOOGLE_REFRESH_TOKEN || '';
const GMAIL_USER         = process.env.GMAIL_USER || '';   // ex: bddouk@gmail.com
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

// ─── Google Calendar helper ────────────────────────────────────────────────────
function getGoogleCalendarClient() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SEC || !GOOGLE_REFRESH_TOK) return null;
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SEC);
  auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOK });
  return google.calendar({ version: 'v3', auth });
}

async function createGoogleCalendarEvent(appt) {
  const cal = getGoogleCalendarClient();
  if (!cal) return null;
  try {
    const event = {
      summary: appt.type || 'Rendez-vous',
      description: appt.reason || '',
      start: { dateTime: appt.start_time, timeZone: 'America/Toronto' },
      end:   { dateTime: appt.end_time,   timeZone: 'America/Toronto' },
    };
    if (appt.is_virtual && appt.virtual_meeting_url) {
      event.location = appt.virtual_meeting_url;
    }
    const result = await cal.events.insert({ calendarId: GOOGLE_CALENDAR_ID, resource: event });
    return result.data.id;
  } catch (e) {
    console.error('Google Calendar createEvent:', e.message);
    return null;
  }
}

// Priorité : SMTP explicite → Gmail OAuth2 → pas d'envoi
let mailer = null;
if (SMTP_HOST && SMTP_USER) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
} else if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SEC && GOOGLE_REFRESH_TOK && GMAIL_USER) {
  mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: GMAIL_USER,
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SEC,
      refreshToken: GOOGLE_REFRESH_TOK,
    }
  });
}
const MAIL_FROM = SMTP_USER || GMAIL_USER || 'noreply@cinique.app';
const PATIENT_JWT_SECRET = process.env.PATIENT_JWT_SECRET || JWT_SECRET;

// ─── Square ───────────────────────────────────────────────────────────────────
const { SquareClient, SquareEnvironment: SquareEnv } = require('square');
const SQUARE_ACCESS_TOKEN    = process.env.SQUARE_ACCESS_TOKEN    || '';
const SQUARE_ENVIRONMENT     = process.env.SQUARE_ENVIRONMENT     || 'sandbox';
const SQUARE_LOCATION_ID     = process.env.SQUARE_LOCATION_ID     || '';
const SQUARE_PLAN_STARTER    = process.env.SQUARE_PLAN_STARTER    || '';
const SQUARE_PLAN_PRO        = process.env.SQUARE_PLAN_PRO        || '';
const SQUARE_PLAN_ENTERPRISE = process.env.SQUARE_PLAN_ENTERPRISE || '';
const SQUARE_WEBHOOK_SIG     = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '';

const squareClient = SQUARE_ACCESS_TOKEN ? new SquareClient({
  token: SQUARE_ACCESS_TOKEN,
  environment: SQUARE_ENVIRONMENT === 'production' ? SquareEnv.Production : SquareEnv.Sandbox,
}) : null;

const SQUARE_PLAN_MAP = {};
if (SQUARE_PLAN_STARTER)    SQUARE_PLAN_MAP[SQUARE_PLAN_STARTER]    = 'starter';
if (SQUARE_PLAN_PRO)        SQUARE_PLAN_MAP[SQUARE_PLAN_PRO]        = 'pro';
if (SQUARE_PLAN_ENTERPRISE) SQUARE_PLAN_MAP[SQUARE_PLAN_ENTERPRISE] = 'enterprise';

// Features available per plan
const PLAN_FEATURES = {
  starter:    ['chat', 'appointments'],
  pro:        ['chat', 'appointments', 'sms', 'calendar', 'dossiers', 'billing'],
  enterprise: ['chat', 'appointments', 'sms', 'calendar', 'dossiers', 'voice', 'billing', 'virtual', 'portal'],
};

// Max staff members per plan (including the owner/admin)
const PLAN_STAFF_LIMITS = {
  starter:    2,   // 1 admin + 1 praticien
  pro:        4,   // 1 admin + 3 praticiens
  enterprise: 999, // illimité
};

// Tables that require a specific feature
// Note: clinic_staff is NOT gated — every user needs to read their own profile
// Note: appointments is now included in starter, so clinic_patients/appointments are accessible to all
const TABLE_FEATURE_MAP = {
  clinic_appointments: 'appointments',
  clinic_patients:     'appointments',
  clinic_dossiers:     'dossiers',
  clinic_invoices:     'billing',
};

// Tables that are scoped per clinic (auto-inject clinic_id)
// Note: chat_messages has no clinic_id column — it is isolated via conversation_id FK
const CLINIC_SCOPED_TABLES = new Set([
  'clinic_staff', 'clinic_patients', 'clinic_appointments', 'clinic_dossiers',
  'clinic_settings', 'chat_conversations', 'logs', 'clinic_invoices',
]);

fs.mkdirSync(STORAGE_PATH, { recursive: true });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Authorization','Content-Type','Prefer','X-ElevenLabs-Signature','stripe-signature'],
  exposedHeaders: ['Content-Range'],
}));

// Stripe webhook needs raw body — mount BEFORE express.json()
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json({ limit: '10mb' }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'clinique';
}

async function makeTokens(userId, email, clinicId, plan, role) {
  const payload = { sub: userId, email, clinic_id: clinicId, plan: plan || 'starter', role: role || 'owner' };
  const superRow = await pool.query('SELECT is_super_admin FROM auth_users WHERE id=$1', [userId]);
  if (superRow.rows[0]?.is_super_admin) payload.is_super_admin = true;
  // Super admin gets 8h session, regular users get JWT_EXPIRY (1h)
  const expiry = payload.is_super_admin ? 28800 : JWT_EXPIRY;
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: expiry });
  return { accessToken, refreshToken: uuidv4() };
}

function makePatientToken(patientId, clinicId) {
  return jwt.sign(
    { sub: patientId, patient_id: patientId, clinic_id: clinicId, role: 'patient' },
    PATIENT_JWT_SECRET,
    { expiresIn: 7200 }
  );
}

function requirePatientAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  try {
    const decoded = jwt.verify(token, PATIENT_JWT_SECRET);
    if (decoded.role !== 'patient') throw new Error('not a patient token');
    req.patientId = decoded.patient_id;
    req.clinicId  = decoded.clinic_id;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  try {
    req.user    = jwt.verify(token, JWT_SECRET);
    req.clinicId = req.user.clinic_id;
    req.plan     = req.user.plan    || 'starter';
    req.role     = req.user.role    || 'owner';
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (!req.user?.is_super_admin) return res.status(403).json({ error: 'Forbidden' });
  next();
}

function requireFeature(feature) {
  return (req, res, next) => {
    const allowed = PLAN_FEATURES[req.plan] ?? [];
    if (!allowed.includes(feature)) {
      return res.status(403).json({
        error: 'upgrade_required',
        feature,
        current_plan: req.plan,
        message: `Cette fonctionnalité requiert un forfait supérieur.`,
      });
    }
    next();
  };
}

async function getClinicInfo(userId) {
  const { rows } = await pool.query(
    `SELECT cu.clinic_id, cu.role, s.plan, s.status AS sub_status
       FROM clinic_users cu
       JOIN subscriptions s ON s.clinic_id = cu.clinic_id
      WHERE cu.user_id = $1
      ORDER BY cu.created_at ASC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function saveRefreshToken(userId, refreshToken) {
  const expires = new Date(Date.now() + 30 * 86400_000);
  await pool.query(
    'INSERT INTO auth_refresh_tokens (id, user_id, token, expires_at) VALUES ($1,$2,$3,$4)',
    [uuidv4(), userId, refreshToken, expires]
  );
}

// ─── Auth — Register ──────────────────────────────────────────────────────────

app.post('/api/auth/users', async (req, res) => {
  const { email, password, clinic_name, plan: rawPlan } = req.body || {};
  if (!email || !password)
    return res.status(422).json({ error: 'email et password requis' });

  const clinicName = (clinic_name || '').trim() || 'Ma Clinique';
  const plan = ['starter', 'pro', 'enterprise'].includes(rawPlan) ? rawPlan : 'starter';

  try {
    const hash   = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await pool.query(
      'INSERT INTO auth_users (id, email, password_hash) VALUES ($1, $2, $3)',
      [userId, email.toLowerCase().trim(), hash]
    );

    // Create clinic
    const clinicId = uuidv4();
    let slug = slugify(clinicName);
    // Ensure slug uniqueness
    const { rows: slugRows } = await pool.query('SELECT 1 FROM clinics WHERE slug = $1', [slug]);
    if (slugRows.length) slug = slug + '-' + Date.now().toString(36);
    await pool.query(
      'INSERT INTO clinics (id, name, slug) VALUES ($1, $2, $3)',
      [clinicId, clinicName, slug]
    );

    // Create subscription (14-day trial, selected plan)
    await pool.query(
      'INSERT INTO subscriptions (id, clinic_id, plan, status) VALUES ($1, $2, $3, $4)',
      [uuidv4(), clinicId, plan, 'trialing']
    );

    // Link user to clinic as owner
    await pool.query(
      'INSERT INTO clinic_users (id, user_id, clinic_id, role) VALUES ($1, $2, $3, $4)',
      [uuidv4(), userId, clinicId, 'owner']
    );

    // Create clinic_settings row
    await pool.query(
      'INSERT INTO clinic_settings (id, clinic_id, clinic_name) VALUES ($1, $2, $3)',
      [uuidv4(), clinicId, clinicName]
    );

    // Create admin staff record for this user
    const emailParts = email.split('@')[0].split('.');
    const firstName = emailParts[0] ? emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1) : 'Admin';
    const lastName  = emailParts[1] ? emailParts[1].charAt(0).toUpperCase() + emailParts[1].slice(1) : '';
    await pool.query(
      'INSERT INTO clinic_staff (id, clinic_id, user_id, role, first_name, last_name, email, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,true)',
      [uuidv4(), clinicId, userId, 'admin', firstName, lastName || 'Admin', email.toLowerCase().trim()]
    );

    const { accessToken, refreshToken } = await makeTokens(userId, email, clinicId, plan, 'owner');
    await saveRefreshToken(userId, refreshToken);
    return res.status(201).json({ accessToken, refreshToken });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email déjà utilisé' });
    console.error('Register:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Staff — Invite (crée user + lie à la clinique existante, sans nouvelle clinique) ──

app.post('/api/staff/invite', requireAuth, async (req, res) => {
  const { email, password, first_name, last_name, phone, specialty, role } = req.body || {};
  if (!email || !password || !first_name || !last_name || !role)
    return res.status(422).json({ error: 'Champs requis : email, password, first_name, last_name, role' });

  const VALID_ROLES = ['admin', 'practitioner', 'receptionist'];
  if (!VALID_ROLES.includes(role))
    return res.status(422).json({ error: 'Rôle invalide' });

  const clinicId = req.clinicId;
  if (!clinicId) return res.status(400).json({ error: 'Clinique introuvable' });

  try {
    // Vérifier la limite de staff pour ce plan
    const plan = req.plan || 'starter';
    const limit = PLAN_STAFF_LIMITS[plan] ?? 2;
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) FROM clinic_staff WHERE clinic_id = $1 AND is_active = true',
      [clinicId]
    );
    const currentCount = parseInt(countRows[0].count, 10);
    if (currentCount >= limit) {
      return res.status(403).json({
        error: 'staff_limit_reached',
        message: `Votre forfait ${plan} est limité à ${limit} membre(s) du staff. Passez à un forfait supérieur pour en ajouter.`,
        current: currentCount,
        limit,
      });
    }

    const hash   = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await pool.query(
      'INSERT INTO auth_users (id, email, password_hash) VALUES ($1, $2, $3)',
      [userId, email.toLowerCase().trim(), hash]
    );

    // Lier à la clinique existante (pas owner)
    await pool.query(
      'INSERT INTO clinic_users (id, user_id, clinic_id, role) VALUES ($1, $2, $3, $4)',
      [uuidv4(), userId, clinicId, role]
    );

    // Créer le profil staff
    await pool.query(
      'INSERT INTO clinic_staff (id, clinic_id, user_id, role, first_name, last_name, email, phone, specialty, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)',
      [uuidv4(), clinicId, userId, role,
       first_name.trim(), last_name.trim(),
       email.toLowerCase().trim(),
       phone?.trim() || null,
       specialty?.trim() || null]
    );

    // Retourner le profil créé
    const { rows } = await pool.query(
      'SELECT * FROM clinic_staff WHERE user_id=$1 AND clinic_id=$2 LIMIT 1',
      [userId, clinicId]
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email déjà utilisé' });
    console.error('Invite staff:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Auth — Login ──────────────────────────────────────────────────────────────

app.post('/api/auth/sessions', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(422).json({ error: 'email et password requis' });
  try {
    const { rows } = await pool.query(
      'SELECT id, email, password_hash FROM auth_users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash)))
      return res.status(401).json({ error: 'Identifiants invalides' });

    const info = await getClinicInfo(rows[0].id);
    const clinicId = info?.clinic_id || null;
    const plan     = info?.plan      || 'starter';
    const role     = info?.role      || 'owner';

    const { accessToken, refreshToken } = await makeTokens(rows[0].id, rows[0].email, clinicId, plan, role);
    await saveRefreshToken(rows[0].id, refreshToken);
    return res.json({ accessToken, refreshToken });
  } catch (e) {
    console.error('Login:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Auth — Current user ──────────────────────────────────────────────────────

app.get('/api/auth/sessions/current', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email FROM auth_users WHERE id = $1',
      [req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    return res.json({ user: { id: rows[0].id, email: rows[0].email } });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Auth — Logout ────────────────────────────────────────────────────────────

app.delete('/api/auth/sessions/current', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM auth_refresh_tokens WHERE user_id = $1', [req.user.sub])
    .catch(() => {});
  return res.status(204).send();
});

// ─── Auth — Refresh token ─────────────────────────────────────────────────────

app.post('/api/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token)
    return res.status(422).json({ error: 'refresh_token required' });
  try {
    const { rows } = await pool.query(
      `SELECT rt.user_id, u.email
         FROM auth_refresh_tokens rt
         JOIN auth_users u ON u.id = rt.user_id
        WHERE rt.token = $1 AND rt.expires_at > NOW()`,
      [refresh_token]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Token invalide ou expiré' });

    const info = await getClinicInfo(rows[0].user_id);
    const clinicId = info?.clinic_id || null;
    const plan     = info?.plan      || 'starter';
    const role     = info?.role      || 'owner';

    const { accessToken, refreshToken: newRefresh } = await makeTokens(rows[0].user_id, rows[0].email, clinicId, plan, role);
    await pool.query('DELETE FROM auth_refresh_tokens WHERE token = $1', [refresh_token]);
    await saveRefreshToken(rows[0].user_id, newRefresh);
    return res.json({ accessToken, refreshToken: newRefresh });
  } catch (e) {
    console.error('Refresh:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Database Proxy → PostgREST (with multi-tenant isolation) ─────────────────

app.use('/api/database/records', requireAuth, async (req, res) => {
  // Extract table name from path (e.g. /clinic_patients → 'clinic_patients')
  const tableName = req.path.replace(/^\//, '').split('?')[0];

  // Check feature gate before any DB access
  const requiredFeature = TABLE_FEATURE_MAP[tableName];
  if (requiredFeature) {
    const allowed = PLAN_FEATURES[req.plan] ?? [];
    if (!allowed.includes(requiredFeature)) {
      return res.status(403).json({
        error: 'upgrade_required',
        feature: requiredFeature,
        current_plan: req.plan,
        message: 'Cette fonctionnalité requiert un forfait supérieur.',
      });
    }
  }

  const isClinicScoped = CLINIC_SCOPED_TABLES.has(tableName);
  const clinicId = req.clinicId;

  // Build query string, injecting clinic_id filter for scoped tables on read/update/delete
  let qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  if (isClinicScoped && clinicId && ['GET','PATCH','DELETE'].includes(req.method)) {
    const sep = qs ? '&' : '?';
    qs = qs + sep + `clinic_id=eq.${clinicId}`;
  }

  // For POST (insert), inject clinic_id into the body
  let body = req.body;
  if (isClinicScoped && clinicId && req.method === 'POST' && body && typeof body === 'object') {
    if (Array.isArray(body)) {
      body = body.map(item => ({ ...item, clinic_id: clinicId }));
    } else {
      body = { ...body, clinic_id: clinicId };
    }
  }

  const target = `${POSTGREST_URL}${req.path}${qs}`;
  const headers = { 'Content-Type': 'application/json' };
  if (req.headers.prefer) headers['Prefer'] = req.headers.prefer;

  const opts = { method: req.method, headers };
  if (['POST','PUT','PATCH'].includes(req.method))
    opts.body = JSON.stringify(body);

  try {
    const pgRes = await fetch(target, opts);
    const text  = await pgRes.text();
    const cr    = pgRes.headers.get('Content-Range');
    if (cr) res.setHeader('Content-Range', cr);

    // Google Calendar — créer l'event après insertion d'un RDV
    if (tableName === 'clinic_appointments' && req.method === 'POST' && pgRes.status === 201) {
      try {
        const inserted = JSON.parse(text);
        const appt = Array.isArray(inserted) ? inserted[0] : inserted;
        if (appt) createGoogleCalendarEvent(appt).catch(() => {});
      } catch (_) {}
    }

    return res.status(pgRes.status).type('json').send(text || (req.method === 'DELETE' ? '' : '[]'));
  } catch (e) {
    console.error('PostgREST proxy:', e.message);
    return res.status(502).json({ error: 'Base de données inaccessible' });
  }
});

// ─── Facturation — Numéro automatique ─────────────────────────────────────────

app.get('/api/facturation/next-number', requireAuth, requireFeature('billing'), async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const { rows } = await pool.query(
      "SELECT COUNT(*) FROM clinic_invoices WHERE clinic_id=$1 AND numero LIKE $2",
      [req.clinicId, `INV-${year}-%`]
    );
    const seq = parseInt(rows[0].count) + 1;
    return res.json({ numero: `INV-${year}-${String(seq).padStart(4, '0')}` });
  } catch (e) {
    console.error('Next invoice number:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Facturation — Génération DOCX ────────────────────────────────────────────

app.post('/api/facturation/:id/docx', requireAuth, requireFeature('billing'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: invRows } = await pool.query(
      'SELECT * FROM clinic_invoices WHERE id=$1 AND clinic_id=$2',
      [id, req.clinicId]
    );
    if (!invRows[0]) return res.status(404).json({ error: 'Facture introuvable' });
    const inv = invRows[0];

    const { rows: settRows } = await pool.query(
      'SELECT * FROM clinic_settings WHERE clinic_id=$1', [req.clinicId]
    );
    const cs = settRows[0] || {};

    const {
      Document, Paragraph, Table, TableRow, TableCell,
      AlignmentType, WidthType, BorderStyle,
      TextRun, Packer, ShadingType,
    } = require('docx');

    const fmt = (n) => `${parseFloat(n || 0).toFixed(2)} $`;
    const lignes = Array.isArray(inv.lignes) ? inv.lignes : [];

    const borderNone = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const cellBorders = { top: borderNone, bottom: borderNone, left: borderNone, right: borderNone };

    function sectionTitle(text) {
      return new Paragraph({
        children: [new TextRun({ text, bold: true, size: 22, color: '1E40AF' })],
        spacing: { before: 200, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '3B82F6' } },
      });
    }
    function row2(label, value) {
      return new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18 })] })], width: { size: 30, type: WidthType.PERCENTAGE }, borders: cellBorders }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value || '—', size: 18 })] })], width: { size: 70, type: WidthType.PERCENTAGE }, borders: cellBorders }),
        ],
      });
    }
    function infoTable(rows2) {
      return new Table({ rows: rows2, width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: borderNone, bottom: borderNone, left: borderNone, right: borderNone, insideH: borderNone, insideV: borderNone } });
    }

    // Lignes d'actes header
    const acteHeaderRow = new TableRow({
      children: ['Code', 'Description', 'Qté', 'Prix unitaire', 'Montant'].map(h =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
          shading: { type: ShadingType.CLEAR, fill: '1E40AF' },
        })
      ),
    });
    const acteRows = lignes.map(l => new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: l.code || '', size: 18 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: l.description || '', size: 18 })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(l.quantite ?? ''), size: 18 })] }), ], alignment: AlignmentType.CENTER }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: fmt(l.prix_unitaire), size: 18 })] }), ], alignment: AlignmentType.RIGHT }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: fmt(l.montant), size: 18 })] }), ], alignment: AlignmentType.RIGHT }),
      ],
    }));

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // ── En-tête clinique ──
          new Paragraph({ children: [new TextRun({ text: cs.clinic_name || 'Clinique', bold: true, size: 36, color: '1E40AF' })], alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: [cs.address, cs.city, cs.postal_code].filter(Boolean).join(', ') || '', size: 18, color: '6B7280' })], alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: [cs.phone ? `Tél: ${cs.phone}` : '', cs.email || ''].filter(Boolean).join('  |  '), size: 18, color: '6B7280' })], alignment: AlignmentType.CENTER }),
          new Paragraph({ text: '', spacing: { after: 100 } }),

          // ── Titre facture ──
          new Paragraph({ children: [new TextRun({ text: `FACTURE ${inv.numero}`, bold: true, size: 48 })], alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
          new Paragraph({ children: [new TextRun({ text: `Date de visite : ${inv.date_visite || '—'}   |   Échéance : ${inv.date_echeance || '—'}`, size: 18, color: '6B7280' })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),

          // ── Patient ──
          sectionTitle('Informations patient'),
          infoTable([
            row2('Nom', inv.patient_nom),
            row2('N° RAMQ', inv.patient_ramq),
            row2('N° dossier', inv.patient_dossier),
            row2('Téléphone', inv.patient_telephone),
            row2('Adresse', inv.patient_adresse),
          ]),

          // ── Médecin & assurance ──
          sectionTitle('Médecin & assurance'),
          infoTable([
            row2('Médecin', inv.medecin_nom),
            row2('N° licence', inv.medecin_licence),
            row2('Spécialité', inv.medecin_specialite),
            row2('Assureur', inv.assureur),
            row2('N° police', inv.no_police),
            row2('N° réclamation', inv.no_reclamation),
          ]),

          // ── Actes ──
          sectionTitle('Actes médicaux'),
          ...(lignes.length > 0
            ? [new Table({ rows: [acteHeaderRow, ...acteRows], width: { size: 100, type: WidthType.PERCENTAGE } })]
            : [new Paragraph({ children: [new TextRun({ text: 'Aucun acte enregistré.', size: 18, italics: true })] })]
          ),

          // ── Totaux ──
          sectionTitle('Résumé financier'),
          infoTable([
            row2('Sous-total', fmt(inv.sous_total)),
            row2('Remises', `- ${fmt(inv.remises)}`),
            row2('Couverture RAMQ', `- ${fmt(inv.ramq_couverture)}`),
            row2('Couverture assurance', `- ${fmt(inv.assurance_couverture)}`),
            row2('TPS (5%)', fmt(inv.tps)),
            row2('TVQ (9.975%)', fmt(inv.tvq)),
            row2('Acompte', `- ${fmt(inv.acompte)}`),
            row2('TOTAL DÛ', fmt(inv.total)),
          ]),

          // ── Notes & diagnostic ──
          ...(inv.notes || inv.diagnostic_cim10 ? [
            sectionTitle('Notes'),
            ...(inv.diagnostic_cim10 ? [new Paragraph({ children: [new TextRun({ text: `Diagnostic CIM-10 : ${inv.diagnostic_cim10}`, size: 18, italics: true })] })] : []),
            ...(inv.notes ? [new Paragraph({ children: [new TextRun({ text: inv.notes, size: 18 })] })] : []),
          ] : []),

          // ── Signature ──
          new Paragraph({ text: '', spacing: { before: 400 } }),
          new Paragraph({ children: [new TextRun({ text: 'Signature du médecin : ____________________________', size: 18 })], spacing: { after: 60 } }),
          new Paragraph({ children: [new TextRun({ text: 'Date : ____________________', size: 18 })] }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="facture-${inv.numero}.docx"`,
      'Content-Length': buffer.length,
    });
    return res.send(buffer);
  } catch (e) {
    console.error('DOCX generation:', e.message);
    return res.status(500).json({ error: 'Erreur génération DOCX : ' + e.message });
  }
});

// ─── Billing — Status ─────────────────────────────────────────────────────────

app.get('/api/billing/status', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT plan, status, trial_ends_at, current_period_end,
              stripe_customer_id, stripe_subscription_id,
              square_customer_id, square_subscription_id, payment_provider
         FROM subscriptions WHERE clinic_id = $1 LIMIT 1`,
      [req.clinicId]
    );
    if (!rows[0]) return res.json({ plan: 'starter', status: 'trialing' });
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Billing — Stripe Checkout ────────────────────────────────────────────────

app.post('/api/billing/checkout', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe non configuré' });
  const { plan } = req.body || {};
  const priceMap = { starter: STRIPE_PRICE_STARTER, pro: STRIPE_PRICE_PRO, enterprise: STRIPE_PRICE_ENTERPRISE };
  const priceId = priceMap[plan];
  if (!priceId) return res.status(422).json({ error: 'Plan invalide' });

  try {
    // Get or create Stripe customer
    const { rows } = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE clinic_id = $1 LIMIT 1',
      [req.clinicId]
    );
    let customerId = rows[0]?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { clinic_id: req.clinicId },
      });
      customerId = customer.id;
      await pool.query(
        'UPDATE subscriptions SET stripe_customer_id = $1 WHERE clinic_id = $2',
        [customerId, req.clinicId]
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/subscription?success=1`,
      cancel_url:  `${APP_URL}/subscription?cancelled=1`,
      metadata: { clinic_id: req.clinicId, plan },
    });
    return res.json({ url: session.url });
  } catch (e) {
    console.error('Stripe checkout:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── Billing — Stripe Customer Portal ────────────────────────────────────────

app.post('/api/billing/portal', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe non configuré' });
  try {
    const { rows } = await pool.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE clinic_id = $1 LIMIT 1',
      [req.clinicId]
    );
    if (!rows[0]?.stripe_customer_id)
      return res.status(404).json({ error: 'Aucun abonnement Stripe trouvé' });

    const session = await stripe.billingPortal.sessions.create({
      customer:   rows[0].stripe_customer_id,
      return_url: `${APP_URL}/subscription`,
    });
    return res.json({ url: session.url });
  } catch (e) {
    console.error('Stripe portal:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── Billing — Stripe Webhook ─────────────────────────────────────────────────

const PLAN_FROM_PRICE = {};
if (STRIPE_PRICE_STARTER)    PLAN_FROM_PRICE[STRIPE_PRICE_STARTER]    = 'starter';
if (STRIPE_PRICE_PRO)        PLAN_FROM_PRICE[STRIPE_PRICE_PRO]        = 'pro';
if (STRIPE_PRICE_ENTERPRISE) PLAN_FROM_PRICE[STRIPE_PRICE_ENTERPRISE] = 'enterprise';

async function handleStripeWebhook(req, res) {
  if (!stripe || !STRIPE_WEBHOOK_SECRET)
    return res.json({ received: true });

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.error('Stripe webhook signature error:', e.message);
    return res.status(400).send('Webhook signature invalide');
  }

  try {
    const data = event.data.object;

    if (event.type === 'checkout.session.completed') {
      const clinicId = data.metadata?.clinic_id;
      const plan     = data.metadata?.plan || 'starter';
      if (clinicId && data.subscription) {
        await pool.query(
          `UPDATE subscriptions SET stripe_subscription_id = $1, plan = $2, status = 'active',
           updated_at = NOW() WHERE clinic_id = $3`,
          [data.subscription, plan, clinicId]
        );
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const priceId = data.items?.data?.[0]?.price?.id;
      const plan = PLAN_FROM_PRICE[priceId] || 'starter';
      const status = data.status === 'active' ? 'active'
                   : data.status === 'past_due' ? 'past_due'
                   : data.status === 'canceled' ? 'cancelled' : data.status;
      const periodEnd = data.current_period_end
        ? new Date(data.current_period_end * 1000) : null;
      await pool.query(
        `UPDATE subscriptions SET plan = $1, status = $2, current_period_end = $3,
         updated_at = NOW() WHERE stripe_subscription_id = $4`,
        [plan, status, periodEnd, data.id]
      );
    }

    if (event.type === 'customer.subscription.deleted') {
      await pool.query(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [data.id]
      );
    }

    if (event.type === 'invoice.payment_failed') {
      await pool.query(
        `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [data.subscription]
      );
    }
  } catch (e) {
    console.error('Stripe webhook processing:', e.message);
  }

  return res.json({ received: true });
}

// ─── Billing — Square Checkout ────────────────────────────────────────────────

app.post('/api/billing/square/checkout', requireAuth, async (req, res) => {
  if (!squareClient) return res.status(503).json({ error: 'Square non configuré' });
  const { plan } = req.body || {};
  const planVariationMap = {
    starter:    SQUARE_PLAN_STARTER,
    pro:        SQUARE_PLAN_PRO,
    enterprise: SQUARE_PLAN_ENTERPRISE,
  };
  const planVariationId = planVariationMap[plan];
  if (!planVariationId) return res.status(422).json({ error: 'Plan invalide' });

  try {
    // Get or create Square customer
    const { rows } = await pool.query(
      'SELECT square_customer_id FROM subscriptions WHERE clinic_id = $1 LIMIT 1',
      [req.clinicId]
    );
    let squareCustomerId = rows[0]?.square_customer_id;
    if (!squareCustomerId) {
      const { result } = await squareClient.customersApi.createCustomer({
        emailAddress: req.user.email,
        referenceId:  req.clinicId,
      });
      squareCustomerId = result.customer.id;
      await pool.query(
        'UPDATE subscriptions SET square_customer_id = $1 WHERE clinic_id = $2',
        [squareCustomerId, req.clinicId]
      );
    }

    // Create Square Payment Link for subscription
    const idempotencyKey = uuidv4();
    const { result: linkResult } = await squareClient.checkoutApi.createPaymentLink({
      idempotencyKey,
      order: {
        locationId:  SQUARE_LOCATION_ID,
        customerId:  squareCustomerId,
        lineItems: [{ catalogObjectId: planVariationId, quantity: '1' }],
      },
      checkoutOptions: {
        redirectUrl: `${APP_URL}/subscription?success=1&provider=square`,
      },
      prePopulatedData: { buyerEmail: req.user.email },
    });

    // Track that Square is the payment provider + store clinic/plan for webhook
    await pool.query(
      'UPDATE subscriptions SET payment_provider = $1 WHERE clinic_id = $2',
      ['square', req.clinicId]
    );

    return res.json({ url: linkResult.paymentLink.url });
  } catch (e) {
    console.error('Square checkout:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── Billing — Square Cancel Subscription ─────────────────────────────────────

app.post('/api/billing/square/cancel', requireAuth, async (req, res) => {
  if (!squareClient) return res.status(503).json({ error: 'Square non configuré' });
  try {
    const { rows } = await pool.query(
      'SELECT square_subscription_id FROM subscriptions WHERE clinic_id = $1 LIMIT 1',
      [req.clinicId]
    );
    const subId = rows[0]?.square_subscription_id;
    if (!subId) return res.status(404).json({ error: 'Aucun abonnement Square trouvé' });

    await squareClient.subscriptionsApi.cancelSubscription(subId);
    await pool.query(
      "UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE clinic_id = $1",
      [req.clinicId]
    );
    return res.json({ cancelled: true });
  } catch (e) {
    console.error('Square cancel:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── Billing — Square Webhook ─────────────────────────────────────────────────

app.post('/api/billing/square/webhook', express.json(), async (req, res) => {
  // Vérification signature HMAC-SHA256
  if (SQUARE_WEBHOOK_SIG) {
    const crypto = require('crypto');
    const sqSig  = req.headers['x-square-hmacsha256-signature'] || '';
    const expected = crypto
      .createHmac('sha256', SQUARE_WEBHOOK_SIG)
      .update(APP_URL + '/api/billing/square/webhook' + JSON.stringify(req.body))
      .digest('base64');
    if (sqSig !== expected) return res.status(400).send('Signature invalide');
  }

  const { type, data } = req.body || {};
  try {
    const sub = data?.object?.subscription;
    if (sub && (type === 'subscription.created' || type === 'subscription.updated')) {
      const clinicRes = await pool.query(
        'SELECT clinic_id FROM subscriptions WHERE square_customer_id = $1 LIMIT 1',
        [sub.customerId]
      );
      if (clinicRes.rows[0]) {
        const plan = SQUARE_PLAN_MAP[sub.planVariationId] || 'starter';
        const status = sub.status === 'ACTIVE' ? 'active'
                     : sub.status === 'CANCELED' ? 'cancelled'
                     : 'trialing';
        const periodEnd = sub.chargedThroughDate ? new Date(sub.chargedThroughDate) : null;
        await pool.query(
          `UPDATE subscriptions
             SET square_subscription_id = $1, plan = $2, status = $3,
                 current_period_end = $4, updated_at = NOW()
           WHERE clinic_id = $5`,
          [sub.id, plan, status, periodEnd, clinicRes.rows[0].clinic_id]
        );
      }
    }
    if (sub && type === 'subscription.canceled') {
      await pool.query(
        "UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE square_subscription_id = $1",
        [sub.id]
      );
    }
  } catch (e) {
    console.error('Square webhook processing:', e.message);
  }

  return res.json({ received: true });
});

// ─── Super-Admin ──────────────────────────────────────────────────────────────

app.get('/api/admin/stats', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(DISTINCT c.id)                                                             AS total_clinics,
        COUNT(DISTINCT CASE WHEN s.status='active'              THEN c.id END)           AS active_clinics,
        COUNT(DISTINCT CASE WHEN s.status='trialing'            THEN c.id END)           AS trial_clinics,
        COUNT(DISTINCT CASE WHEN s.status IN ('cancelled','suspended') THEN c.id END)    AS churned_clinics,
        COALESCE(SUM(CASE s.plan
          WHEN 'starter'    THEN 19
          WHEN 'pro'        THEN 49
          WHEN 'enterprise' THEN 99
        END) FILTER (WHERE s.status='active'), 0)                                        AS mrr
      FROM clinics c
      LEFT JOIN subscriptions s ON s.clinic_id = c.id
    `);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/clinics', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id, c.name, c.slug, c.status AS clinic_status, c.created_at,
        s.plan, s.status, s.payment_provider,
        s.trial_ends_at, s.current_period_end,
        s.stripe_customer_id, s.square_customer_id,
        u.email AS owner_email
      FROM clinics c
      LEFT JOIN subscriptions s ON s.clinic_id = c.id
      LEFT JOIN clinic_users cu ON cu.clinic_id = c.id AND cu.role = 'owner'
      LEFT JOIN auth_users u ON u.id = cu.user_id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/admin/clinics/:clinicId/subscription', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { plan, status } = req.body;
    const { clinicId } = req.params;
    const ALLOWED_PLANS    = ['starter','pro','enterprise'];
    const ALLOWED_STATUSES = ['trialing','active','past_due','cancelled','suspended'];
    if (plan   && !ALLOWED_PLANS.includes(plan))     return res.status(400).json({ error: 'Invalid plan' });
    if (status && !ALLOWED_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const sets = []; const vals = [];
    if (plan)   { sets.push(`plan=$${vals.length+1}`);   vals.push(plan); }
    if (status) { sets.push(`status=$${vals.length+1}`); vals.push(status); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    sets.push('updated_at=NOW()');
    vals.push(clinicId);
    await pool.query(`UPDATE subscriptions SET ${sets.join(',')} WHERE clinic_id=$${vals.length}`, vals);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Storage ──────────────────────────────────────────────────────────────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.put('/api/storage/buckets/:bucket/objects/*', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
  const key      = req.params[0] || '';
  const bucket   = req.params.bucket;
  const filePath = path.join(STORAGE_PATH, req.clinicId || 'default', bucket, key);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, req.file.buffer);
  return res.json({ key: `${bucket}/${key}` });
});

app.get('/api/storage/buckets/:bucket/objects/*', requireAuth, (req, res) => {
  const key      = req.params[0] || '';
  const bucket   = req.params.bucket;
  // Try clinic-scoped path first, then fallback to legacy path
  let filePath = path.join(STORAGE_PATH, req.clinicId || 'default', bucket, key);
  if (!fs.existsSync(filePath))
    filePath = path.join(STORAGE_PATH, bucket, key);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fichier introuvable' });
  return res.sendFile(filePath);
});

// ─── Patient Portal ───────────────────────────────────────────────────────────

// POST /api/portal/auth/request-otp
app.post('/api/portal/auth/request-otp', async (req, res) => {
  const { email, clinic_id } = req.body || {};
  if (!email || !clinic_id) return res.status(422).json({ error: 'email et clinic_id requis' });

  try {
    // Check clinic plan
    const subRow = await pool.query(
      'SELECT plan FROM subscriptions WHERE clinic_id=$1 LIMIT 1',
      [clinic_id]
    );
    const plan = subRow.rows[0]?.plan || 'starter';
    if (!(PLAN_FEATURES[plan] || []).includes('portal')) {
      return res.status(403).json({ error: 'upgrade_required', message: 'Le portail patient nécessite le forfait Enterprise.' });
    }

    // Find patient by email in this clinic
    const patRow = await pool.query(
      'SELECT id FROM clinic_patients WHERE email=$1 AND clinic_id=$2 LIMIT 1',
      [email.toLowerCase().trim(), clinic_id]
    );
    if (!patRow.rows[0]) return res.status(404).json({ error: 'Patient introuvable' });
    const patientId = patRow.rows[0].id;

    // Invalidate previous OTPs
    await pool.query(
      'UPDATE patient_auth_tokens SET used=true WHERE patient_id=$1 AND clinic_id=$2 AND used=false',
      [patientId, clinic_id]
    );

    // Generate 6-digit OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      'INSERT INTO patient_auth_tokens (id, patient_id, clinic_id, otp_code, expires_at) VALUES ($1,$2,$3,$4,$5)',
      [uuidv4(), patientId, clinic_id, otpCode, expiresAt]
    );

    if (mailer) {
      await mailer.sendMail({
        from: MAIL_FROM,
        to: email,
        subject: 'Votre code de connexion au portail patient',
        text: `Votre code OTP : ${otpCode}\n\nValide 10 minutes. Ne le partagez pas.`,
        html: `<p>Votre code de connexion : <strong style="font-size:24px">${otpCode}</strong></p><p>Valide 10 minutes.</p>`,
      });
      return res.json({ sent: true });
    } else {
      // Dev mode: return OTP in response
      return res.json({ sent: true, dev_otp: otpCode });
    }
  } catch (e) {
    console.error('Portal request-otp:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/portal/auth/verify-otp
app.post('/api/portal/auth/verify-otp', async (req, res) => {
  const { email, clinic_id, otp } = req.body || {};
  if (!email || !clinic_id || !otp) return res.status(422).json({ error: 'email, clinic_id et otp requis' });

  try {
    const patRow = await pool.query(
      'SELECT id FROM clinic_patients WHERE email=$1 AND clinic_id=$2 LIMIT 1',
      [email.toLowerCase().trim(), clinic_id]
    );
    if (!patRow.rows[0]) return res.status(404).json({ error: 'Patient introuvable' });
    const patientId = patRow.rows[0].id;

    const tokenRow = await pool.query(
      `SELECT id FROM patient_auth_tokens
       WHERE patient_id=$1 AND clinic_id=$2 AND otp_code=$3 AND used=false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [patientId, clinic_id, String(otp).trim()]
    );
    if (!tokenRow.rows[0]) return res.status(401).json({ error: 'Code invalide ou expiré' });

    await pool.query('UPDATE patient_auth_tokens SET used=true WHERE id=$1', [tokenRow.rows[0].id]);

    const token = makePatientToken(patientId, clinic_id);
    return res.json({ token, patient_id: patientId });
  } catch (e) {
    console.error('Portal verify-otp:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/portal/appointments
app.get('/api/portal/appointments', requirePatientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, start_time, end_time, type, status, reason, is_virtual, virtual_meeting_url
       FROM clinic_appointments
       WHERE patient_id=$1 AND clinic_id=$2
       ORDER BY start_time DESC`,
      [req.patientId, req.clinicId]
    );
    return res.json(rows);
  } catch (e) {
    console.error('Portal appointments:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/portal/dossiers
app.get('/api/portal/dossiers', requirePatientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, type, title, content, created_at
       FROM clinic_dossiers
       WHERE patient_id=$1 AND clinic_id=$2 AND (is_confidential IS NULL OR is_confidential=false)
       ORDER BY created_at DESC`,
      [req.patientId, req.clinicId]
    );
    return res.json(rows);
  } catch (e) {
    console.error('Portal dossiers:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/portal/invoices
app.get('/api/portal/invoices', requirePatientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, numero, statut, date_visite, total, created_at
       FROM clinic_invoices
       WHERE patient_id=$1 AND clinic_id=$2
       ORDER BY created_at DESC`,
      [req.patientId, req.clinicId]
    );
    return res.json(rows);
  } catch (e) {
    console.error('Portal invoices:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/portal/profile — patient updates own phone/email
app.patch('/api/portal/profile', requirePatientAuth, async (req, res) => {
  const { phone, email } = req.body || {};
  const updates = [];
  const values = [];
  if (phone !== undefined) { updates.push(`phone=$${updates.length + 1}`); values.push(phone); }
  if (email !== undefined) { updates.push(`email=$${updates.length + 1}`); values.push(email.toLowerCase().trim()); }
  if (!updates.length) return res.status(422).json({ error: 'Rien à mettre à jour' });
  values.push(req.patientId, req.clinicId);
  try {
    const { rows } = await pool.query(
      `UPDATE clinic_patients SET ${updates.join(', ')} WHERE id=$${values.length - 1} AND clinic_id=$${values.length} RETURNING id, first_name, last_name, email, phone`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Patient introuvable' });
    return res.json(rows[0]);
  } catch (e) {
    console.error('Portal profile:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/portal/profile — get own patient info
app.get('/api/portal/profile', requirePatientAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, first_name, last_name, email, phone, date_of_birth, gender, address, city, postal_code FROM clinic_patients WHERE id=$1 AND clinic_id=$2',
      [req.patientId, req.clinicId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Patient introuvable' });
    return res.json(rows[0]);
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/portal/send-invite — staff sends portal invite email to patient
app.post('/api/portal/send-invite', requireAuth, requireFeature('portal'), async (req, res) => {
  const { patient_id } = req.body || {};
  if (!patient_id) return res.status(422).json({ error: 'patient_id requis' });
  try {
    const patRow = await pool.query(
      'SELECT first_name, last_name, email FROM clinic_patients WHERE id=$1 AND clinic_id=$2',
      [patient_id, req.clinicId]
    );
    if (!patRow.rows[0]) return res.status(404).json({ error: 'Patient introuvable' });
    const { first_name, last_name, email } = patRow.rows[0];
    if (!email) return res.status(422).json({ error: 'Ce patient n\'a pas d\'adresse email' });

    const portalUrl = `${APP_URL}/portal/login?clinic_id=${req.clinicId}`;

    if (mailer) {
      await mailer.sendMail({
        from: MAIL_FROM,
        to: email,
        subject: 'Accès à votre portail patient',
        text: `Bonjour ${first_name} ${last_name},\n\nVotre portail patient est disponible ici :\n${portalUrl}\n\nConnectez-vous avec votre adresse email. Un code de vérification vous sera envoyé.\n\nCordialement,\nVotre clinique`,
        html: `<p>Bonjour <strong>${first_name} ${last_name}</strong>,</p>
<p>Votre portail patient est maintenant disponible. Vous pouvez y consulter vos rendez-vous, dossiers médicaux et factures.</p>
<p><a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Accéder à mon portail</a></p>
<p>Ou copiez ce lien : ${portalUrl}</p>
<p>Pour vous connecter, entrez simplement votre adresse email. Un code de vérification à usage unique vous sera envoyé.</p>`,
      });
      return res.json({ sent: true });
    } else {
      return res.json({ sent: false, portal_url: portalUrl, dev: true });
    }
  } catch (e) {
    console.error('Portal send-invite:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/portal/send-appointment-email — staff notifies patient of new/updated appointment
app.post('/api/portal/send-appointment-email', requireAuth, requireFeature('portal'), async (req, res) => {
  const { appointment_id } = req.body || {};
  if (!appointment_id) return res.status(422).json({ error: 'appointment_id requis' });

  try {
    // Fetch appointment + patient + clinic name
    const apptRow = await pool.query(
      `SELECT a.start_time, a.end_time, a.type, a.reason, a.is_virtual,
              p.first_name, p.last_name, p.email,
              cs.clinic_name
         FROM clinic_appointments a
         JOIN clinic_patients p ON p.id = a.patient_id
         LEFT JOIN clinic_settings cs ON cs.clinic_id = a.clinic_id
        WHERE a.id=$1 AND a.clinic_id=$2`,
      [appointment_id, req.clinicId]
    );
    if (!apptRow.rows[0]) return res.status(404).json({ error: 'Rendez-vous introuvable' });

    const { start_time, end_time, type, reason, is_virtual,
            first_name, last_name, email, clinic_name } = apptRow.rows[0];

    if (!email) return res.status(422).json({ error: 'Ce patient n\'a pas d\'adresse email' });

    const clinicLabel = clinic_name || 'Votre clinique';
    const portalUrl   = `${APP_URL}/portal/login?clinic_id=${req.clinicId}`;

    const dateOptions = { timeZone: 'America/Toronto', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { timeZone: 'America/Toronto', hour: '2-digit', minute: '2-digit' };
    const dateStr = new Date(start_time).toLocaleDateString('fr-CA', dateOptions);
    const timeStart = new Date(start_time).toLocaleTimeString('fr-CA', timeOptions);
    const timeEnd   = new Date(end_time).toLocaleTimeString('fr-CA', timeOptions);

    const typeLabel = {
      consultation: 'Consultation', bilan: 'Bilan', suivi: 'Suivi',
      urgence: 'Urgence', preventif: 'Préventif', autre: 'Autre'
    }[type] || type || 'Consultation';

    const virtualNote = is_virtual
      ? `<p style="background:#f3f4ff;border:1px solid #e0e0ff;border-radius:8px;padding:12px;margin:16px 0;color:#4f46e5">
           📹 <strong>Consultation virtuelle</strong> — un lien de connexion sera disponible dans votre portail patient.
         </p>` : '';

    const reasonNote = reason ? `<p style="color:#555;font-size:14px">Motif : ${reason}</p>` : '';

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#333">
  <div style="background:#4f46e5;border-radius:12px 12px 0 0;padding:20px 24px">
    <h1 style="color:white;margin:0;font-size:20px">${clinicLabel}</h1>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Confirmation de rendez-vous</p>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
    <p>Bonjour <strong>${first_name} ${last_name}</strong>,</p>
    <p>Votre rendez-vous a été confirmé :</p>

    <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 8px;font-size:15px"><strong>📅 ${dateStr}</strong></p>
      <p style="margin:0 0 6px;color:#555;font-size:14px">🕐 ${timeStart} — ${timeEnd}</p>
      <p style="margin:0;color:#555;font-size:14px">🩺 ${typeLabel}</p>
      ${reasonNote}
    </div>

    ${virtualNote}

    <div style="background:#f0f0ff;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
      <p style="margin:0 0 12px;font-size:14px;color:#4f46e5;font-weight:600">Accédez à votre portail patient</p>
      <p style="margin:0 0 12px;font-size:13px;color:#666">Consultez vos rendez-vous, dossiers médicaux et factures en ligne.</p>
      <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;background:#4f46e5;color:white;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px">
        Accéder à mon portail
      </a>
    </div>

    <p style="font-size:12px;color:#999;margin-top:16px">Pour vous connecter, utilisez simplement votre adresse email. Un code de vérification vous sera envoyé.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
    <p style="font-size:12px;color:#aaa;text-align:center">${clinicLabel}</p>
  </div>
</body></html>`;

    const text = `Bonjour ${first_name} ${last_name},\n\nVotre rendez-vous est confirmé :\n- Date : ${dateStr}\n- Heure : ${timeStart} — ${timeEnd}\n- Type : ${typeLabel}\n${reason ? `- Motif : ${reason}\n` : ''}\nAccédez à votre portail patient : ${portalUrl}\n\nCordialement,\n${clinicLabel}`;

    if (mailer) {
      await mailer.sendMail({ from: MAIL_FROM, to: email, subject: `Confirmation de rendez-vous — ${clinicLabel}`, text, html });
      return res.json({ sent: true });
    } else {
      return res.json({ sent: false, portal_url: portalUrl, dev: true,
        preview: { to: email, subject: `Confirmation de rendez-vous — ${clinicLabel}`, date: dateStr, time: timeStart } });
    }
  } catch (e) {
    console.error('Portal send-appointment-email:', e.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Secrets ──────────────────────────────────────────────────────────────────

const secrets = new Map();

app.post('/api/secrets', (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(422).json({ error: 'key required' });
  secrets.set(key, value);
  console.log(`Secret set: ${key}`);
  return res.json({ ok: true });
});

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.get('/', (_, res) => res.json({ service: 'InsForge Gateway', version: '2.0.0', saas: true }));

// ─── Démarrage ────────────────────────────────────────────────────────────────

async function start() {
  for (let i = 0; i < 30; i++) {
    try { await pool.query('SELECT 1'); break; }
    catch { await new Promise(r => setTimeout(r, 1000)); }
  }
  app.listen(PORT, '0.0.0.0', () =>
    console.log(`InsForge gateway SaaS → port ${PORT}`)
  );
}

start().catch(e => { console.error(e); process.exit(1); });
