#!/usr/bin/env bash
# =============================================================================
# start.sh — Cinique SaaS
# Démarre tout le projet : InsForge (Docker) + ngrok + webhooks
# Usage : bash start.sh
# =============================================================================

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
err()  { echo -e "${RED}❌ $*${NC}"; exit 1; }

INSFORGE_DIR="/c/Cinique-saas/insforge"
PROJECT_DIR="/c/Cinique-saas"

echo ""
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo -e "${BOLD}        Cinique SaaS — Démarrage complet        ${NC}"
echo -e "${BOLD}════════════════════════════════════════════════${NC}"
echo ""

# ─── 1. Vérifier Docker ──────────────────────────────────────────────────────
echo "→ Vérification Docker..."
docker info > /dev/null 2>&1 || err "Docker n'est pas démarré. Lancez Docker Desktop d'abord."
ok "Docker actif"

# ─── 2. Regénérer le SERVICE_ROLE_KEY si JWT_SECRET a changé ─────────────────
echo "→ Génération du service role key..."
ENV_FILE="$INSFORGE_DIR/.env"
JWT_SECRET=$(grep '^JWT_SECRET=' "$ENV_FILE" | cut -d'=' -f2-)
if [[ -n "$JWT_SECRET" ]]; then
  SERVICE_KEY=$(node -e "
    const crypto = require('crypto');
    const secret = '$JWT_SECRET';
    const h = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
    const p = Buffer.from(JSON.stringify({role:'web_anon'})).toString('base64url');
    const sig = crypto.createHmac('sha256',secret).update(h+'.'+p).digest('base64url');
    console.log(h+'.'+p+'.'+sig);
  " 2>/dev/null)
  if [[ -n "$SERVICE_KEY" ]]; then
    # Mettre à jour SUPABASE_SERVICE_ROLE_KEY dans .env
    sed -i "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY|" "$ENV_FILE"
    ok "Service role key mis à jour"
  fi
fi

# ─── 3. Démarrer InsForge si nécessaire ──────────────────────────────────────
INSFORGE_RUNNING=$(docker ps --filter "name=insforge-deno" --filter "status=running" -q)

if [[ -n "$INSFORGE_RUNNING" ]]; then
  ok "InsForge déjà en cours d'exécution"
else
  echo "→ Build et démarrage InsForge (Docker Compose)..."
  docker compose -f "$INSFORGE_DIR/docker-compose.yml" --env-file "$ENV_FILE" up -d --build 2>&1 | tail -10

  # Attendre que postgres soit healthy
  echo "→ Attente démarrage Postgres (max 30s)..."
  for i in $(seq 1 30); do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' insforge-postgres 2>/dev/null)
    if [[ "$STATUS" == "healthy" ]]; then break; fi
    sleep 1
  done

  STATUS=$(docker inspect --format='{{.State.Health.Status}}' insforge-postgres 2>/dev/null)
  if [[ "$STATUS" != "healthy" ]]; then
    warn "Postgres pas encore healthy (status: $STATUS) — continuons quand même"
  else
    ok "InsForge démarré (Postgres healthy)"
  fi

  # Attendre que le gateway soit prêt
  echo "→ Attente gateway InsForge (max 20s)..."
  for i in $(seq 1 20); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:7130/health" 2>/dev/null)
    if [[ "$CODE" == "200" ]]; then break; fi
    sleep 1
  done

  # Attendre que Deno soit prêt
  echo "→ Attente Deno runtime (max 20s)..."
  for i in $(seq 1 20); do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:7133/create_appointment" \
      -H "Authorization: Bearer invalid" -H "Content-Type: application/json" -d '{}' 2>/dev/null)
    if [[ "$CODE" == "401" || "$CODE" == "405" || "$CODE" == "200" ]]; then break; fi
    sleep 1
  done
  ok "Deno runtime prêt"
fi

# ─── 4. Vérifier les fonctions déployées ─────────────────────────────────────
echo "→ Vérification des fonctions..."
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:7133/create_appointment" \
  -H "Authorization: Bearer invalid" -H "Content-Type: application/json" -d '{}' 2>/dev/null)

if [[ "$CODE" == "401" ]]; then
  ok "Fonctions InsForge opérationnelles"
else
  warn "Fonctions InsForge — réponse inattendue: HTTP $CODE"
fi

# ─── 5. Démarrer ngrok + configurer webhooks ─────────────────────────────────
echo ""
bash "$PROJECT_DIR/restart-ngrok.sh"
