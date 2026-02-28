#!/usr/bin/env node
/**
 * configure_elevenlabs.js
 * Configure automatiquement l'agent ElevenLabs pour la prise de rendez-vous.
 *
 * Usage:
 *   node configure_elevenlabs.js http://votre-ip-publique
 *
 * Prérequis: ELEVENLABS_API_KEY dans insforge/.env
 */

'use strict';
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ─── Lire insforge/.env ───────────────────────────────────────────────────────
const envPath = path.join(__dirname, 'insforge', '.env');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });
}

const API_KEY  = env.ELEVENLABS_API_KEY  || process.env.ELEVENLABS_API_KEY  || '';
const AGENT_ID = env.ELEVENLABS_AGENT_ID || process.env.ELEVENLABS_AGENT_ID || '';

// ─── Validation ────────────────────────────────────────────────────────────────
if (!API_KEY) {
  console.error('\n❌  ELEVENLABS_API_KEY manquant dans insforge/.env');
  console.error('    Ajoutez : ELEVENLABS_API_KEY=sk_...\n');
  process.exit(1);
}
if (!AGENT_ID) {
  console.error('\n❌  ELEVENLABS_AGENT_ID manquant dans insforge/.env\n');
  process.exit(1);
}

const rawServerUrl = process.argv[2] || '';
if (!rawServerUrl) {
  console.error('\nUsage: node configure_elevenlabs.js <url-serveur-public>');
  console.error('  ex:  node configure_elevenlabs.js http://123.456.789.0');
  console.error('  ex:  node configure_elevenlabs.js https://mondomaine.com\n');
  process.exit(1);
}

const SERVER_URL  = rawServerUrl.replace(/\/$/, '');
const WEBHOOK_URL = `${SERVER_URL}:7133/webhook_elevenlabs`;
const WEBHOOK_SECRET = crypto.randomBytes(32).toString('hex');

// ─── Configuration de l'agent ─────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es l'assistant vocal de la clinique, spécialisé dans la prise de rendez-vous médicaux. Parle toujours en français, avec un ton professionnel et bienveillant.

PROCESSUS DE PRISE DE RENDEZ-VOUS :
1. Salue le patient et présente-toi
2. Demande son nom complet (prénom et nom de famille)
3. Demande son numéro de téléphone (format : +1 suivi de 10 chiffres, ex: +15141234567)
4. Demande le motif de la consultation
5. Propose des créneaux disponibles ou demande ses préférences (jour et heure)
6. Confirme la date et l'heure exactes avec le patient
7. Récapitule : nom, téléphone, date/heure, motif
8. Termine l'appel poliment

RÈGLES IMPORTANTES :
- Enregistre la date et l'heure du rendez-vous OBLIGATOIREMENT au format ISO 8601 : YYYY-MM-DDTHH:MM:00
  Exemple : si le patient dit "jeudi prochain à 14h30", calcule la date réelle et écris "2025-03-06T14:30:00"
