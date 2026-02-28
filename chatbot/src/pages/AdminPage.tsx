import { useState, useEffect, type FormEvent } from "react";
import {
  Building2, Users, Clock, XCircle, TrendingUp,
  RefreshCw, ShieldCheck, CreditCard, AlertCircle, LogOut, Eye, EyeOff,
} from "lucide-react";
import {
  apiLogin, decodeJwtPayload,
  apiAdminStats, apiAdminClinics, apiAdminUpdateSubscription,
  type AdminStats, type AdminClinic,
} from "../lib/api";

// ── Session admin isolée (sessionStorage) ──────────────────────────────────
const ADMIN_TOKEN_KEY = "cinique_admin_token";

function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}
function setAdminToken(t: string) {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, t);
}
function clearAdminToken() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}
function isAdminToken(token: string): boolean {
  try {
    const payload = decodeJwtPayload(token);
    if (!payload.is_super_admin) return false;
    // Vérifier que le token n'est pas expiré
    const exp = payload.exp ? Number(payload.exp) : 0;
    if (exp && Date.now() / 1000 > exp) return false;
    return true;
  } catch {
    return false;
  }
}

// ── Constantes UI ──────────────────────────────────────────────────────────
const PLAN_OPTIONS = ["starter", "pro", "enterprise"] as const;
const STATUS_OPTIONS = ["trialing", "active", "past_due", "cancelled", "suspended"] as const;

const PLAN_BADGE: Record<string, string> = {
  starter:    "bg-gray-100 text-gray-700",
  pro:        "bg-teal-100 text-teal-700",
  enterprise: "bg-indigo-100 text-indigo-700",
};
const STATUS_BADGE: Record<string, string> = {
  active:    "bg-green-100 text-green-700",
  trialing:  "bg-blue-100 text-blue-700",
  past_due:  "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
  suspended: "bg-orange-100 text-orange-700",
};
const STATUS_LABEL: Record<string, string> = {
  active:    "Actif",
  trialing:  "Essai",
  past_due:  "En retard",
  cancelled: "Annulé",
  suspended: "Suspendu",
};

type Tab = "overview" | "clinics" | "payments";

// ── Composant KPI ──────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number | string; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-5">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Formulaire de connexion admin ──────────────────────────────────────────
function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await apiLogin(email, password);
      if (!isAdminToken(token)) {
        setError("Ce compte n'a pas les droits d'accès à l'administration.");
        return;
      }
      setAdminToken(token);
      onLogin(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg leading-tight">Admin Plateforme</p>
            <p className="text-xs text-gray-400">Cinique · Accès restreint</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Connexion</h1>
          <p className="text-sm text-gray-500 mb-6">Réservé aux administrateurs de la plateforme</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Adresse email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-colors"
                placeholder="admin@plateforme.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Vérification…
                </span>
              ) : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard admin ────────────────────────────────────────────────────────
