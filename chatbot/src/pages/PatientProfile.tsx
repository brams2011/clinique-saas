import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, Edit, Plus, Calendar, FileText, Phone, Mail, MapPin, CreditCard, AlertTriangle, Send, Check } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  apiGetPatient,
  apiListAppointments,
  apiListDossiers,
  apiListStaff,
  apiSendPortalInvite,
  type Patient,
  type ClinicAppointment,
  type Dossier,
  type ClinicStaff,
} from "../lib/api";
import StatusBadge from "../components/clinic/StatusBadge";
import DossierForm from "../components/clinic/DossierForm";

type Tab = "info" | "appointments" | "dossiers";

const DOSSIER_TYPE_LABELS: Record<string, string> = {
  note: "Note", consultation: "Consultation", prescription: "Ordonnance",
  lab_result: "Labo", imaging: "Imagerie", referral: "Référence", other: "Autre",
};

export default function PatientProfile() {
  const { token, hasPlan } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, ClinicStaff>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("info");
  const [showDossierForm, setShowDossierForm] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function handleSendPortalInvite() {
    if (!token || !id || inviteSending) return;
    setInviteSending(true);
    setInviteError(null);
    try {
      await apiSendPortalInvite(token, id);
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 4000);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Erreur envoi");
      setTimeout(() => setInviteError(null), 4000);
    } finally {
      setInviteSending(false);
    }
  }

  useEffect(() => {
    if (!token || !id) return;
    Promise.allSettled([
      apiGetPatient(token, id),
      apiListAppointments(token, { patient_id: id }),
      apiListDossiers(token, id),
      apiListStaff(token),
    ]).then(([p, a, d, staff]) => {
      if (p.status === "fulfilled") setPatient(p.value);
      if (a.status === "fulfilled") setAppointments(a.value);
      if (d.status === "fulfilled") setDossiers(d.value);
      if (staff.status === "fulfilled") {
        const sm: Record<string, ClinicStaff> = {};
        staff.value.forEach((s) => { sm[s.id] = s; });
        setStaffMap(sm);
      }
      setLoading(false);
    });
  }, [token, id]);

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-CA");
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("fr-CA", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function formatAge(dob: string | null) {
    if (!dob) return "";
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
    return `${age} ans`;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Patient introuvable.</p>
        <Link to="/patients" className="text-indigo-600 text-sm mt-2 inline-block">← Retour aux patients</Link>
      </div>
    );
  }

  const genderLabel = patient.gender === "male" ? "Homme" : patient.gender === "female" ? "Femme" : patient.gender === "other" ? "Autre" : "—";

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/patients")} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-indigo-600">
                {patient.first_name[0]}{patient.last_name[0]}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{patient.first_name} {patient.last_name}</h1>
              <p className="text-gray-500 text-sm">{genderLabel} · {formatAge(patient.date_of_birth)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasPlan("enterprise") && patient.email && (
            <button
              onClick={handleSendPortalInvite}
              disabled={inviteSending}
              title={inviteError ?? undefined}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                inviteSent
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : inviteError
                  ? "bg-red-100 text-red-700 border border-red-200"
                  : "border border-violet-300 text-violet-700 hover:bg-violet-50"
              } disabled:opacity-50`}
            >
              {inviteSent ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              {inviteSent ? "Invitation envoyée !" : inviteError ? inviteError : "Inviter au portail"}
            </button>
          )}
          <Link
            to={`/appointments/new?patient_id=${patient.id}`}
            className="flex items-center gap-1.5 border border-gray-300 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            Nouveau RDV
          </Link>
          <Link
            to={`/patients/${patient.id}/edit`}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700"
          >
            <Edit className="w-4 h-4" />
            Modifier
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {(["info", "appointments", "dossiers"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "info" ? "Informations" : t === "appointments" ? `Rendez-vous (${appointments.length})` : `Dossiers (${dossiers.length})`}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {tab === "info" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Contact</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {patient.phone ?? "—"}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {patient.email ?? "—"}
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>
                  {[patient.address, patient.city, patient.postal_code].filter(Boolean).join(", ") || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Identité</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CreditCard className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="font-mono">{patient.health_card_number ?? "—"}</span>
              </div>
              <div className="text-sm text-gray-600">
                <span className="text-gray-400 mr-2">Naissance :</span>{formatDate(patient.date_of_birth)}
              </div>
              <div className="text-sm text-gray-600">
                <span className="text-gray-400 mr-2">Genre :</span>{genderLabel}
              </div>
            </div>
          </div>

          {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-800">Contact d'urgence</h3>
              </div>
              <p className="text-sm text-amber-900 font-medium">{patient.emergency_contact_name ?? "—"}</p>
              <p className="text-sm text-amber-700">{patient.emergency_contact_phone ?? "—"}</p>
            </div>
          )}

          {patient.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes générales</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{patient.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Appointments */}
      {tab === "appointments" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link
              to={`/appointments/new?patient_id=${patient.id}`}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Nouveau RDV
            </Link>
          </div>

          {appointments.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Aucun rendez-vous</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-50">
                {appointments.map((appt) => {
                  const practitioner = staffMap[appt.practitioner_id];
                  return (
                    <div key={appt.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{formatDateTime(appt.start_time)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {appt.type} · {practitioner ? `Dr. ${practitioner.last_name}` : "—"}
                          {appt.reason && ` · ${appt.reason}`}
                        </p>
                      </div>
                      <StatusBadge status={appt.status} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Dossiers */}
      {tab === "dossiers" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowDossierForm(true)}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              Nouveau dossier
            </button>
          </div>

          {showDossierForm && (
            <DossierForm
              patientId={patient.id}
              onCreated={(d) => { setDossiers((prev) => [d, ...prev]); setShowDossierForm(false); }}
              onCancel={() => setShowDossierForm(false)}
            />
          )}

          {dossiers.length === 0 && !showDossierForm ? (
            <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Aucun dossier médical</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dossiers.map((d) => {
                const practitioner = d.practitioner_id ? staffMap[d.practitioner_id] : null;
                return (
                  <div key={d.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {DOSSIER_TYPE_LABELS[d.type] ?? d.type}
                          </span>
                          {d.is_confidential && (
                            <span className="text-xs font-medium bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Confidentiel</span>
                          )}
                        </div>
                        <h4 className="font-medium text-gray-900 text-sm">{d.title}</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">{formatDateTime(d.created_at)}</p>
                        {practitioner && <p className="text-xs text-gray-500 mt-0.5">Dr. {practitioner.last_name}</p>}
                      </div>
                    </div>
                    {d.content && <p className="text-sm text-gray-600 whitespace-pre-wrap mt-2">{d.content}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
