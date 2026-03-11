# Cinique — SaaS Clinique

Application SaaS multi-tenant pour la gestion de cliniques médicales.

---

## Architecture

```
c:/Cinique-saas/
├── chatbot/              # Frontend React + TypeScript + Vite + Tailwind (port 5173)
├── insforge/             # Backend Docker
│   ├── gateway/          # Node.js API Gateway (port 7130)
│   ├── deno-runner/      # Runner Deno pour les fonctions (port 7133)
│   ├── db/schema.sql     # Schéma PostgreSQL
│   └── docker-compose.yml
├── functions/            # Fonctions serverless Deno (chat_send, sms_confirm, etc.)
└── .env                  # Variables d'environnement (non versionné)
```

### Services Docker
| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| PostgreSQL | `insforge-postgres` | 5432 | Base de données |
| PostgREST | `insforge-postgrest` | 3000 (interne) | API REST auto-générée |
| Gateway | `insforge` | 7130 | Auth + proxy DB + billing |
| Deno runner | `insforge-deno` | 7133 | Fonctions serverless |

### Proxy Vite (dev)
- `/insforge/*` → `http://localhost:7130`
- `/functions/*` → `http://localhost:7133`

---

## Règle critique — Gateway

**Tout changement dans `insforge/gateway/index.js` nécessite un rebuild Docker :**
```bash
cd insforge && docker compose build gateway && docker compose up -d gateway
```
Le code est copié dans l'image au build — les modifications à chaud ne s'appliquent pas.

---

## Plans et fonctionnalités

```javascript
const PLAN_FEATURES = {
  starter:    ['chat', 'appointments'],
  pro:        ['chat', 'appointments', 'sms', 'calendar', 'dossiers'],
  enterprise: ['chat', 'appointments', 'sms', 'calendar', 'dossiers', 'voice'],
};
const PLAN_STAFF_LIMITS = { starter: 2, pro: 4, enterprise: 999 };
```

- **Starter** : 1 admin + 1 praticien, patients + rendez-vous + chat IA
- **Pro** : 1 admin + 3 praticiens, + dossiers médicaux + SMS
- **Enterprise** : illimité, + agent vocal ElevenLabs

---

## Authentification

- **Utilisateurs** : JWT dans `localStorage` (`cinique_token` + `cinique_refresh_token`)
- **Super Admin** : JWT séparé dans `sessionStorage` (`cinique_admin_token`)
- JWT expire après **1h** (utilisateurs normaux), **8h** (super admin)
- Refresh automatique via `/api/auth/refresh` sur erreur 401

### Payload JWT utilisateur
```json
{ "sub": "<userId>", "email": "...", "clinic_id": "...", "plan": "starter", "role": "owner" }
```

---

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `chatbot/src/lib/api.ts` | Toutes les fonctions API du frontend |
| `chatbot/src/lib/constants.ts` | `INSFORGE_URL`, `FUNCTIONS_URL` |
| `chatbot/src/App.tsx` | Routes React |
| `chatbot/src/contexts/AuthContext.tsx` | Session utilisateur |
| `insforge/gateway/index.js` | Gateway principal (auth, proxy, billing) |
| `insforge/db/schema.sql` | Schéma PostgreSQL complet |
| `functions/chat_send.js` | Chat IA via OpenRouter |
| `insforge/.env` | Clés API (non versionné) |

---

## Tables importantes

```
auth_users          — comptes utilisateurs
clinics             — tenants (une ligne par clinique)
clinic_users        — liaison user ↔ clinique (role: owner/admin/practitioner)
clinic_staff        — profil staff de la clinique
clinic_patients     — patients
clinic_appointments — rendez-vous
clinic_dossiers     — dossiers médicaux (Pro+)
clinic_settings     — paramètres de la clinique
subscriptions       — abonnements (plan, status, stripe_id)
chat_conversations  — conversations IA (a clinic_id)
chat_messages       — messages IA (PAS de clinic_id — filtrer par conversation_id)
```

