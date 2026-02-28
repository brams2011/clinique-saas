import { useNavigate } from "react-router-dom";
import { Check, Stethoscope, Calendar, MessageSquare, Users, PhoneCall, ChevronRight, Shield, Zap, Clock } from "lucide-react";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    description: "Idéal pour démarrer",
    color: "border-gray-200 dark:border-gray-700",
    headerColor: "bg-gray-50 dark:bg-gray-800",
    btnColor: "bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 hover:bg-gray-700",
    badge: null,
    features: [
      "Patients & rendez-vous",
      "Chat IA illimité",
      "1 admin + 1 praticien",
      "Support par courriel",
    ],
    missing: ["SMS confirmation", "Dossiers patients", "Agent vocal", "Utilisateurs illimités"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    description: "Pour les cliniques actives",
    color: "border-teal-500",
    headerColor: "bg-teal-500",
    btnColor: "bg-teal-600 text-white hover:bg-teal-700",
    badge: "Le plus populaire",
    features: [
      "Tout le Starter",
      "Dossiers patients complets",
      "SMS de confirmation/annulation",
      "Sync Google Calendar",
      "1 admin + 3 praticiens",
    ],
    missing: ["Agent vocal ElevenLabs", "Utilisateurs illimités"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    description: "Fonctionnalités complètes",
    color: "border-indigo-500",
    headerColor: "bg-indigo-600",
    btnColor: "bg-indigo-600 text-white hover:bg-indigo-700",
    badge: "Tout inclus",
    features: [
      "Tout le Pro",
      "Agent vocal IA (ElevenLabs)",
      "Utilisateurs illimités",
      "Support prioritaire",
    ],
    missing: [],
  },
];

const QUICK_ACCESS = [
  { icon: Calendar,      label: "Prise de rendez-vous",  desc: "Gestion automatisée",    plan: "pro"        },
  { icon: MessageSquare, label: "Chat IA",                desc: "Assistant 24/7",          plan: "starter"    },
  { icon: PhoneCall,     label: "Agent vocal IA",         desc: "ElevenLabs intégré",      plan: "enterprise" },
  { icon: Users,         label: "Dossiers patients",      desc: "Suivi complet",           plan: "enterprise" },
];

