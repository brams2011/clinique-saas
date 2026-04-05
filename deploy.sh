#!/bin/bash
# Script de déploiement — clinique.ino-service.com
# À exécuter sur le VPS en tant que root

set -e

REPO="https://github.com/brams2011/clinique-saas.git"
BRANCH="feature/facturation"
APP_DIR="/opt/cinique-saas"
DOMAIN="clinique.ino-service.com"

echo "=== 1. Dépendances système ==="
apt-get update -qq
apt-get install -y -qq git curl nginx certbot python3-certbot-nginx nodejs npm

# Docker
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "=== 2. Clone / pull du repo ==="
if [ -d "$APP_DIR/.git" ]; then
  cd $APP_DIR && git fetch origin && git checkout $BRANCH && git pull origin $BRANCH
else
  git clone -b $BRANCH $REPO $APP_DIR
fi
cd $APP_DIR

echo "=== 3. Fichier .env ==="
cat > $APP_DIR/insforge/.env << 'ENVEOF'
JWT_SECRET=insforge-prod-secret-change-me-32chars
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoid2ViX2Fub24ifQ.G-oRnqtmAd_MNRrUdg-RBscUMBcJwlz_OC3ldKgp6Ic
POSTGRES_PASSWORD=postgres123
OPENROUTER_API_KEY=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
TWILIO_SID=AC85308a972eb7dac1d9323e46d7fc5451
TWILIO_TOKEN=325deaed6343b098ca3931665cbf20f5
TWILIO_PHONE=+14385000544
ELEVENLABS_API_KEY=sk_c9bb4e974d988cdb3e60d67d7c7c190282d8e421aa3f18c9
ELEVENLABS_AGENT_ID=agent_2801kj8atmh6evarfx5kn61ytwg9
WEBHOOK_SECRET_ELEVEN=d61960c1c23052d326a0dfe45255232cda9e5e81e03d3c1dff1f460e41c9b221
GOOGLE_CLIENT_ID=617594385036-crcfgama7fe5u5d86oghg1lahek98056.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REFRESH_TOKEN=1//04jP6G_HC56ltCgYIARAAGAQSNwF-L9IrRvTLKqLq4VPQrLX7wbbMLCyu-QbX-RcYP8Dyp6sP6nf-Cn-1iGjRQEOOxqxJdHrchq8
GOOGLE_CALENDAR_ID=98b1762bba0c2cb68da3bca14b6dbd40055f895a2887cabba5b245ad6e3e9006@group.calendar.google.com
GMAIL_USER=bddouk@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=bddouk@gmail.com
SMTP_PASS=oahb gqnq dbut vsuw
APP_URL=https://clinique.ino-service.com
SQUARE_ACCESS_TOKEN=EAAAlw6hEGoR3hhLzQJDloEhO1m_K0u09Dd3FQV1RTGxQGvhyCeOxOvWDI5kU1C-
SQUARE_ENVIRONMENT=sandbox
SQUARE_LOCATION_ID=sandbox-sq0idb-i_-bYZ496oiBYv7icfilzA
ENVEOF

echo "=== 4. Build frontend React ==="
cd $APP_DIR/chatbot
npm install --silent
VITE_API_URL=https://clinique.ino-service.com npm run build

echo "=== 5. Docker — backend ==="
cd $APP_DIR/insforge
docker compose build
docker compose up -d

echo "=== 6. Nginx ==="
cat > /etc/nginx/sites-available/cinique << NGINXEOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend React (static)
    root $APP_DIR/chatbot/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Gateway API
    location /insforge/ {
        proxy_pass http://127.0.0.1:7130/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    # Deno functions
    location /functions/ {
        proxy_pass http://127.0.0.1:7133/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 120s;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/cinique /etc/nginx/sites-enabled/cinique
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== 7. SSL Let's Encrypt ==="
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m bddouk@gmail.com

echo ""
echo "✅ Déploiement terminé !"
echo "   https://$DOMAIN"
