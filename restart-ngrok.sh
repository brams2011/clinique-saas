#!/usr/bin/env bash
# =============================================================================
# restart-ngrok.sh — Cinique SaaS
# Relance ngrok sur le port 7133 et reconfigure automatiquement :
#   - Twilio SMS webhook (+14385000544)
#   - Google Calendar push notification channel
#   - Affiche l'URL à mettre à jour manuellement dans ElevenLabs
# =============================================================================

set -uo pipefail

NGROK_BIN="/tmp/ngrok_new/ngrok"
NGROK_PORT=7133
LOG="/tmp/ngrok_cinique.log"

# ─── Credentials ─────────────────────────────────────────────────────────────
TWILIO_SID="AC85308a972eb7dac1d9323e46d7fc5451"
TWILIO_TOKEN="325deaed6343b098ca3931665cbf20f5"
TWILIO_PHONE_SID="PN8b9dd48ce50c3fa1a29de5a1756c2f1b"

GOOGLE_CLIENT_ID="617594385036-crcfgama7fe5u5d86oghg1lahek98056.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="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"
GOOGLE_REFRESH_TOKEN="1//04NVoHDcTOHhqCgYIARAAGAQSNwF-L9IrX248cHehZnzZI0t1_CexLGKw_RLDbF5mGwpdT66IpkGMyUBdME9mQadu28QrJtnTorU"
GOOGLE_CALENDAR_ID="bddouk@gmail.com"

ELEVENLABS_AGENT_ID="agent_6401k7drd5gxfnwsdx6p5gnre8ma"

# ─── Couleurs ────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; }

echo ""
echo "════════════════════════════════════════════════"
echo "  Cinique SaaS — Démarrage ngrok + webhooks"
echo "════════════════════════════════════════════════"
echo ""

# ─── 1. Vérifier que ngrok existe ────────────────────────────────────────────
if [[ ! -f "$NGROK_BIN" ]]; then
  warn "ngrok non trouvé à $NGROK_BIN — téléchargement..."
  mkdir -p /tmp/ngrok_new
  curl -sL "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip" -o /tmp/ngrok.zip
  cd /tmp && unzip -o ngrok.zip -d ngrok_new/ > /dev/null
  "$NGROK_BIN" config add-authtoken 39z5xgOaQFHFKCQG0hPVSKLNid8_4DQYUh4j8vqNWH8osHHSW > /dev/null
  ok "ngrok téléchargé et configuré"
fi

# ─── 2. Arrêter tout processus ngrok existant ────────────────────────────────
echo "→ Arrêt des tunnels ngrok existants..."
taskkill //F //IM ngrok.exe > /dev/null 2>&1 || true
sleep 1

# ─── 3. Démarrer ngrok ───────────────────────────────────────────────────────
echo "→ Démarrage du tunnel ngrok (port $NGROK_PORT)..."
"$NGROK_BIN" http "$NGROK_PORT" --log=stdout --log-level=info > "$LOG" 2>&1 &
NGROK_PID=$!

# Attendre que le tunnel soit établi (max 15s)
NGROK_URL=""
for i in $(seq 1 15); do
  sleep 1
  NGROK_URL=$(curl -s "http://localhost:4040/api/tunnels" 2>/dev/null \
    | grep -o '"public_url":"https://[^"]*"' \
    | grep -o 'https://[^"]*' | head -1)
  if [[ -n "$NGROK_URL" ]]; then break; fi
done

if [[ -z "$NGROK_URL" ]]; then
  err "Impossible d'établir le tunnel ngrok. Vérifiez les logs : $LOG"
  exit 1
fi

ok "Tunnel actif : $NGROK_URL"
echo ""

