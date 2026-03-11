import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calendar, Plus, Filter, Video } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  apiListAppointments,
  apiListPatients,
  apiListStaff,
  apiUpdateAppointment,
  apiSyncClinicCalendar,
  type ClinicAppointment,
  type Patient,
  type ClinicStaff,
} from "../lib/api";
import StatusBadge from "../components/clinic/StatusBadge";

const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "scheduled", label: "Planifié" },
  { value: "confirmed", label: "Confirmé" },
  { value: "completed", label: "Terminé" },
  { value: "cancelled", label: "Annulé" },
  { value: "no_show", label: "Absent" },
];

const TYPE_LABELS: Record<string, string> = {
  consultation: "Consultation", follow_up: "Suivi", urgent: "Urgence",
  bilan: "Bilan", other: "Autre",
};

export default function Appointments() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [patientMap, setPatientMap] = useState<Record<string, Patient>>({});
  const [staffMap, setStaffMap] = useState<Record<string, ClinicStaff>>({});
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterPractitioner, setFilterPractitioner] = useState("");
  const [allStaff, setAllStaff] = useState<ClinicStaff[]>([]);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const filters: Parameters<typeof apiListAppointments>[1] = {};
    if (filterStatus) filters.status = filterStatus;
    if (filterPractitioner) filters.practitioner_id = filterPractitioner;
    if (filterDate) {
      // Show all appointments FROM this date (not limited to that single day)
      filters.date_from = new Date(filterDate).toISOString();
    }

    Promise.all([
      apiListAppointments(token, Object.keys(filters).length ? filters : undefined),
      apiListPatients(token),
      apiListStaff(token),
    ]).then(([a, p, s]) => {
      setAppointments(a);
      const pm: Record<string, Patient> = {};
      p.forEach((pat) => { pm[pat.id] = pat; });
      setPatientMap(pm);
      const sm: Record<string, ClinicStaff> = {};
      s.forEach((st) => { sm[st.id] = st; });
      setStaffMap(sm);
      setAllStaff(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token, filterStatus, filterPractitioner, filterDate]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(appt: ClinicAppointment, status: ClinicAppointment["status"]) {
    if (!token) return;
    try {
      const updated = await apiUpdateAppointment(token, appt.id, { status });
      setAppointments((prev) => prev.map((a) => a.id === appt.id ? updated : a));
      // Delete Google Calendar event when cancelling
      if (status === "cancelled" && appt.google_event_id) {
        apiSyncClinicCalendar(token, {
          action: "delete",
          event_id: appt.google_event_id,
        }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("fr-CA", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  function formatDuration(start: string, end: string) {
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    return `${mins} min`;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rendez-vous</h1>
          <p className="text-gray-500 text-sm mt-1">{appointments.length} résultat{appointments.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          to="/appointments/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nouveau RDV
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 whitespace-nowrap">À partir du</span>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filterPractitioner}
          onChange={(e) => setFilterPractitioner(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tous les praticiens</option>
          {allStaff.map((s) => (
            <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
          ))}
        </select>
        <button
          onClick={() => { setFilterDate(""); setFilterStatus(""); setFilterPractitioner(""); }}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Réinitialiser
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Aucun rendez-vous trouvé</p>
            <Link to="/appointments/new" className="mt-3 inline-block text-indigo-600 text-sm font-medium hover:text-indigo-700">
              Créer un rendez-vous →
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Patient</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Praticien</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date / Heure</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {appointments.map((appt) => {
                const patient = patientMap[appt.patient_id];
                const practitioner = staffMap[appt.practitioner_id];
                return (
                  <tr key={appt.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      {patient ? (
                        <Link to={`/patients/${patient.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600">
                          {patient.first_name} {patient.last_name}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-sm text-gray-600">
                      {practitioner ? `Dr. ${practitioner.last_name}` : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {appt.is_virtual && (
                          <Video className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" aria-label="Consultation virtuelle" />
                        )}
                        <p className="text-sm text-gray-900">{formatDateTime(appt.start_time)}</p>
                      </div>
                      <p className="text-xs text-gray-400">{formatDuration(appt.start_time, appt.end_time)}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell text-sm text-gray-600">
                      {TYPE_LABELS[appt.type] ?? appt.type}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={appt.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {appt.status === "scheduled" && (
                          <button
                            onClick={() => updateStatus(appt, "confirmed")}
                            className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100"
                          >
                            Confirmer
                          </button>
                        )}
                        {(appt.status === "scheduled" || appt.status === "confirmed") && (
                          <>
                            <button
                              onClick={() => updateStatus(appt, "completed")}
                              className="text-xs px-2 py-1 bg-gray-50 text-gray-700 rounded hover:bg-gray-100"
                            >
                              Terminé
                            </button>
                            <button
                              onClick={() => updateStatus(appt, "cancelled")}
                              className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100"
                            >
                              Annuler
                            </button>
                          </>
                        )}
                        {appt.is_virtual && (appt.status === "scheduled" || appt.status === "confirmed") && (
                          <button
                            onClick={() => navigate(`/virtual-consultation?appointment_id=${appt.id}`)}
                            className="text-xs px-2 py-1 bg-violet-50 text-violet-700 rounded hover:bg-violet-100 flex items-center gap-1"
                          >
                            <Video className="w-3 h-3" />
                            Rejoindre
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/appointments/${appt.id}/edit`)}
                          className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100"
                        >
                          Modifier
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