- Le numéro de téléphone doit être au format international +1XXXXXXXXXX (sans espaces ni tirets)
- Si le patient hésite, propose des créneaux précis (ex: "Lundi à 9h, mercredi à 14h ou vendredi à 11h")
- Ne promets pas de disponibilité spécifique sans confirmation du patient
- Si les informations sont incomplètes, repose la question avant de terminer`;

const FIRST_MESSAGE = "Bonjour! Vous avez joint la clinique. Je suis votre assistant virtuel pour la prise de rendez-vous. Comment puis-je vous aider aujourd'hui?";

const agentPatch = {
  conversation_config: {
    agent: {
      prompt: {
        prompt: SYSTEM_PROMPT,
      },
      first_message: FIRST_MESSAGE,
      language: "fr",
    },
    tts: {
      model_id: "eleven_turbo_v2_5",  // obligatoire pour les agents non-anglais
    },
  },
  platform_settings: {
    data_collection: {
      patient_name: {
        type: "string",
        description: "Nom complet du patient (prénom et nom de famille)",
      },
      client_phone: {
        type: "string",
        description: "Numéro de téléphone du patient au format international +1XXXXXXXXXX",
      },
      date_time: {
        type: "string",
        description: "Date et heure exactes du rendez-vous au format ISO 8601, exemple: 2025-03-15T14:30:00",
      },
      notes: {
        type: "string",
        description: "Motif ou raison de la consultation médicale",
      },
    },
  },
};

// ─── Appel API ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔧  Configuration de l\'agent ElevenLabs...');
  console.log(`    Agent ID   : ${AGENT_ID}`);
  console.log(`    Webhook URL: ${WEBHOOK_URL}\n`);

  // ── Étape 1 : créer/trouver le webhook workspace ────────────────────────────
  let webhookId = null;

  // Chercher un webhook existant pour cette URL
  const listRes = await fetch('https://api.elevenlabs.io/v1/workspace/webhooks', {
    headers: { 'xi-api-key': API_KEY },
  });
  if (listRes.ok) {
    const listData = await listRes.json();
    const existing = (listData.webhooks ?? listData ?? []).find(w => w.webhook_url === WEBHOOK_URL);
    if (existing) {
      webhookId = existing.webhook_id;
      console.log(`✅  Webhook existant réutilisé: ${webhookId}`);
    }
  }

  if (!webhookId) {
    const createRes = await fetch('https://api.elevenlabs.io/v1/workspace/webhooks', {
      method: 'POST',
      headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          name: 'Cinique-Webhook',
          webhook_url: WEBHOOK_URL,
          auth_type: 'hmac',
          secret: WEBHOOK_SECRET,
        },
        events: ['post_call_transcription'],
      }),
    });
    const createBody = await createRes.text();
    if (!createRes.ok) {
      console.error(`❌  Impossible de créer le webhook (HTTP ${createRes.status}):`, createBody);
      process.exit(1);
    }
    const hook = JSON.parse(createBody);
    webhookId = hook.webhook_id;
    console.log(`✅  Webhook workspace créé: ${webhookId}`);
  }

  // ── Étape 2 : configurer l'agent (prompt + data_collection + webhook_id) ────
  agentPatch.platform_settings.workspace_overrides = {
    webhooks: { post_call_webhook_id: webhookId },
  };

  const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(agentPatch),
  });

  const body = await res.text();

  if (!res.ok) {
    console.error(`❌  Erreur API ElevenLabs (HTTP ${res.status}):`);
    try { console.error(JSON.stringify(JSON.parse(body), null, 2)); }
    catch { console.error(body); }
    process.exit(1);
  }

  console.log('✅  Agent ElevenLabs configuré avec succès!\n');

  // ─── Mettre à jour insforge/.env ─────────────────────────────────────────────
  let envContent = fs.readFileSync(envPath, 'utf8');

  if (envContent.includes('WEBHOOK_SECRET_ELEVEN=')) {
    envContent = envContent.replace(/^WEBHOOK_SECRET_ELEVEN=.*/m, `WEBHOOK_SECRET_ELEVEN=${WEBHOOK_SECRET}`);
  } else {
    envContent += `\n# ElevenLabs webhook secret (généré automatiquement)\nWEBHOOK_SECRET_ELEVEN=${WEBHOOK_SECRET}\n`;
  }

  if (envContent.includes('ELEVENLABS_API_KEY=\n') || envContent.includes('ELEVENLABS_API_KEY= ')) {
    // Already empty, leave it
  }

  fs.writeFileSync(envPath, envContent);
  console.log('✅  insforge/.env mis à jour (WEBHOOK_SECRET_ELEVEN ajouté)\n');

  console.log('─'.repeat(60));
  console.log('RÉCAPITULATIF DE CONFIGURATION');
  console.log('─'.repeat(60));
  console.log(`Webhook URL    : ${WEBHOOK_URL}`);
  console.log(`Webhook Secret : ${WEBHOOK_SECRET}`);
  console.log('─'.repeat(60));
  console.log('\n📌  Étapes suivantes :');
  console.log('    1. Redémarrez le container Deno pour charger le secret :');
  console.log('       docker compose -f insforge/docker-compose.yml up -d --build deno');
  console.log('\n    2. Testez l\'agent en passant un appel via Twilio');
  console.log('       Les rendez-vous apparaîtront dans l\'onglet "Rendez-vous"\n');
}

main().catch(e => {
  console.error('❌  Erreur inattendue:', e.message);
  process.exit(1);
});
