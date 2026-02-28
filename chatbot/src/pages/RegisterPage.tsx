import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiRegister } from "../lib/api";
import { Stethoscope, Check } from "lucide-react";

const PLANS: { id: string; name: string; price: string; desc: string; features: string[]; badge?: true }[] = [
  { id: "starter",    name: "Starter",    price: "19",  desc: "Pour démarrer",     features: ["Patients & RDV", "Chat IA", "1 praticien"] },
  { id: "pro",        name: "Pro",        price: "49",  desc: "Le plus populaire", features: ["Dossiers", "SMS", "3 praticiens"], badge: true },
  { id: "enterprise", name: "Enterprise", price: "99",  desc: "Tout inclus",       features: ["Agent vocal IA", "Illimité"] },
];

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter — 19$/mois",
  pro: "Pro — 49$/mois",
  enterprise: "Enterprise — 99$/mois",
};

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState(searchParams.get("plan") || "starter");

  const [clinicName, setClinicName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setLoading(true);
    try {
      const { token, refreshToken } = await apiRegister(email, password, clinicName, selectedPlan);
      await login(token, refreshToken);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-gradient-to-b from-indigo-700 to-indigo-900 p-10 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg">Cinique</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
            Commencez votre<br />essai gratuit
          </h2>
          <p className="text-indigo-200 text-sm mb-10">
            14 jours gratuits, sans carte de crédit requise.
          </p>
          <ul className="space-y-3">
            {["Accès immédiat à toutes les fonctions", "Configuration en 2 minutes", "Support inclus", "Annulez à tout moment"].map((f) => (
              <li key={f} className="flex items-center gap-3 text-indigo-100 text-sm">
                <Check className="w-4 h-4 text-green-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-indigo-300 text-xs">
          Forfait sélectionné : <span className="font-semibold text-white">{PLAN_LABELS[selectedPlan] ?? selectedPlan}</span>
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white">Cinique</span>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Créer votre clinique</h1>
            <p className="text-sm text-gray-500 mb-7">14 jours d'essai gratuit — aucune carte requise</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Nom de votre clinique
                </label>
                <input
                  type="text"
                  required
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-700 transition-colors dark:text-white"
                  placeholder="Clinique Santé Plus"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Adresse email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-700 transition-colors dark:text-white"
                  placeholder="admin@clinique.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-700 transition-colors dark:text-white"
                  placeholder="8 caractères minimum"
                />
              </div>

              {/* Sélecteur de forfait */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Choisissez votre forfait
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PLANS.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 text-center transition-all ${
                        selectedPlan === plan.id
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {plan.badge && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                          Populaire
                        </span>
                      )}
                      <span className={`text-sm font-bold ${selectedPlan === plan.id ? "text-indigo-700 dark:text-indigo-300" : "text-gray-800 dark:text-gray-200"}`}>
                        {plan.name}
                      </span>
                      <span className={`text-xs font-semibold ${selectedPlan === plan.id ? "text-indigo-600" : "text-gray-500"}`}>
                        {plan.price}$/mois
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  {PLANS.find(p => p.id === selectedPlan)?.features.join(" · ")}
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-4 py-3 rounded-xl">
                  <span className="text-red-500 mt-0.5">⚠</span>
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Création en cours…
                  </span>
                ) : "Créer mon compte"}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 text-center">
              <p className="text-xs text-gray-400">
                Déjà un compte ?{" "}
                <Link to="/login" className="text-indigo-600 font-medium hover:underline">
                  Se connecter
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
