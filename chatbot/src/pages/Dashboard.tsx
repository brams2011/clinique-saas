import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, Calendar, CheckCircle, Stethoscope,
  Plus, ArrowRight, Clock, UserPlus, CalendarPlus,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useStaff } from "../contexts/StaffContext";
import {
  apiListPatients,
  apiListAppointments,
  apiListStaff,
  type ClinicAppointment,
  type Patient,
  type ClinicStaff,
} from "../lib/api";
import StatusBadge from "../components/clinic/StatusBadge";

const AVATAR_COLORS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-pink-500 to-rose-600",
  "from-cyan-500 to-sky-600",
];

const STATUS_BORDER: Record<string, string> = {
  scheduled: "border-l-blue-400",
  confirmed:  "border-l-emerald-400",
  completed:  "border-l-gray-400",
  cancelled:  "border-l-red-400",
  no_show:    "border-l-amber-400",
};

function StatCard({
  icon: Icon, label, value, sub, gradient, decorationColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  gradient: string;
  decorationColor: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br ${gradient}`}>
      {/* Decorative circles */}
      <div className={`absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-20 ${decorationColor}`} />
      <div className={`absolute -bottom-6 -right-2 w-16 h-16 rounded-full opacity-10 ${decorationColor}`} />
      <div className="relative">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        <p className="text-sm font-medium text-white/80 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-white/60 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { token } = useAuth();
  const { staff } = useStaff();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [todayAppts, setTodayAppts] = useState<ClinicAppointment[]>([]);
  const [staffList, setStaffList] = useState<ClinicStaff[]>([]);
  const [patientMap, setPatientMap] = useState<Record<string, Patient>>({});
  const [staffMap, setStaffMap] = useState<Record<string, ClinicStaff>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const to   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    Promise.all([
      apiListPatients(token),
      apiListAppointments(token, { date_from: from, date_to: to }),
      apiListStaff(token),
    ]).then(([p, a, s]) => {
      setPatients(p);
      setTodayAppts(a);
      setStaffList(s);
      const pm: Record<string, Patient> = {};
      p.forEach((pat) => { pm[pat.id] = pat; });
      setPatientMap(pm);
      const sm: Record<string, ClinicStaff> = {};
      s.forEach((st) => { sm[st.id] = st; });
      setStaffMap(sm);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  const confirmedToday  = todayAppts.filter((a) => a.status === "confirmed").length;
  const scheduledToday  = todayAppts.filter((a) => a.status === "scheduled").length;
  const firstName = staff?.first_name ?? "Docteur";

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateFull(iso: string) {
    return new Date(iso).toLocaleDateString("fr-CA", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  }

  function getHourGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Gradient header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white">
        <div className="absolute -top-8 -right-8 w-48 h-48 bg-white/5 rounded-full" />
        <div className="absolute -bottom-10 right-24 w-32 h-32 bg-white/5 rounded-full" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-indigo-200 text-sm font-medium capitalize">{formatDateFull(new Date().toISOString())}</p>
            <h1 className="text-2xl font-bold mt-1">{getHourGreeting()}, {firstName} 👋</h1>
            <p className="text-indigo-200 text-sm mt-1">
              {todayAppts.length === 0
                ? "Aucun rendez-vous aujourd'hui"
                : `${todayAppts.length} rendez-vous · ${confirmedToday} confirmé${confirmedToday !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link
            to="/appointments/new"
            className="flex items-center gap-2 bg-white text-indigo-700 font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-sm shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Nouveau RDV
          </Link>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Patients actifs"
          value={patients.length}
          gradient="from-blue-500 to-blue-700"
          decorationColor="bg-blue-300"
        />
        <StatCard
          icon={Calendar}
          label="RDV aujourd'hui"
          value={todayAppts.length}
          sub={scheduledToday > 0 ? `${scheduledToday} en attente` : undefined}
          gradient="from-violet-500 to-violet-700"
          decorationColor="bg-violet-300"
        />
        <StatCard
          icon={CheckCircle}
          label="Confirmés"
          value={confirmedToday}
          gradient="from-emerald-500 to-emerald-700"
          decorationColor="bg-emerald-300"
        />
        <StatCard
          icon={Stethoscope}
          label="Praticiens actifs"
          value={staffList.length}
          gradient="from-orange-500 to-amber-600"
          decorationColor="bg-orange-300"
        />
      </div>

      {/* ── Main content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Today's appointments */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-violet-600" />
              </div>
              <h2 className="font-semibold text-gray-800">Rendez-vous d'aujourd'hui</h2>
            </div>
            <Link
              to="/appointments"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              Voir tous <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-14">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : todayAppts.length === 0 ? (
            <div className="py-14 text-center">
              <Calendar className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Aucun rendez-vous aujourd'hui</p>
              <Link
                to="/appointments/new"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" /> Créer un RDV
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {todayAppts.map((appt) => {
                const patient = patientMap[appt.patient_id];
                const practitioner = staffMap[appt.practitioner_id];
                const borderClass = STATUS_BORDER[appt.status] ?? "border-l-gray-300";
                return (
                  <div
                    key={appt.id}
                    className={`flex items-center gap-4 px-5 py-3.5 border-l-4 ${borderClass} hover:bg-gray-50/50 transition-colors`}
                  >
                    <div className="text-right min-w-[56px]">
                      <p className="text-sm font-bold text-gray-800">{formatTime(appt.start_time)}</p>
                      <p className="text-xs text-gray-400">{formatTime(appt.end_time)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {patient ? `${patient.first_name} ${patient.last_name}` : "—"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {practitioner ? `Dr. ${practitioner.last_name}` : "—"} · {appt.type}
                        {appt.reason ? ` · ${appt.reason}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={appt.status} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Actions rapides</h2>
            <div className="space-y-2">
              <Link
                to="/appointments/new"
                className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 transition-colors group"
              >
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-700">
                  <CalendarPlus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-indigo-900">Nouveau rendez-vous</p>
                  <p className="text-xs text-indigo-500">Planifier un RDV patient</p>
                </div>
              </Link>
              <Link
                to="/patients/new"
                className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors group"
              >
                <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-700">
                  <UserPlus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-900">Nouveau patient</p>
                  <p className="text-xs text-emerald-600">Enregistrer un nouveau dossier</p>
                </div>
              </Link>
              <Link
                to="/appointments"
                className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 hover:bg-violet-100 transition-colors group"
              >
                <div className="w-9 h-9 bg-violet-600 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-violet-700">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-violet-900">Tous les RDV</p>
                  <p className="text-xs text-violet-500">Gérer les rendez-vous</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent patients */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="font-semibold text-gray-800">Patients récents</h2>
              </div>
              <Link to="/patients/new" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                + Ajouter
              </Link>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : patients.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">Aucun patient</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {patients.slice(0, 5).map((p, i) => (
                  <Link
                    key={p.id}
                    to={`/patients/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-8 h-8 bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} rounded-full flex items-center justify-center flex-shrink-0`}>
                      <span className="text-xs font-bold text-white">
                        {p.first_name[0]}{p.last_name[0]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-gray-400 truncate">{p.phone ?? p.email ?? "—"}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}

            {patients.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100">
                <Link to="/patients" className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  Voir tous les patients <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
