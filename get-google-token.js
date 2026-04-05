/**
 * get-google-token.js
 * Lance un serveur HTTP sur port 9876 pour capter le callback OAuth Google
 * Usage : node get-google-token.js
 */
const http = require('http');
const https = require('https');
const url = require('url');

const CLIENT_ID     = '617594385036-crcfgama7fe5u5d86oghg1lahek98056.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI  = 'http://localhost:9877/callback';
const SCOPE         = 'https://www.googleapis.com/auth/calendar https://mail.google.com/';

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id:     CLIENT_ID,
  redirect_uri:  REDIRECT_URI,
  response_type: 'code',
  scope:         SCOPE,
  access_type:   'offline',
  prompt:        'consent',
}).toString();

console.log('\n=== Serveur OAuth Google démarré ===\n');
console.log('1. OUVRE ce lien dans ton navigateur :\n');
console.log('   ' + authUrl + '\n');
console.log('2. Connecte-toi avec bddouk@gmail.com');
console.log('3. Autorise l\'accès au calendrier');
console.log('4. Tu seras redirigé vers localhost:9876 → le refresh token sera affiché ici\n');

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname !== '/callback') {
    res.end('Not found'); return;
  }
  const code = parsed.query.code;
  if (!code) {
    res.writeHead(400); res.end('No code in callback'); return;
  }

  // Exchange code for tokens
  const body = new URLSearchParams({
    code,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri:  REDIRECT_URI,
    grant_type:    'authorization_code',
  }).toString();

  const tokenRes = await new Promise((resolve, reject) => {
    const r = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) },
    }, (resp) => {
      let data = '';
      resp.on('data', d => data += d);
      resp.on('end', () => resolve({ status: resp.statusCode, body: data }));
    });
    r.on('error', reject);
    r.write(body);
    r.end();
  });

  let tokens;
  try { tokens = JSON.parse(tokenRes.body); } catch { tokens = {}; }

  if (tokens.refresh_token) {
    console.log('\n✅ SUCCÈS ! Nouveau refresh token :\n');
    console.log('   ' + tokens.refresh_token + '\n');
    console.log('Commande pour mettre à jour .env :');
    console.log('(remplace la ligne GOOGLE_REFRESH_TOKEN dans insforge/.env)\n');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h1 style="color:green">✅ Succès !</h1><p>Refresh token obtenu. Ferme cette page et reviens dans le terminal.</p><code>${tokens.refresh_token}</code>`);
    setTimeout(() => server.close(), 2000);
  } else {
    console.error('\n❌ Erreur :', tokenRes.body);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<h1 style="color:red">Erreur</h1><pre>${tokenRes.body}</pre>`);
  }
});

server.listen(9877, () => {
  console.log('Serveur en écoute sur http://localhost:9877\n');
});
