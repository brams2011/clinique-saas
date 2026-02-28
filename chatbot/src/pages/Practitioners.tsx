import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Stethoscope, Plus, X, Save, Lock, User, UserCog, ClipboardList } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useStaff } from "../contexts/StaffContext";
import {
  apiListStaff, apiInviteStaff, apiUpdateStaff,
  apiCreatePatient, decodeJwtSub,
  type ClinicStaff,
} from "../lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  practitioner: "Praticien",
  receptionist: "Réceptionniste",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  practitioner: "bg-indigo-100 text-indigo-700",
  receptionist: "bg-teal-100 text-teal-700",
};

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

// ─── Types ────────────────────────────────────────────────────────────────────

type CreationType = "patient" | "practitioner" | "receptionist" | null;

type StaffForm = {
  first_name: string; last_name: string; email: string; password: string;
  phone: string; specialty: string; role: "practitioner" | "receptionist" | "admin";
};

type PatientForm = {
  first_name: string; last_name: string; email: string; phone: string;
  date_of_birth: string; gender: string; health_card_number: string;
};

const EMPTY_STAFF: StaffForm = {
  first_name: "", last_name: "", email: "", password: "",
  phone: "", specialty: "", role: "practitioner",
};

const EMPTY_PATIENT: PatientForm = {
  first_name: "", last_name: "", email: "", phone: "",
  date_of_birth: "", gender: "", health_card_number: "",
};

// ─── Type selector cards ──────────────────────────────────────────────────────

