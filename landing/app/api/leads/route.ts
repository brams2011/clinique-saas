import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/insforge',
})

// Crée la table si elle n'existe pas encore
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      email      TEXT        NOT NULL,
      source     TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  // Index pour éviter les doublons et accélérer les lookups
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS leads_email_idx ON leads (email)
  `)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email: string = (body.email ?? '').toString().toLowerCase().trim()
    const source: string = (body.source ?? 'landing').toString()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    await ensureTable()

    await pool.query(
      `INSERT INTO leads (email, source)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET source = EXCLUDED.source, created_at = NOW()`,
      [email, source]
    )

    console.log('[leads] nouveau lead enregistré', { email, source })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[leads] erreur', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
