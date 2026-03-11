import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays, FolderOpen, Receipt, Video, LogOut, Activity,
  Clock, CheckCircle2, XCircle, AlertCircle, User, Phone, Mail, Save,
} from "lucide-react";
import { usePatientAuth } from "../contexts/PatientAuthContext";
import {
  apiPortalAppointments, apiPortalDossiers, apiPortalInvoices,
  apiPortalGetProfile, apiPortalUpdateProfile,
  type PortalAppointment, type PortalDossier, type PortalInvoice, type PortalProfile,
} from "../lib/api";

type Tab = "appointments" | "dossiers" | "invoices" | "profile";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  scheduled:  { label: "Planifié",   className: "bg-blue-100 text-blue-700" },
  confirmed:  { label: "Confirmé",   className: "bg-green-100 text-green-700" },
  cancelled:  { label: "Annulé",     className: "bg-red-100 text-red-600" },
  completed:  { label: "Terminé",    className: "bg-gray-100 text-gray-600" },
  no_show:    { label: "Absent",     className: "bg-orange-100 text-orange-600" },
};

const INVOICE_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  brouillon:  { label: "Brouillon",  className: "bg-gray-100 text-gray-600" },
  envoyee:    { label: "Envoyée",    className: "bg-blue-100 text-blue-700" },
  payee:      { label: "Payée",      className: "bg-green-100 text-green-700" },
  en_retard:  { label: "En retard",  className: "bg-red-100 text-red-600" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isUpcoming(iso: string) {
  return new Date(iso) > new Date();
}

export default function PortalDashboard() {
  const navigate = useNavigate();
  const { token, logoutPatient } = usePatientAuth();
  const [tab, setTab] = useState<Tab>("appointments");

  const [appointments, setAppointments] = useState<PortalAppointment[]>([]);
  const [dossiers, setDossiers] = useState<PortalDossier[]>([]);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile edit state
  const [profileForm, setProfileForm] = useState({ phone: "", email: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiPortalAppointments(token),
      apiPortalDossiers(token),
      apiPortalInvoices(token),
      apiPortalGetProfile(token),
    ])
      .then(([a, d, i, p]) => {
        setAppointments(a);
        setDossiers(d);
        setInvoices(i);
        setProfile(p);
        setProfileForm({ phone: p.phone ?? "", email: p.email ?? "" });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const updated = await apiPortalUpdateProfile(token, {
        phone: profileForm.phone || undefined,
        email: profileForm.email || undefined,
      });
      setProfile(updated);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setProfileSaving(false);
    }
  }

  function handleLogout() {
    logoutPatient();
    navigate("/portal/login", { replace: true });
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "appointments", label: "Rendez-vous", icon: CalendarDays, count: appointments.length },
    { id: "dossiers",     label: "Dossiers",    icon: FolderOpen,   count: dossiers.length },
    { id: "invoices",     label: "Factures",    icon: Receipt,      count: invoices.length },
    { id: "profile",      label: "Mon profil",  icon: User },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-indigo-700 text-sm">Portail Patient</span>
            {profile && (
              <span className="hidden sm:block text-sm text-gray-500 ml-2">
                — {profile.first_name} {profile.last_name}
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 mb-6 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-shrink-0 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
              {count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === id ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        ) : (
          <>
            {/* Appointments tab */}
            {tab === "appointments" && (
              <div className="space-y-3">
                {appointments.length === 0 ? (
                  <EmptyState icon={CalendarDays} message="Aucun rendez-vous trouvé." />
                ) : (
                  appointments.map((apt) => {
                    const badge = STATUS_BADGE[apt.status] ?? { label: apt.status, className: "bg-gray-100 text-gray-600" };
                    const upcoming = isUpcoming(apt.start_time);
                    return (
                      <div key={apt.id} className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {apt.is_virtual && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                                  <Video className="w-3 h-3" /> Virtuel
                                </span>
                              )}
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="font-semibold text-gray-900 mt-1">{apt.type || "Consultation"}</p>
                            {apt.reason && <p className="text-sm text-gray-500 mt-0.5">{apt.reason}</p>}
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDate(apt.start_time)}
                            </div>
                          </div>
                          {apt.is_virtual && upcoming && ["scheduled", "confirmed"].includes(apt.status) && (
                            <button
                              onClick={() => navigate(`/portal/consultation?appointment_id=${apt.id}`)}
                              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 transition-colors"
                            >
                              <Video className="w-3.5 h-3.5" />
                              Rejoindre
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Dossiers tab */}
            {tab === "dossiers" && (
              <div className="space-y-3">
                {dossiers.length === 0 ? (
                  <EmptyState icon={FolderOpen} message="Aucun dossier disponible." />
                ) : (
                  dossiers.map((d) => (
                    <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                          {d.type}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString("fr-CA")}</span>
                      </div>
                      <p className="font-semibold text-gray-900">{d.title}</p>
                      {d.content && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{d.content}</p>}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Invoices tab */}
            {tab === "invoices" && (
              <div className="space-y-3">
                {invoices.length === 0 ? (
                  <EmptyState icon={Receipt} message="Aucune facture disponible." />
                ) : (
                  invoices.map((inv) => {
                    const badge = INVOICE_STATUS_BADGE[inv.statut] ?? { label: inv.statut, className: "bg-gray-100 text-gray-600" };
                    return (
                      <div key={inv.id} className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-gray-900">{inv.numero || "—"}</span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400">
                              {inv.date_visite ? new Date(inv.date_visite).toLocaleDateString("fr-CA") : new Date(inv.created_at).toLocaleDateString("fr-CA")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900">{Number(inv.total ?? 0).toFixed(2)} $</p>
                            {inv.statut === "payee" && <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 ml-auto" />}
                            {inv.statut === "en_retard" && <XCircle className="w-4 h-4 text-red-500 mt-0.5 ml-auto" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Profile tab */}
            {tab === "profile" && profile && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
                <h2 className="font-semibold text-gray-900 mb-4">Mon profil</h2>

                {/* Read-only info */}
                <div className="space-y-3 mb-6 pb-6 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-indigo-600">
                        {profile.first_name[0]}{profile.last_name[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{profile.first_name} {profile.last_name}</p>
                      {profile.date_of_birth && (
                        <p className="text-xs text-gray-500">
                          Né(e) le {new Date(profile.date_of_birth).toLocaleDateString("fr-CA")}
                        </p>
                      )}
                    </div>
                  </div>
                  {profile.address && (
                    <p className="text-sm text-gray-600">{profile.address}{profile.city ? `, ${profile.city}` : ""}{profile.postal_code ? ` ${profile.postal_code}` : ""}</p>
                  )}
                </div>

                {/* Editable fields */}
                <form onSubmit={handleProfileSave} className="space-y-4">
                  <p className="text-xs text-gray-500 mb-2">Vous pouvez mettre à jour vos coordonnées :</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="+15141234567"
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="votre@email.com"
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {profileError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {profileError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={profileSaving}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 font-semibold text-sm rounded-lg transition-colors ${
                      profileSaved
                        ? "bg-green-600 text-white"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    } disabled:opacity-50`}
                  >
                    {profileSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {profileSaving ? "Enregistrement…" : profileSaved ? "Enregistré !" : "Enregistrer"}
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Icon className="w-10 h-10 mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