> ⚠️ `chat_messages` n'a **pas** de colonne `clinic_id` — ne pas l'ajouter à `CLINIC_SCOPED_TABLES`.

---

## Création d'un staff (praticien)

Utiliser `/api/staff/invite` (pas `/api/auth/users`) pour lier un nouvel utilisateur à une clinique existante sans créer de nouvelle clinique.

---

## Variables d'environnement (.env)

```
JWT_SECRET=insforge-dev-secret-change-in-prod
SUPABASE_SERVICE_ROLE_KEY=<jwt signé web_anon>
POSTGRES_PASSWORD=postgres123
OPENROUTER_API_KEY=sk-or-v1-...
TWILIO_SID / TWILIO_TOKEN / TWILIO_PHONE
ELEVENLABS_API_KEY / ELEVENLABS_AGENT_ID
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_*
SQUARE_ACCESS_TOKEN / SQUARE_ENVIRONMENT / SQUARE_LOCATION_ID
APP_URL=http://174.88.57.108:5173
```

---

## Commandes utiles

```bash
# Démarrer tous les services
cd insforge && docker compose up -d

# Voir les logs gateway
docker logs insforge --tail=50

# Voir les logs Deno
docker logs insforge-deno --tail=50

# Accès direct PostgreSQL
docker exec -it insforge-postgres psql -U postgres -d insforge

# Rebuild gateway après modif
cd insforge && docker compose build gateway && docker compose up -d gateway

# Démarrer le frontend (dev)
cd chatbot && npm run dev
```

---

## Git

- Branche principale : `clinique-saas`
- Remote : `https://github.com/brams2011/clinique-saas.git`
- `.env` exclu du git (secrets)
- `node_modules/` exclu du git

# clinique-saas — Contexte pour Claude Code

## Stack technique
- Frontend : Next.js 14 (App Router), TypeScript, Tailwind CSS
- Backend : InsForge (accessible via MCP connecté en stdio via Docker)
- Déploiement : VPS Contabo, Nginx, PM2
- URL backend local (dev) : via Ngrok

## MCP InsForge disponible
Le serveur MCP InsForge est connecté via Docker stdio.
Tu peux l'utiliser directement pour :
- Créer/modifier des tables PostgreSQL
- Gérer les policies RLS
- Uploader dans le Storage
- Appeler les Edge Functions

## Structure du projet
/app
  /(dashboard)       → pages protégées (auth requise)
  /api               → routes API Next.js
/src
  /components        → composants réutilisables
  /lib               → utilitaires, helpers
  /lib/facturation   → logique de génération de factures

## Module facturation à intégrer
- Template .docx de référence : /src/lib/facturation/Facture_Clinique_Template.docx
- Variables dynamiques au format {{VARIABLE}}
- Génération côté serveur avec la lib `docx` (npm)
- Stockage des factures générées dans InsForge Storage

## Conventions de code
- Toujours TypeScript strict
- Composants en arrow functions
- Fetch vers InsForge via les helpers dans /src/lib/insforge.ts
- Tailwind uniquement, pas de CSS custom
- Numéro de facture auto : INV-YYYY-XXXX (padded 4 chiffres)

## Variables d'environnement
INSFORGE_URL=...
INSFORGE_KEY=...
NEXT_PUBLIC_APP_URL=...
```

---

### 3 — Le prompt complet à coller dans Claude Code

Lance Claude Code dans le projet et colle ce prompt en une seule fois :
```
Consulte le fichier CLAUDE.md pour le contexte du projet.

Je veux que tu intègres le module de facturation complet.
Le template de référence est dans /src/lib/facturation/Facture_Clinique_Template.docx

Utilise le MCP InsForge pour toutes les opérations base de données.

