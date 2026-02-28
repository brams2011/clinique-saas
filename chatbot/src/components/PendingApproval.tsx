import { Clock, Mail, LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function PendingApproval() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-10 max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-amber-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">Compte en attente</h1>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          Votre compte a été créé avec succès, mais n'a pas encore été configuré par l'administrateur de la clinique.
        </p>

        {/* Role info cards */}
        <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Ce que vous pourrez faire selon votre rôle</p>
          <div className="space-y-2.5">
            {[
              { role: "Administrateur", color: "bg-purple-100 text-purple-700", actions: "Gestion complète — praticiens, patients, RDV, dossiers" },
              { role: "Praticien", color: "bg-indigo-100 text-indigo-700", actions: "Patients, rendez-vous, dossiers médicaux" },
              { role: "Réceptionniste", color: "bg-teal-100 text-teal-700", actions: "Rendez-vous et accueil des patients" },
            ].map((r) => (
              <div key={r.role} className="flex items-start gap-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${r.color}`}>{r.role}</span>
                <span className="text-xs text-gray-600">{r.actions}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact info */}
        <div className="flex items-center gap-3 bg-indigo-50 rounded-xl p-4 mb-6 text-left">
          <Mail className="w-5 h-5 text-indigo-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-indigo-900">Contactez votre administrateur</p>
            <p className="text-xs text-indigo-600 mt-0.5">Connecté en tant que : <strong>{user?.email}</strong></p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mx-auto transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
