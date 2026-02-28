import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiLogin } from "../lib/api";
import { Stethoscope, Shield, Activity } from "lucide-react";

const ROLES = [
  { id: "admin", icon: Shield, label: "Administrateur", desc: "Accès complet à la gestion", color: "border-purple-200 bg-purple-50 text-purple-700" },
  { id: "practitioner", icon: Stethoscope, label: "Praticien", desc: "Médecins et spécialistes", color: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  { id: "receptionist", icon: Activity, label: "Réceptionniste", desc: "Gestion des rendez-vous", color: "border-teal-200 bg-teal-50 text-teal-700" },
];

export default function AuthPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, refreshToken } = await apiLogin(email, password);
      await login(token, refreshToken);
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Email ou mot de passe incorrect");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — role showcase */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-gradient-to-b from-indigo-700 to-indigo-900 p-10 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg">Cinique</span>
          </div>

          <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
            Système de gestion<br />médicale intégré
          </h2>
          <p className="text-indigo-200 text-sm mb-10">
            Gérez vos patients, rendez-vous et dossiers médicaux depuis une seule plateforme sécurisée.
          </p>

          <div className="space-y-3">
            {ROLES.map(({ id, icon: Icon, label, desc }) => (
              <div key={id} className="flex items-center gap-4 bg-white/10 rounded-xl p-4 backdrop-blur">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{label}</p>
                  <p className="text-indigo-200 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-indigo-300 text-xs">
          Les comptes sont créés par l'administrateur de la clinique.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">Cinique</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Connexion</h1>
            <p className="text-sm text-gray-500 mb-7">Accédez à votre espace de gestion</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 focus:bg-white transition-colors"
                  placeholder="praticien@clinique.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 focus:bg-white transition-colors"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
                  <span className="text-red-500 mt-0.5">⚠</span>
                  <p className="text-sm text-red-700">{error}</p>
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
                    Connexion en cours…
                  </span>
                ) : "Se connecter"}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">
                Pas encore de compte ?{" "}
                <Link to="/register" className="text-indigo-600 font-medium hover:underline">
                  Créer votre clinique
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
