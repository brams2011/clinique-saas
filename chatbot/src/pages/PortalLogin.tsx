import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, KeyRound, AlertCircle, Activity } from "lucide-react";
import { apiPortalRequestOtp, apiPortalVerifyOtp } from "../lib/api";
import { usePatientAuth } from "../contexts/PatientAuthContext";

const SS_KEY = "cinique_portal_otp_state";

export default function PortalLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const clinicId = params.get("clinic_id") || "";
  const { loginPatient } = usePatientAuth();

  // Restore step + email from sessionStorage on mount (survives tab switch)
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem(SS_KEY) || "{}"); } catch { return {}; } })();

  const [step, setStep] = useState<1 | 2>(saved.step === 2 && saved.clinicId === clinicId ? 2 : 1);
  const [email, setEmail] = useState(saved.email || "");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist step + email whenever they change
  useEffect(() => {
    if (step === 2) {
      sessionStorage.setItem(SS_KEY, JSON.stringify({ step: 2, email, clinicId }));
    } else {
      sessionStorage.removeItem(SS_KEY);
    }
  }, [step, email, clinicId]);

  function resetToStep1() {
    sessionStorage.removeItem(SS_KEY);
    setStep(1);
    setOtp("");
    setError(null);
    setDevOtp(null);
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !clinicId) return;
    setError(null);
    setLoading(true);
    try {
      const result = await apiPortalRequestOtp(email, clinicId);
      setDevOtp(result.dev_otp ?? null);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp) return;
    setError(null);
    setLoading(true);
    try {
      const result = await apiPortalVerifyOtp(email, clinicId, otp);
      sessionStorage.removeItem(SS_KEY);
      loginPatient(result.token);
      navigate("/portal/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code invalide");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold text-indigo-700">Portail Patient</span>
        </div>

        {step === 1 ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Connexion</h1>
            <p className="text-sm text-gray-500 text-center mb-6">
              Entrez votre adresse email pour recevoir un code de connexion.
            </p>
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !clinicId}
                className="w-full py-2.5 bg-indigo-600 text-white font-semibold text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Envoi…" : "Recevoir mon code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">Code de vérification</h1>
            <p className="text-sm text-gray-500 text-center mb-6">
              Un code à 6 chiffres a été envoyé à <strong>{email}</strong>.
            </p>

            {devOtp && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-800">
                <strong>Mode développement</strong> — code OTP : <code className="font-bold text-lg">{devOtp}</code>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code OTP</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    required
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 tracking-widest font-mono"
                  />
                </div>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-2.5 bg-indigo-600 text-white font-semibold text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "Vérification…" : "Se connecter"}
              </button>
              <button
                type="button"
                onClick={resetToStep1}
                className="w-full text-sm text-indigo-600 hover:underline"
              >
                Changer d'adresse email
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