## ÉTAPE 1 — Base de données via MCP InsForge
Crée la table `factures` avec ces colonnes :
- id UUID PK default gen_random_uuid()
- numero TEXT UNIQUE NOT NULL  (format INV-YYYY-XXXX)
- statut TEXT DEFAULT 'en_attente'  (valeurs: en_attente, payee, annulee)
- patient_nom, patient_ramq, patient_dossier TEXT
- patient_telephone, patient_email, patient_adresse TEXT
- medecin_nom, medecin_licence, medecin_specialite TEXT
- date_visite DATE, date_echeance DATE
- assureur, no_police, no_reclamation TEXT
- lignes JSONB DEFAULT '[]'
- sous_total, remises, ramq_couverture, assurance_couverture DECIMAL(10,2) DEFAULT 0
- tps, tvq, acompte, total DECIMAL(10,2) DEFAULT 0
- notes TEXT, diagnostic_cim10 TEXT
- docx_url TEXT
- clinic_id UUID, created_at TIMESTAMPTZ DEFAULT NOW()

Active RLS. Policy : chaque user voit seulement les factures 
où clinic_id correspond à son clinic_id dans la table users/clinics.

## ÉTAPE 2 — Helper InsForge
Dans /src/lib/insforge.ts, crée les fonctions :
- getFactures(clinicId, page, limit)
- getFacture(id)
- createFacture(data)
- updateFacture(id, data)
- deleteFacture(id)
- uploadDocx(clinicId, numero, buffer) → retourne l'URL publique

## ÉTAPE 3 — Générateur DOCX
Dans /src/lib/facturation/generator.ts :
- Installe le package `docx` si absent
- Crée buildFactureDoc(facture) qui génère le .docx complet
  avec header clinique, bloc patient/médecin, tableau des actes,
  résumé financier, section paiement, signatures
- Remplace toutes les variables {{}} par les vraies données
- Le tableau des lignes est dynamique (boucle sur facture.lignes)
- Calcule TPS 5% et TVQ 9.975% automatiquement

## ÉTAPE 4 — Routes API
Crée /app/api/facturation/route.ts :
- GET  → liste paginée (?page=1&limit=10)
- POST → création + génération automatique du numéro INV-YYYY-XXXX

Crée /app/api/facturation/[id]/route.ts :
- GET, PUT, DELETE

Crée /app/api/facturation/[id]/generate/route.ts :
- POST → génère le .docx, l'uploade dans InsForge Storage,
  met à jour docx_url dans la table, retourne le fichier en téléchargement

Crée /app/api/facturation/[id]/envoyer/route.ts :
- POST → envoie la facture par email au patient avec le .docx en pièce jointe

## ÉTAPE 5 — Pages UI
/app/(dashboard)/facturation/page.tsx :
- Tableau avec colonnes : N° Facture, Patient, Médecin, Date visite, Total, Statut, Actions
- Badge coloré pour le statut (orange=en_attente, vert=payee, rouge=annulee)
- Boutons par ligne : Télécharger, Envoyer, Modifier, Supprimer
- Bouton "Nouvelle facture" en haut à droite
- Pagination

/app/(dashboard)/facturation/nouvelle/page.tsx :
- Formulaire complet en sections :
  Section 1 : Informations patient
  Section 2 : Médecin & assurance
  Section 3 : Actes médicaux (tableau avec ajout/suppression de lignes)
  Section 4 : Calcul automatique des totaux en temps réel
  Section 5 : Notes et diagnostic CIM-10
- Validation des champs obligatoires avant soumission

/app/(dashboard)/facturation/[id]/page.tsx :
- Vue détail de la facture
- Boutons : Modifier le statut, Télécharger, Envoyer par email, Retour

## ÉTAPE 6 — Composants
/src/components/facturation/StatusBadge.tsx
/src/components/facturation/LignesFacture.tsx  (tableau éditable)
/src/components/facturation/TotauxFacture.tsx  (calculs live)