const TYPE_CARDS = [
  {
    type: "patient" as CreationType,
    label: "Patient",
    desc: "Nouveau dossier patient",
    icon: User,
    color: "border-blue-200 hover:border-blue-400 hover:bg-blue-50",
    iconColor: "text-blue-500 bg-blue-100",
  },
  {
    type: "practitioner" as CreationType,
    label: "Praticien",
    desc: "Médecin, infirmier, spécialiste",
    icon: Stethoscope,
    color: "border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50",
    iconColor: "text-indigo-500 bg-indigo-100",
  },
  {
    type: "receptionist" as CreationType,
    label: "Réceptionniste",
    desc: "Personnel administratif",
    icon: ClipboardList,
    color: "border-teal-200 hover:border-teal-400 hover:bg-teal-50",
    iconColor: "text-teal-500 bg-teal-100",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Practitioners() {
  const { token } = useAuth();
  const { isAdmin } = useStaff();
  const navigate = useNavigate();

  const [staff, setStaff] = useState<ClinicStaff[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [creationType, setCreationType] = useState<CreationType>(null);

  const [staffForm, setStaffForm] = useState<StaffForm>(EMPTY_STAFF);
  const [patientForm, setPatientForm] = useState<PatientForm>(EMPTY_PATIENT);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiListStaff(token)
      .then(setStaff)
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  }, [token]);

  function openForm() {
    setCreationType(null);
    setStaffForm(EMPTY_STAFF);
    setPatientForm(EMPTY_PATIENT);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setCreationType(null);
    setError(null);
  }

  function selectType(t: CreationType) {
    setCreationType(t);
    if (t === "practitioner") setStaffForm((f) => ({ ...f, role: "practitioner" }));
    if (t === "receptionist") setStaffForm((f) => ({ ...f, role: "receptionist" }));
    setError(null);
  }

  function setS(field: keyof StaffForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setStaffForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function setP(field: keyof PatientForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setPatientForm((f) => ({ ...f, [field]: e.target.value }));
  }

  // ─── Create staff ──────────────────────────────────────────────────────────

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);

    try {
      const newStaff = await apiInviteStaff(token, {
        email:      staffForm.email.trim(),
        password:   staffForm.password,
        first_name: staffForm.first_name.trim(),
        last_name:  staffForm.last_name.trim(),
        role:       staffForm.role,
        phone:      staffForm.phone.trim() || null,
        specialty:  staffForm.specialty.trim() || null,
      });

      setStaff((prev) => [...prev, newStaff]);
      closeForm();
      setSuccess(`${newStaff.first_name} ${newStaff.last_name} a été ajouté(e).`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  }

  // ─── Create patient ────────────────────────────────────────────────────────

  async function handleCreatePatient(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);

    try {
      const sub = decodeJwtSub(token);
      const created = await apiCreatePatient(token, {
        first_name: patientForm.first_name.trim(),
        last_name: patientForm.last_name.trim(),
        email: patientForm.email.trim() || null,
        phone: patientForm.phone.trim() || null,
        date_of_birth: patientForm.date_of_birth || null,
        gender: (patientForm.gender as "male" | "female" | "other") || null,
        health_card_number: patientForm.health_card_number.trim() || null,
        is_active: true,
        created_by: sub ?? undefined,
      });
      closeForm();
      navigate(`/patients/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: ClinicStaff) {
    if (!token) return;
    try {
      const updated = await apiUpdateStaff(token, s.id, { is_active: !s.is_active });
      setStaff((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
    } catch (e) {
      console.error(e);
    }
  }

  // ─── Guard ─────────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Lock className="w-12 h-12 text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Accès restreint</h2>
        <p className="text-gray-500 text-sm">Cette section est réservée aux administrateurs.</p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Praticiens & Staff</h1>
          <p className="text-gray-500 text-sm mt-1">{staff.length} membre{staff.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={openForm}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Créer
        </button>
      </div>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* ── Modal de création ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              {creationType && (
                <button
                  onClick={() => setCreationType(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded"
                >
                  <ChevronLeftIcon />
                </button>
              )}
              <h2 className="font-semibold text-gray-800">
                {creationType === null && "Que souhaitez-vous créer ?"}
                {creationType === "patient" && "Nouveau patient"}
                {creationType === "practitioner" && "Nouveau praticien"}
                {creationType === "receptionist" && "Nouveau·elle réceptionniste"}
              </h2>
            </div>
            <button onClick={closeForm} className="p-1 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Étape 1 : Sélection du type ─────────────────────────────── */}
          {creationType === null && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {TYPE_CARDS.map(({ type, label, desc, icon: Icon, color, iconColor }) => (
                <button
                  key={type}
                  onClick={() => selectType(type)}
                  className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all cursor-pointer text-center ${color}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Étape 2a : Formulaire patient ──────────────────────────── */}
          {creationType === "patient" && (
            <form onSubmit={handleCreatePatient} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prénom *</label>
                <input type="text" value={patientForm.first_name} onChange={setP("first_name")} className={INPUT} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
                <input type="text" value={patientForm.last_name} onChange={setP("last_name")} className={INPUT} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                <input type="tel" value={patientForm.phone} onChange={setP("phone")} className={INPUT} placeholder="+1 514 555-0000" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={patientForm.email} onChange={setP("email")} className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date de naissance</label>
                <input type="date" value={patientForm.date_of_birth} onChange={setP("date_of_birth")} className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Genre</label>
                <select value={patientForm.gender} onChange={setP("gender")} className={INPUT}>
                  <option value="">— Sélectionner —</option>
                  <option value="male">Homme</option>
                  <option value="female">Femme</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Numéro carte santé</label>
                <input type="text" value={patientForm.health_card_number} onChange={setP("health_card_number")} className={INPUT} placeholder="XXXX XXXX XXXX" />
              </div>

              {error && (
                <div className="sm:col-span-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              <div className="sm:col-span-2 flex gap-3 justify-end">
                <button type="button" onClick={closeForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  {saving ? "Création..." : "Créer le patient"}
                </button>
              </div>
            </form>
          )}

          {/* ── Étape 2b : Formulaire staff (praticien / réceptionniste) ── */}
          {(creationType === "practitioner" || creationType === "receptionist") && (
            <form onSubmit={handleCreateStaff} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prénom *</label>
                <input type="text" value={staffForm.first_name} onChange={setS("first_name")} className={INPUT} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
                <input type="text" value={staffForm.last_name} onChange={setS("last_name")} className={INPUT} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email (connexion) *</label>
                <input type="email" value={staffForm.email} onChange={setS("email")} className={INPUT} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mot de passe temporaire *</label>
                <input type="password" value={staffForm.password} onChange={setS("password")} className={INPUT} required minLength={8} placeholder="Min. 8 caractères" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                <input type="tel" value={staffForm.phone} onChange={setS("phone")} className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {creationType === "practitioner" ? "Spécialité" : "Poste"}
                </label>
                <input
                  type="text"
                  value={staffForm.specialty}
                  onChange={setS("specialty")}
                  className={INPUT}
                  placeholder={creationType === "practitioner" ? "Ex: Médecine générale" : "Ex: Accueil, Facturation"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Rôle *</label>
                <select value={staffForm.role} onChange={setS("role")} className={INPUT} required>
                  <option value="practitioner">Praticien</option>
                  <option value="receptionist">Réceptionniste</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              {error && (
                <div className="sm:col-span-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
              )}

              <div className="sm:col-span-2 flex gap-3 justify-end">
                <button type="button" onClick={closeForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  {saving ? "Création..." : "Créer le compte"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ── Table staff ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : staff.length === 0 ? (
          <div className="py-16 text-center">
            <UserCog className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Aucun membre du staff</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Rôle</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Spécialité</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Email</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-indigo-600">{s.first_name[0]}{s.last_name[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{s.first_name} {s.last_name}</p>
                        <p className="text-xs text-gray-400 sm:hidden">{ROLE_LABELS[s.role]}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[s.role]}`}>
                      {ROLE_LABELS[s.role]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-sm text-gray-600">{s.specialty ?? "—"}</td>
                  <td className="px-5 py-3.5 hidden lg:table-cell text-sm text-gray-500">{s.email}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => toggleActive(s)}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                        s.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {s.is_active ? "Actif" : "Inactif"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Mini chevron left icon (inline, pas besoin d'import lucide)
function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