# ─── 4. Configurer Twilio ────────────────────────────────────────────────────
echo "→ Configuration Twilio (+14385000544)..."
TWILIO_RESP=$(curl -s -o /dev/null -w "%{http_code}" \
  -u "$TWILIO_SID:$TWILIO_TOKEN" \
  -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_SID/IncomingPhoneNumbers/$TWILIO_PHONE_SID.json" \
  -d "SmsUrl=$NGROK_URL/webhook_twilio&SmsMethod=POST&StatusCallback=$NGROK_URL/webhook_twilio&StatusCallbackMethod=POST")

if [[ "$TWILIO_RESP" == "200" ]]; then
  ok "Twilio SMS webhook → $NGROK_URL/webhook_twilio"
else
  err "Twilio: erreur HTTP $TWILIO_RESP"
fi

# ─── 5. Configurer Google Calendar (via Node.js pour éviter les problèmes d'encodage) ───
echo "→ Enregistrement canal push Google Calendar..."

GCAL_RESULT=$(docker exec insforge node -e "
const https = require('https');
const qs = require('querystring');

async function post(host, path, headers, body) {
  return new Promise((resolve, reject) => {
    const b = typeof body === 'string' ? body : JSON.stringify(body);
    const h = { ...headers, 'Content-Length': Buffer.byteLength(b) };
    const req = https.request({ host, path, method: 'POST', headers: h }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject); req.write(b); req.end();
  });
}

(async () => {
  // 1. Refresh token
  const tok = await post('oauth2.googleapis.com', '/token',
    { 'Content-Type': 'application/x-www-form-urlencoded' },
    qs.stringify({
      client_id: '$GOOGLE_CLIENT_ID',
      client_secret: '$GOOGLE_CLIENT_SECRET',
      refresh_token: '$GOOGLE_REFRESH_TOKEN',
      grant_type: 'refresh_token'
    })
  );
  if (!tok.access_token) { console.log('ERROR:' + JSON.stringify(tok)); process.exit(1); }

  // 2. Register push channel
  const channelId = 'cinique-' + Date.now();
  const cal = await post('www.googleapis.com',
    '/calendar/v3/calendars/' + encodeURIComponent('$GOOGLE_CALENDAR_ID') + '/events/watch',
    { 'Authorization': 'Bearer ' + tok.access_token, 'Content-Type': 'application/json' },
    { id: channelId, type: 'web_hook', address: '$NGROK_URL/webhook_google', expiration: String(Date.now() + 604800000) }
  );

  if (cal.resourceId) {
    console.log('OK:' + channelId + '|' + cal.resourceId);
  } else {
    console.log('ERROR:' + JSON.stringify(cal));
  }
})();
" 2>/dev/null)

if [[ "$GCAL_RESULT" == OK:* ]]; then
  CHANNEL_INFO="${GCAL_RESULT#OK:}"
  CHANNEL_ID="${CHANNEL_INFO%%|*}"
  ok "Google Calendar push → $NGROK_URL/webhook_google (7 jours, channel: $CHANNEL_ID)"
  echo "$CHANNEL_INFO" > /tmp/gcal_channel.txt
else
  err "Google Calendar: $GCAL_RESULT"
fi

# ─── 6. ElevenLabs — instruction manuelle ────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════"
warn "ElevenLabs — Mise à jour manuelle requise"
echo "════════════════════════════════════════════════"
echo ""
echo "  Agent : Clinique_canada ($ELEVENLABS_AGENT_ID)"
echo ""
echo "  → elevenlabs.io/app/conversational-ai"
echo "  → Agent Clinique_canada → Analysis → Post-call webhook"
echo ""
echo "  URL à configurer :"
echo -e "  ${GREEN}$NGROK_URL/webhook_elevenlabs${NC}"
echo ""
echo "  Après avoir sauvegardé, copiez le HMAC secret et exécutez :"
echo "  curl -s -X POST http://localhost:7130/api/secrets \\"
echo "    -H 'Authorization: Bearer ik_4bbb26c10062f34372c95f385437167d' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"key\":\"WEBHOOK_SECRET_ELEVEN\",\"value\":\"<SECRET_ICI>\"}'"
echo ""

# ─── Résumé final ─────────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════"
echo "  Résumé des URLs actives"
echo "════════════════════════════════════════════════"
echo ""
echo "  Base URL   : $NGROK_URL"
echo "  ElevenLabs : $NGROK_URL/webhook_elevenlabs"
echo "  Twilio SMS : $NGROK_URL/webhook_twilio"
echo "  Google Cal : $NGROK_URL/webhook_google"
echo "  Airtable   : $NGROK_URL/webhook_airtable"
echo ""
echo "  ngrok PID  : $NGROK_PID"
echo "  ngrok log  : $LOG"
echo "  ngrok UI   : http://localhost:4040"
echo ""
ok "Prêt à recevoir des webhooks !"
echo ""
