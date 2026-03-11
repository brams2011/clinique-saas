import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, Save, Search, Video } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useClinicSettings } from "../contexts/ClinicSettingsContext";
import {
  apiListPatients,
  apiListStaff,
  apiListAppointments,
  apiCreateAppointment,
  apiGetAppointment,
  apiUpdateAppointment,
  apiSyncClinicCalendar,
  apiSmsConfirm,
  apiSendAppointmentEmail,
  decodeJwtSub,
  type Patient,
  type ClinicStaff,
  type ClinicAppointment,
} from "../lib/api";

const TYPES = [
  { value: "consultation", label: "Consultation" },
  { value: "follow_up", label: "Suivi" },
  { value: "urgent", label: "Urgence" },
  { value: "bilan", label: "Bilan" },
  { value: "other", label: "Autre" },
];

const DURATIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1h" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2h" },
];

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

const DAY_LABELS: Record<string, string> = {
  sunday: "dimanche", monday: "lundi", tuesday: "mardi",
  wednesday: "mercredi", thursday: "jeudi", friday: "vendredi", saturday: "samedi",
};

export default function AppointmentForm() {
  const { token, hasPlan } = useAuth();
  const { settings } = useClinicSettings();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const preselectedPatientId = searchParams.get("patient_id");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<ClinicStaff[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [showPatientList, setShowPatientList] = useState(false);

  const [form, setForm] = useState({
    patient_id: preselectedPatientId ?? "",
    practitioner_id: "",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    duration: 30,
    type: "consultation",
    reason: "",
    notes: "",
    is_virtual: false,
  });

  const [smsPhone, setSmsPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([apiListPatients(token), apiListStaff(token)]).then(([p, s]) => {
      setPatients(p);
      setStaff(s);
      if (preselectedPatientId) {
        const pat = p.find((x) => x.id === preselectedPatientId);
        if (pat) setPatientSearch(`${pat.first_name} ${pat.last_name}`);
      }
      if (isEdit && id) {
        return apiGetAppointment(token, id).then((appt) => {
          const start = new Date(appt.start_time);
          const end = new Date(appt.end_time);
          const durationMins = Math.round((end.getTime() - start.getTime()) / 60000);
          const pat = p.find((x) => x.id === appt.patient_id);
          setForm({
            patient_id: appt.patient_id,
            practitioner_id: appt.practitioner_id,
            date: start.toISOString().slice(0, 10),
            time: start.toTimeString().slice(0, 5),
            duration: durationMins,
            type: appt.type,
            reason: appt.reason ?? "",
            notes: appt.notes ?? "",
            is_virtual: appt.is_virtual ?? false,
          });
          if (pat) setPatientSearch(`${pat.first_name} ${pat.last_name}`);
        });
      }
    }).finally(() => setLoading(false));
  }, [token, isEdit, id, preselectedPatientId]);

  const filteredPatients = patients.filter((p) => {
    const q = patientSearch.toLowerCase();
    return `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) || (p.phone ?? "").includes(q);
  });

  function selectPatient(p: Patient) {
    setForm((f) => ({ ...f, patient_id: p.id }));
    setPatientSearch(`${p.first_name} ${p.last_name}`);
    setSmsPhone(p.phone ?? "");
    setShowPatientList(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.patient_id || !form.practitioner_id) {
      setError("Veuillez sélectionner un patient et un praticien.");
      return;
    }
    setSaving(true);
    setError(null);

    const startTime = new Date(`${form.date}T${form.time}:00`);
    const endTime = new Date(startTime.getTime() + form.duration * 60000);
    const sub = decodeJwtSub(token);

    // ── Validation date passée ─────────────────────────────────────────────
    if (!isEdit && startTime < new Date()) {
      setError("La date et l'heure du rendez-vous ne peuvent pas être dans le passé.");
      setSaving(false);
      return;
    }

    // ── Validation heures d'ouverture et jours ouvrables ──────────────────
    if (settings) {
      const openTime  = settings.working_hours_start ?? "08:00";
      const closeTime = settings.working_hours_end   ?? "18:00";
      const workDays: string[] = JSON.parse(settings.working_days ?? '["monday","tuesday","wednesday","thursday","friday"]');

      // Vérifier le jour
      const dayOfWeek = startTime.getDay(); // 0=dimanche
      const isWorkDay = workDays.some((d) => DAY_MAP[d] === dayOfWeek);
      if (!isWorkDay) {
        const workDayLabels = workDays.map((d) => DAY_LABELS[d] ?? d).join(", ");
        setError(`La clinique est fermée ce jour. Jours ouvrables : ${workDayLabels}.`);
        setSaving(false);
        return;
      }

      // Vérifier l'heure d'ouverture
      const apptTime = form.time; // "HH:MM"
      const endTimeStr = endTime.toTimeString().slice(0, 5);
      if (apptTime < openTime) {
        setError(`La clinique ouvre à ${openTime}. Veuillez choisir une heure après l'ouverture.`);
        setSaving(false);
        return;
      }
      if (endTimeStr > closeTime) {
        setError(`La clinique ferme à ${closeTime}. Le rendez-vous (${apptTime} + ${form.duration} min) dépasse l'heure de fermeture.`);
        setSaving(false);
        return;
      }
    }

    // ── Vérification des conflits ──────────────────────────────────────────
    try {
      const dayStart = new Date(`${form.date}T00:00:00`).toISOString();
      const dayEnd   = new Date(`${form.date}T23:59:59`).toISOString();
      const existing = await apiListAppointments(token, {
        practitioner_id: form.practitioner_id,
        date_from: dayStart,
        date_to: dayEnd,
      });
      const conflict = existing.find((appt: ClinicAppointment) => {
        if (isEdit && appt.id === id) return false; // ignorer le RDV en cours de modification
        if (["cancelled", "no_show"].includes(appt.status)) return false;
        const eStart = new Date(appt.start_time).getTime();
        const eEnd   = new Date(appt.end_time).getTime();
        // chevauchement : newStart < eEnd ET newEnd > eStart
        return startTime.getTime() < eEnd && endTime.getTime() > eStart;
      });
      if (conflict) {
        const conflictStart = new Date(conflict.start_time).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
        const conflictEnd   = new Date(conflict.end_time).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
        setError(`Conflit : ce praticien a déjà un RDV de ${conflictStart} à ${conflictEnd}. Choisissez un autre créneau.`);
        setSaving(false);
        return;
      }
    } catch {
      // En cas d'erreur de vérification, on laisse passer (non bloquant)
    }

    try {
      const patient = patients.find((p) => p.id === form.patient_id);
      const typeLabel = TYPES.find((t) => t.value === form.type)?.label ?? form.type;
      const calSummary = `RDV Clinique — ${patient ? `${patient.first_name} ${patient.last_name}` : "Patient"}`;
      const calDescription = [typeLabel, form.reason, form.notes].filter(Boolean).join(" · ");

      if (isEdit && id) {
        const updated = await apiUpdateAppointment(token, id, {
          patient_id: form.patient_id,
          practitioner_id: form.practitioner_id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          type: form.type,
          reason: form.reason || null,
          notes: form.notes || null,
          is_virtual: form.is_virtual,
        });
        // Update Google Calendar event in background (non-blocking)
        apiSyncClinicCalendar(token, {
          action: updated.google_event_id ? "update" : "create",
          event_id: updated.google_event_id ?? undefined,
          summary: calSummary,
          description: calDescription,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          patient_email: patient?.email ?? undefined,
        }).then((cal) => {
          if (cal.event_id && cal.event_id !== updated.google_event_id) {
            apiUpdateAppointment(token, id, { google_event_id: cal.event_id }).catch(() => {});
          }
        }).catch(() => {});
      } else {
        const created = await apiCreateAppointment(token, {
          patient_id: form.patient_id,
          practitioner_id: form.practitioner_id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          type: form.type,
          status: "scheduled",
          reason: form.reason || null,
          notes: form.notes || null,
          created_by: sub ?? undefined,
          is_virtual: form.is_virtual,
        });
        // If virtual, set the meeting URL
        if (form.is_virtual) {
          apiUpdateAppointment(token, created.id, {
            virtual_meeting_url: `https://meet.jit.si/cinique-${created.id}`,
          }).catch(() => {});
        }
        // Create Google Calendar event in background (non-blocking)
        apiSyncClinicCalendar(token, {
          action: "create",
          summary: calSummary,
          description: calDescription,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          patient_email: patient?.email ?? undefined,
        }).then((cal) => {
          if (cal.event_id) {
            apiUpdateAppointment(token, created.id, { google_event_id: cal.event_id }).catch(() => {});
          }
        }).catch(() => {});
        // Send appointment confirmation email with portal link (Enterprise + patient has email)
        if (hasPlan("enterprise") && patient?.email) {
          apiSendAppointmentEmail(token, created.id).catch(() => {});
        }
        // Send SMS confirmation if phone is available
        if (smsPhone) {
          // Normalize to E.164 — if 10 digits (North America), prepend +1
          const rawPhone = smsPhone.replace(/[\s\-().]/g, "");
          const e164Phone = /^\+/.test(rawPhone)
            ? rawPhone
            : rawPhone.length === 10
            ? `+1${rawPhone}`
            : `+${rawPhone}`;
          apiSmsConfirm(token, {
            patient_name: patient ? `${patient.first_name} ${patient.last_name}` : "Patient",
            patient_phone: e164Phone,
            start_time: startTime.toISOString(),
          }).catch(() => {});
        }
      }
      navigate("/appointments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? "Modifier le rendez-vous" : "Nouveau rendez-vous"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Participants</h2>

          {/* Patient search */}
          <Field label="Patient" required>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => { setPatientSearch(e.target.value); setShowPatientList(true); }}
                onFocus={() => setShowPatientList(true)}
                placeholder="Rechercher un patient..."
                className={`${INPUT} pl-9`}
              />
              {showPatientList && filteredPatients.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {filteredPatients.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPatient(p)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 flex justify-between items-center"
                    >
                      <span className="font-medium">{p.first_name} {p.last_name}</span>
                      <span className="text-gray-400 text-xs">{p.phone ?? ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!form.patient_id && patientSearch && (
              <p className="text-xs text-amber-600 mt-1">Sélectionnez un patient dans la liste</p>
            )}
          </Field>

          {/* Phone for SMS */}
          {form.patient_id && (
            <Field label="Téléphone (SMS de confirmation)">
              <input
                type="tel"
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                placeholder="+15141234567"
                className={INPUT}
              />
              {smsPhone && (
                <p className="text-xs text-green-600 mt-1">SMS de confirmation sera envoyé à ce numéro</p>
              )}
              {!smsPhone && (
                <p className="text-xs text-gray-400 mt-1">Aucun téléphone — pas de SMS envoyé</p>
              )}
            </Field>
          )}

          {/* Practitioner */}
          <Field label="Praticien" required>
            <select
              value={form.practitioner_id}
              onChange={(e) => setForm((f) => ({ ...f, practitioner_id: e.target.value }))}
              className={INPUT}
              required
            >
              <option value="">— Sélectionner un praticien —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}{s.specialty ? ` · ${s.specialty}` : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Date et heure</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Date" required>
                <input
                  type="date"
                  value={form.date}
                  min={isEdit ? undefined : new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className={INPUT}
                  required
                />
              </Field>
            </div>
            <Field label="Heure" required>
              <input
                type="time"
                value={form.time}
                min={settings?.working_hours_start ?? "08:00"}
                max={settings?.working_hours_end   ?? "18:00"}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className={INPUT}
                required
              />
            </Field>
          </div>
          <Field label="Durée">
            <select value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))} className={INPUT}>
              {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Détails</h2>
          <Field label="Type de consultation">
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={INPUT}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Motif de consultation">
            <input type="text" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className={INPUT} placeholder="Ex: Douleur lombaire, suivi tension..." />
          </Field>
          <Field label="Notes internes">
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className={`${INPUT} resize-none`} placeholder="Notes pour le praticien..." />
          </Field>

          {hasPlan("enterprise") && (
            <div className="flex items-center justify-between p-4 bg-violet-50 border border-violet-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center">
                  <Video className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Consultation par vidéo</p>
                  <p className="text-xs text-gray-500">Jitsi Meet — aucun logiciel requis</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.is_virtual}
                onClick={() => setForm((f) => ({ ...f, is_virtual: !f.is_virtual }))}
                className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${form.is_virtual ? "bg-violet-600" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_virtual ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3 justify-end pb-6">
          <button type="button" onClick={() => navigate(-1)} className="px-5 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving || !form.patient_id}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Enregistrement..." : isEdit ? "Enregistrer" : "Créer le RDV"}
          </button>
        </div>
      </form>
    </div>
  );
}
