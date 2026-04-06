import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, Calendar, CheckCircle, Stethoscope,
  Plus, ArrowRight, Clock, UserPlus, CalendarPlus,
  TrendingUp, Activity,
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

const STATUS_CONFIG: Record<string, { bar: string; dot: string }> = {
  scheduled: { bar: "bg-blue-400",    dot: "bg-blue-400" },
  confirmed:  { bar: "bg-emerald-400", dot: "bg-emerald-400" },
  completed:  { bar: "bg-gray-300",   dot: "bg-gray-400" },
  cancelled:  { bar: "bg-red-400",    dot: "bg-red-400" },
  no_show:    { bar: "bg-amber-400",  dot: "bg-amber-400" },
};

function StatCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color: { bg: string; icon: string; text: string; ring: string };
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 ${color.bg} rounded-xl flex items-center justify-center ring-4 ${color.ring}`}>
          <Icon className={`w-5 h-5 ${color.icon}`} />
        </div>
        <TrendingUp className="w-4 h-4 text-gray-200" />
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900 tracking-tight">{value}</p>
        <p className={`text-sm font-medium ${color.text} mt-0.5`}>{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 animate-pulse">
      <div className="w-12 h-8 bg-gray-100 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-gray-100 rounded w-1/3" />
        <div className="h-2.5 bg-gray-100 rounded w-1/2" />
      </div>
      <div className="w-16 h-5 bg-gray-100 rounded-full" />
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
  const completedToday  = todayAppts.filter((a) => a.status === "completed").length;
  const scheduledToday  = todayAppts.filter((a) => a.status === "scheduled").length;
  const progressPct     = todayAppts.length > 0 ? Math.round((completedToday / todayAppts.length) * 100) : 0;
  const firstName = staff?.first_name ?? "Docteur";

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateFull(iso: string) {
    return new Date(iso).toLocaleDateString("fr-CA", {
      weekday: "long", month: "long", day: "numeric",
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

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-800 p-6 text-white">
        {/* decorative blobs */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-violet-400/10 rounded-full translate-y-1/2" />
        <div className="absolute top-4 right-48 w-16 h-16 bg-indigo-400/20 rounded-full" />

        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-indigo-300 text-xs font-medium uppercase tracking-wider mb-1 capitalize">
              {formatDateFull(new Date().toISOString())}
            </p>
            <h1 className="text-2xl font-bold">{getHourGreeting()}, {firstName} 👋</h1>
            <p className="text-indigo-200 text-sm mt-1.5">
              {todayAppts.length === 0
                ? "Aucun rendez-vous planifié aujourd'hui"
                : `${todayAppts.length} rendez-vous planifiés · ${confirmedToday} confirmé${confirmedToday !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Progress pill */}
            {todayAppts.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 min-w-[140px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-indigo-200 font-medium">Progression</span>
                  <span className="text-xs font-bold text-white">{progressPct}%</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-indigo-300 mt-1.5">{completedToday}/{todayAppts.length} terminés</p>
              </div>
            )}

            <Link
              to="/appointments/new"
              className="flex items-center gap-2 bg-white text-indigo-700 font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-sm shadow-lg shadow-indigo-900/30"
            >
              <Plus className="w-4 h-4" />
              Nouveau RDV
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Patients actifs"
          value={patients.length}
          color={{ bg: "bg-blue-50", icon: "text-blue-600", text: "text-blue-600", ring: "ring-blue-50" }}
        />
        <StatCard
          icon={Calendar}
          label="RDV aujourd'hui"
          value={todayAppts.length}
          sub={scheduledToday > 0 ? `${scheduledToday} en attente` : undefined}
          color={{ bg: "bg-violet-50", icon: "text-violet-600", text: "text-violet-600", ring: "ring-violet-50" }}
        />
        <StatCard
          icon={CheckCircle}
          label="Confirmés"
          value={confirmedToday}
          color={{ bg: "bg-emerald-50", icon: "text-emerald-600", text: "text-emerald-600", ring: "ring-emerald-50" }}
        />
        <StatCard
          icon={Stethoscope}
          label="Praticiens"
          value={staffList.length}
          color={{ bg: "bg-amber-50", icon: "text-amber-600", text: "text-amber-600", ring: "ring-amber-50" }}
        />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Appointments list */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">Rendez-vous d'aujourd'hui</h2>
                {!loading && todayAppts.length > 0 && (
                  <p className="text-xs text-gray-400">{todayAppts.length} au total</p>
                )}
              </div>
            </div>
            <Link
              to="/appointments"
              className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              Voir tous <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Status legend */}
          {!loading && todayAppts.length > 0 && (
            <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50/70 border-b border-gray-100">
              {Object.entries({
                scheduled: "En attente",
                confirmed:  "Confirmé",
                completed:  "Terminé",
                cancelled:  "Annulé",
              }).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${STATUS_CONFIG[key]?.dot ?? "bg-gray-300"}`} />
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="divide-y divide-gray-50">
                {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
              </div>
            ) : todayAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                  <Calendar className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-gray-500 text-sm font-medium">Aucun rendez-vous aujourd'hui</p>
                <p className="text-gray-400 text-xs mt-1 text-center">Planifiez un nouveau RDV pour commencer</p>
                <Link
                  to="/appointments/new"
                  className="inline-flex items-center gap-2 mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Créer un RDV
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {todayAppts.map((appt) => {
                  const patient     = patientMap[appt.patient_id];
                  const practitioner = staffMap[appt.practitioner_id];
                  const barColor    = STATUS_CONFIG[appt.status]?.bar ?? "bg-gray-300";
                  return (
                    <div
                      key={appt.id}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/70 transition-colors group"
                    >
                      {/* Time */}
                      <div className="text-right min-w-[52px]">
                        <p className="text-sm font-bold text-gray-800">{formatTime(appt.start_time)}</p>
                        <p className="text-xs text-gray-400">{formatTime(appt.end_time)}</p>
                      </div>

                      {/* Color bar */}
                      <div className={`w-1 h-10 rounded-full flex-shrink-0 ${barColor}`} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {patient ? `${patient.first_name} ${patient.last_name}` : "—"}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {practitioner ? `Dr. ${practitioner.last_name}` : "—"}
                          {appt.type ? ` · ${appt.type}` : ""}
                        </p>
                      </div>

                      <StatusBadge status={appt.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                <Activity className="w-4 h-4 text-gray-500" />
              </div>
              <h2 className="font-semibold text-gray-900 text-sm">Actions rapides</h2>
            </div>
            <div className="space-y-2">
              <Link
                to="/appointments/new"
                className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 transition-colors group"
              >
                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
                  <CalendarPlus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-indigo-900">Nouveau rendez-vous</p>
                  <p className="text-xs text-indigo-400">Planifier un RDV patient</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-indigo-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              <Link
                to="/patients/new"
                className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors group"
              >
                <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200">
                  <UserPlus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Nouveau patient</p>
                  <p className="text-xs text-emerald-400">Enregistrer un dossier</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              <Link
                to="/appointments"
                className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 hover:bg-violet-100 transition-colors group"
              >
                <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-violet-700 transition-colors shadow-sm shadow-violet-200">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-violet-900">Agenda complet</p>
                  <p className="text-xs text-violet-400">Gérer les rendez-vous</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-violet-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>
          </div>

          {/* Recent patients */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="font-semibold text-gray-900 text-sm">Patients récents</h2>
              </div>
              <Link
                to="/patients/new"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                + Ajouter
              </Link>
            </div>

            {loading ? (
              <div className="divide-y divide-gray-50">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                    <div className="w-8 h-8 bg-gray-100 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-gray-100 rounded w-2/3" />
                      <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : patients.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">Aucun patient enregistré</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {patients.slice(0, 5).map((p, i) => (
                  <Link
                    key={p.id}
                    to={`/patients/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group"
                  >
                    <div className={`w-8 h-8 bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} rounded-full flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <span className="text-xs font-bold text-white">
                        {p.first_name?.[0]}{p.last_name?.[0]}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-gray-400 truncate">{p.phone ?? p.email ?? "—"}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            )}

            {patients.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                <Link
                  to="/patients"
                  className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Voir tous les {patients.length} patients <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