const FEATURES = [
  { icon: Zap,    title: "IA intégrée",       desc: "Assistant médical intelligent basé sur Claude — répond aux questions cliniques en secondes." },
  { icon: Clock,  title: "Gain de temps",     desc: "Automatisez la prise de rendez-vous, les rappels SMS et la gestion des patients." },
  { icon: Shield, title: "Données sécurisées",desc: "Infrastructure multi-tenant isolée — vos données cliniques sont totalement privées." },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 font-sans">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-teal-600 text-white text-xs py-2 px-6 flex items-center justify-between">
        <span>Essai gratuit 14 jours — aucune carte requise</span>
        <div className="flex gap-4">
          <a href="mailto:support@cinique.ca" className="hover:underline opacity-80">support@cinique.ca</a>
        </div>
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-teal-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Cinique</span>
              <span className="hidden sm:inline text-xs text-teal-600 font-medium ml-2">Gestion clinique IA</span>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600 dark:text-gray-400">
            <a href="#features" className="hover:text-teal-600 transition-colors">Fonctions</a>
            <a href="#pricing" className="hover:text-teal-600 transition-colors">Forfaits</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-teal-600 transition-colors"
            >
              Connexion
            </button>
            <button
              onClick={() => navigate("/register")}
              className="px-5 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
            >
              Commencer
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden bg-teal-800"
        style={{
          backgroundImage: "url('/hero-clinic.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Dark overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/60 to-black/40" />
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 grid lg:grid-cols-5 gap-10 items-center">
          {/* Left text */}
          <div className="lg:col-span-3 text-white" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/25 text-white text-xs font-semibold mb-5">
              <Stethoscope className="w-3.5 h-3.5" />
              Logiciel de gestion clinique IA
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-5 drop-shadow-xl">
              Gérez votre clinique avec l'intelligence artificielle
            </h1>
            <p className="text-white text-lg mb-8 max-w-xl leading-relaxed drop-shadow-md">
              Rendez-vous, patients, SMS, dossiers et agent vocal — tout automatisé par IA.
              Choisissez votre forfait et commencez en 2 minutes.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate("/register")}
                className="flex items-center gap-2 px-7 py-3.5 bg-white text-teal-700 font-bold rounded-xl hover:bg-teal-50 transition-colors shadow-lg"
              >
                Essai gratuit 14 jours
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-7 py-3.5 border-2 border-white/60 text-white font-semibold rounded-xl hover:bg-white/15 transition-colors"
              >
                Voir les forfaits
              </button>
            </div>
            <div className="mt-8 flex flex-wrap gap-5 text-sm text-white">
              {["14 jours gratuits", "Aucune carte requise", "Annulation facile"].map((t) => (
                <span key={t} className="flex items-center gap-1.5 drop-shadow-md">
                  <Check className="w-4 h-4 text-teal-300" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right quick-access card */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-teal-50 dark:bg-teal-900/30 px-5 py-4 border-b border-teal-100 dark:border-teal-800">
                <p className="text-sm font-bold text-teal-800 dark:text-teal-300">Accès rapide</p>
                <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">Fonctionnalités disponibles selon votre forfait</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {QUICK_ACCESS.map(({ icon: Icon, label, desc, plan }) => (
                  <button
                    key={label}
                    onClick={() => navigate(`/register?plan=${plan}`)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-200 transition-colors">
                      <Icon className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-teal-600 transition-colors" />
                  </button>
                ))}
              </div>
              <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800/50">
                <p className="text-xs text-center text-gray-500">
                  Déjà abonné ?{" "}
                  <button onClick={() => navigate("/login")} className="text-teal-600 font-semibold hover:underline">
                    Se connecter
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Pourquoi Cinique ?</h2>
            <p className="text-gray-500 dark:text-gray-400">L'IA au service de votre clinique, de A à Z.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white dark:bg-gray-800 rounded-2xl p-7 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-6 bg-white dark:bg-gray-950">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Choisissez votre forfait</h2>
            <p className="text-gray-500 dark:text-gray-400">14 jours d'essai gratuit — aucune carte de crédit requise</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 ${plan.color} overflow-hidden flex flex-col ${plan.badge ? "shadow-xl scale-105" : "shadow-sm"} transition-shadow hover:shadow-lg`}
              >
                {/* Plan header */}
                <div className={`${plan.headerColor} p-6 ${plan.id === "starter" ? "text-gray-900 dark:text-white" : "text-white"}`}>
                  {plan.badge && (
                    <div className="inline-block px-2.5 py-0.5 text-xs font-bold bg-white/25 rounded-full mb-3">
                      {plan.badge}
                    </div>
                  )}
                  <h3 className="text-xl font-extrabold">{plan.name}</h3>
                  <p className={`text-sm mt-0.5 ${plan.id === "starter" ? "text-gray-500 dark:text-gray-400" : "opacity-80"}`}>{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold">{plan.price}$</span>
                    <span className={`text-sm ${plan.id === "starter" ? "text-gray-400" : "opacity-70"}`}>/mois</span>
                  </div>
                </div>

                {/* Features */}
                <div className="bg-white dark:bg-gray-900 p-6 flex-1 flex flex-col">
                  <ul className="space-y-2.5 flex-1 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                        <Check className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                    {plan.missing.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300 dark:text-gray-600">
                        <span className="w-4 h-4 mt-0.5 shrink-0 text-center text-xs">—</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => navigate(`/register?plan=${plan.id}`)}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${plan.btnColor}`}
                  >
                    Commencer avec {plan.name}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 mt-8">
            Paiement par Stripe ou Square · Facturation mensuelle · Annulez à tout moment
          </p>
        </div>
      </section>

      {/* ── CTA banner ──────────────────────────────────────────────────────── */}
      <section className="bg-teal-600 py-14 px-6 text-center text-white">
        <h2 className="text-2xl font-bold mb-3">Prêt à moderniser votre clinique ?</h2>
        <p className="text-teal-100 mb-7 max-w-md mx-auto">
          Rejoignez les cliniques qui font confiance à Cinique pour automatiser leur gestion.
        </p>
        <button
          onClick={() => navigate("/register")}
          className="px-8 py-3.5 bg-white text-teal-700 font-bold rounded-xl hover:bg-teal-50 transition-colors shadow-lg"
        >
          Démarrer gratuitement
        </button>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-teal-600 rounded-md flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">Cinique</span>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} Cinique — Logiciel de gestion clinique IA</p>
          <button
            onClick={() => navigate("/login")}
            className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
          >
            Connexion →
          </button>
        </div>
      </footer>
    </div>
  );
}