export default function AdminPage() {
  const [adminToken, setAdminTokenState] = useState<string | null>(() => {
    const t = getAdminToken();
    return (t && isAdminToken(t)) ? t : null;
  });

  const [tab, setTab]       = useState<Tab>("overview");
  const [stats, setStats]   = useState<AdminStats | null>(null);
  const [clinics, setClinics] = useState<AdminClinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [toast, setToast]     = useState<string | null>(null);

  function handleLogin(token: string) {
    setAdminTokenState(token);
  }

  function handleLogout() {
    clearAdminToken();
    setAdminTokenState(null);
    setStats(null);
    setClinics([]);
  }

  async function load() {
    if (!adminToken) return;
    setLoading(true);
    setError(null);
    try {
      const [s, c] = await Promise.all([
        apiAdminStats(adminToken),
        apiAdminClinics(adminToken),
      ]);
      setStats(s);
      setClinics(c);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // Token expiré ou accès refusé → forcer reconnexion
      if (msg.includes("401") || msg.includes("403") || msg.includes("Forbidden") || msg.includes("token")) {
        clearAdminToken();
        setAdminTokenState(null);
        return;
      }
      setError(msg || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (adminToken) load();
  }, [adminToken]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleUpdate(clinicId: string, field: "plan" | "status", value: string) {
    if (!adminToken) return;
    setSaving(clinicId + field);
    try {
      await apiAdminUpdateSubscription(adminToken, clinicId, { [field]: value });
      setClinics((prev) =>
        prev.map((c) => c.id === clinicId ? { ...c, [field]: value } : c)
      );
      showToast("Mis à jour avec succès");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur de mise à jour");
    } finally {
      setSaving(null);
    }
  }

  // ── Écran de connexion si pas de token admin ──
  if (!adminToken) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Aperçu" },
    { id: "clinics",  label: "Cliniques" },
    { id: "payments", label: "Paiements" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Admin Plateforme</h1>
              <p className="text-xs text-gray-400">Cinique · Gestion interne</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Rafraîchir
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Quitter
            </button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Aperçu ── */}
        {tab === "overview" && (
          <div className="space-y-6">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 h-24 animate-pulse" />
                ))}
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard icon={Building2} label="Total cliniques"     value={stats.total_clinics}   color="bg-gray-100 text-gray-600" />
                  <KpiCard icon={Users}     label="Abonnements actifs"  value={stats.active_clinics}  color="bg-green-100 text-green-600" />
                  <KpiCard icon={Clock}     label="En période d'essai"  value={stats.trial_clinics}   color="bg-blue-100 text-blue-600" />
                  <KpiCard icon={XCircle}   label="Churned"             value={stats.churned_clinics} color="bg-red-100 text-red-600" />
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-5 w-fit">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-100 text-indigo-600 flex-shrink-0">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">Revenu mensuel récurrent (MRR)</p>
                    <p className="text-3xl font-bold text-gray-900 mt-0.5">{Number(stats.mrr).toLocaleString("fr-CA")} $</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Répartition par forfait</h2>
                  <div className="flex flex-wrap gap-4">
                    {(["starter", "pro", "enterprise"] as const).map((plan) => {
                      const count = clinics.filter((c) => c.plan === plan && c.status === "active").length;
                      return (
                        <div key={plan} className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${PLAN_BADGE[plan]}`}>{plan}</span>
                          <span className="text-sm text-gray-600">{count} actif{count > 1 ? "s" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── Cliniques ── */}
        {tab === "clinics" && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Toutes les cliniques</h2>
              <span className="text-xs text-gray-400">{clinics.length} clinique{clinics.length > 1 ? "s" : ""}</span>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>
            ) : clinics.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Aucune clinique enregistrée</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clinique</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Propriétaire</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Forfait</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fournisseur</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Renouvellement</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {clinics.map((clinic) => (
                      <tr key={clinic.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{clinic.name}</p>
                          <p className="text-xs text-gray-400">{new Date(clinic.created_at).toLocaleDateString("fr-CA")}</p>
                        </td>
                        <td className="px-4 py-4 text-gray-500 text-xs">{clinic.owner_email ?? "—"}</td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PLAN_BADGE[clinic.plan] ?? "bg-gray-100 text-gray-600"}`}>
                            {clinic.plan}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[clinic.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABEL[clinic.status] ?? clinic.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {clinic.payment_provider ? (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <CreditCard className="w-3 h-3" />
                              {clinic.payment_provider === "square" ? "Square" : "Stripe"}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-4 text-xs text-gray-500">
                          {clinic.current_period_end
                            ? new Date(clinic.current_period_end).toLocaleDateString("fr-CA")
                            : clinic.trial_ends_at
                            ? `Essai → ${new Date(clinic.trial_ends_at).toLocaleDateString("fr-CA")}`
                            : "—"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={clinic.plan}
                              onChange={(e) => handleUpdate(clinic.id, "plan", e.target.value)}
                              disabled={saving === clinic.id + "plan"}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                            >
                              {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <select
                              value={clinic.status}
                              onChange={(e) => handleUpdate(clinic.id, "status", e.target.value)}
                              disabled={saving === clinic.id + "status"}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                            >
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                            </select>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Paiements ── */}
        {tab === "payments" && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Historique des abonnements</h2>
              <p className="text-xs text-gray-400 mt-0.5">Lecture seule</p>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>
            ) : clinics.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Aucun abonnement</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Clinique</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Forfait</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fournisseur</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID client</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Période fin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {clinics.map((clinic) => (
                      <tr key={clinic.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 font-medium text-gray-900">{clinic.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${PLAN_BADGE[clinic.plan] ?? "bg-gray-100 text-gray-600"}`}>
                            {clinic.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[clinic.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABEL[clinic.status] ?? clinic.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 capitalize">{clinic.payment_provider ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono truncate max-w-[160px]">
                          {clinic.stripe_customer_id ?? clinic.square_customer_id ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {clinic.current_period_end
                            ? new Date(clinic.current_period_end).toLocaleDateString("fr-CA")
                            : clinic.trial_ends_at
                            ? new Date(clinic.trial_ends_at).toLocaleDateString("fr-CA")
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
