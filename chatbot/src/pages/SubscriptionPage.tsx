import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, Check, Zap, Crown, Loader, ShieldOff } from "lucide-react";
import { useAuth, type Plan } from "../contexts/AuthContext";
import { apiGetBillingStatus, apiCreateCheckout, apiOpenPortal, apiCreateSquareCheckout, apiSquareCancel, type BillingStatus } from "../lib/api";

const PLANS: { id: Plan; name: string; price: number; icon: React.ElementType; color: string; features: string[] }[] = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    icon: Zap,
    color: "border-gray-300",
    features: ["Patients & rendez-vous", "Chat IA illimité", "1 admin + 1 praticien", "Support par courriel"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    icon: CreditCard,
    color: "border-indigo-400",
    features: ["Tout le Starter", "Dossiers patients", "SMS confirmation", "Google Calendar", "3 utilisateurs"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 99,
    icon: Crown,
    color: "border-purple-400",
    features: ["Tout le Pro", "Agent vocal IA", "Utilisateurs illimités", "Support prioritaire"],
  },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  trialing:  { label: "Essai gratuit", color: "text-blue-600 bg-blue-50" },
  active:    { label: "Actif",         color: "text-green-600 bg-green-50" },
  past_due:  { label: "Paiement en retard", color: "text-red-600 bg-red-50" },
  cancelled: { label: "Annulé",        color: "text-gray-600 bg-gray-100" },
  suspended: { label: "Suspendu",      color: "text-orange-600 bg-orange-50" },
};

// Square logo SVG inline (simple)
function SquareLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <rect x="7" y="7" width="10" height="10" rx="1" fill="white" />
    </svg>
  );
}

export default function SubscriptionPage() {
  const { token, plan: currentPlan, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const upgradePlan = searchParams.get("upgrade");
  const success = searchParams.get("success");

  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<"stripe" | "square">("stripe");
  const [cancelConfirm, setCancelConfirm] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiGetBillingStatus(token).then(setBilling).catch(() => {});
    // Auto-redirect to checkout if coming from register with a plan
    if (upgradePlan && upgradePlan !== "starter" && token) {
      handleCheckout(upgradePlan);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCheckout(plan: string) {
    if (!token) return;
    setLoadingPlan(plan);
    setError(null);
    try {
      if (provider === "square") {
        const { url } = await apiCreateSquareCheckout(token, plan);
        window.location.href = url;
      } else {
        const { url } = await apiCreateCheckout(token, plan);
        window.location.href = url;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de paiement");
      setLoadingPlan(null);
    }
  }

  async function handlePortal() {
    if (!token) return;
    setPortalLoading(true);
    setError(null);
    try {
      const { url } = await apiOpenPortal(token);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur Stripe");
      setPortalLoading(false);
    }
  }

  async function handleSquareCancel() {
    if (!token) return;
    setPortalLoading(true);
    setError(null);
    try {
      await apiSquareCancel(token);
      setCancelConfirm(false);
      const updated = await apiGetBillingStatus(token);
      setBilling(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur Square");
    } finally {
      setPortalLoading(false);
    }
  }

  const statusInfo = billing ? STATUS_LABELS[billing.status] ?? { label: billing.status, color: "text-gray-600 bg-gray-100" } : null;
  const isSquareSub = billing?.payment_provider === "square" && billing.square_customer_id;
  const isStripeSub = billing?.stripe_customer_id;

  // Only admins/owners can manage subscriptions
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-5 p-8">
        <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <ShieldOff className="w-8 h-8 text-orange-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Accès réservé à l'administrateur</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm">
            La gestion de l'abonnement et du forfait est réservée au propriétaire ou à l'administrateur de la clinique.
          </p>
          <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-3 font-medium capitalize">
            Forfait actif : {billing?.plan ?? "—"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Abonnement</h1>
        <p className="text-sm text-gray-500 mt-1">Gérez votre forfait et votre facturation.</p>
      </div>

      {success && (
        <div className="mb-6 flex items-center gap-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
          <Check className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            Abonnement activé avec succès ! Vos fonctionnalités sont maintenant disponibles.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Current plan card */}
      {billing && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Forfait actuel</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{billing.plan}</p>
              {statusInfo && (
                <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              )}
              {billing.payment_provider && (
                <span className="ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 capitalize">
                  via {billing.payment_provider === "square" ? "Square" : "Stripe"}
                </span>
              )}
              {billing.trial_ends_at && billing.status === "trialing" && (
                <p className="text-xs text-gray-400 mt-1">
                  Essai jusqu'au {new Date(billing.trial_ends_at).toLocaleDateString("fr-CA")}
                </p>
              )}
              {billing.current_period_end && billing.status === "active" && (
                <p className="text-xs text-gray-400 mt-1">
                  Renouvellement le {new Date(billing.current_period_end).toLocaleDateString("fr-CA")}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {isStripeSub && (
                <button
                  onClick={handlePortal}
                  disabled={portalLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {portalLoading ? <Loader className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Gérer / Annuler (Stripe)
                </button>
              )}
              {isSquareSub && billing.status !== "cancelled" && !cancelConfirm && (
                <button
                  onClick={() => setCancelConfirm(true)}
                  disabled={portalLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  <SquareLogo className="w-4 h-4" />
                  Annuler (Square)
                </button>
              )}
              {cancelConfirm && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Confirmer l'annulation ?</span>
                  <button
                    onClick={handleSquareCancel}
                    disabled={portalLoading}
                    className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {portalLoading ? <Loader className="w-3 h-3 animate-spin inline" /> : "Oui, annuler"}
                  </button>
                  <button
                    onClick={() => setCancelConfirm(false)}
                    className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Non
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Provider toggle */}
      <div className="mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Mode de paiement</p>
        <div className="flex gap-2">
          <button
            onClick={() => setProvider("stripe")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              provider === "stripe"
                ? "bg-indigo-600 text-white border-indigo-600"
                : "text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Stripe
          </button>
          <button
            onClick={() => setProvider("square")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              provider === "square"
                ? "bg-sky-600 text-white border-sky-600"
                : "text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            <SquareLogo className="w-4 h-4" />
            Square
          </button>
        </div>
      </div>

      {/* Plan selection */}
      <h2 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">Changer de forfait</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const Icon = plan.icon;
          return (
            <div
              key={plan.id}
              className={`bg-white dark:bg-gray-900 rounded-2xl border-2 ${plan.color} p-5 flex flex-col`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="font-semibold text-gray-900 dark:text-white">{plan.name}</span>
                {isCurrent && (
                  <span className="ml-auto text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                    Actuel
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{plan.price}$<span className="text-sm font-normal text-gray-400">/mois</span></p>
              <ul className="space-y-1.5 flex-1 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={isCurrent || !!loadingPlan}
                className={`w-full py-2 rounded-xl text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                  isCurrent
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600"
                    : provider === "square"
                    ? "bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                }`}
              >
                {loadingPlan === plan.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                    Redirection…
                  </span>
                ) : isCurrent ? "Forfait actuel" : (
                  <span className="flex items-center justify-center gap-1.5">
                    {provider === "square" ? <SquareLogo className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                    Passer au {plan.name}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
