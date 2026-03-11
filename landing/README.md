# CliniqueSaaS — Landing Page

Landing page complète en **Next.js 15 / TypeScript / Tailwind CSS v3.4**.

## Stack

| Technologie | Version | Rôle |
|---|---|---|
| Next.js | 15.3.4 | Framework (App Router) |
| React | 19 | UI |
| Tailwind CSS | **3.4.17** (verrouillé) | Styles |
| Framer Motion | 11 | Animations au scroll |
| Lucide React | 0.475 | Icônes |

## Installation

```bash
cd landing
npm install
npm run dev
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000).

## Structure

```
landing/
├── app/
│   ├── globals.css        # Directives Tailwind + base styles
│   ├── layout.tsx         # Root layout (Inter font, metadata)
│   └── page.tsx           # Page principale
├── components/
│   ├── Navbar.tsx          # Navigation sticky
│   ├── HeroSection.tsx     # Hero + dashboard mockup
│   ├── TrustLogos.tsx      # Bandeau logos clients
│   ├── FeaturesSection.tsx # Grille 6 fonctionnalités
│   ├── VideoDemoSection.tsx# Section démo vidéo
│   ├── PricingSection.tsx  # Tarifs avec toggle mensuel/annuel
│   ├── TestimonialsSection.tsx # 3 témoignages
│   ├── FAQSection.tsx      # Accordéon FAQ
│   ├── CTASection.tsx      # CTA final avec formulaire email
│   └── Footer.tsx          # Pied de page 4 colonnes
├── tailwind.config.js      # Couleurs brand + contenu paths
├── postcss.config.js
├── next.config.ts
└── tsconfig.json
```

## Palette de couleurs

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#1A5276` | Bleu médical principal |
| `primary-dark` | `#154360` | Hover, dégradés sombres |
| `primary-light` | `#2E86C1` | Dégradés clairs |
| `accent` | `#1E8449` | Vert accent (CTA, checkmarks) |
| `accent-light` | `#27AE60` | Hover accent |

## Sections

1. **Navbar** — Sticky, ombre au scroll, menu mobile
2. **Hero** — Badge pill, H1, 2 CTA, stats, mockup dashboard animé
3. **Trust Logos** — 6 logos placeholder
4. **Fonctionnalités** — 3×2 grille avec icônes Lucide
5. **Démo vidéo** — Fond bleu foncé, bouton play
6. **Tarifs** — Toggle mensuel/annuel (-20%), 3 plans
7. **Témoignages** — 3 cartes avec avatars et étoiles
8. **FAQ** — Accordéon animé (Framer Motion)
9. **CTA final** — Dégradé, formulaire email
10. **Footer** — 4 colonnes + réseaux sociaux
