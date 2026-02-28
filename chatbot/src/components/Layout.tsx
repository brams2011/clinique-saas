import { NavLink, useNavigate, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  CreditCard,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useAuth, type Plan } from "../contexts/AuthContext";
import { useStaff } from "../contexts/StaffContext";
import { useClinicSettings } from "../contexts/ClinicSettingsContext";
import PendingApproval from "./PendingApproval";

const NAV_ITEMS: { to: string; label: string; icon: React.ElementType; adminOnly: boolean; requiredPlan?: Plan }[] = [
  { to: "/dashboard",    label: "Tableau de bord", icon: LayoutDashboard, adminOnly: false },
  { to: "/patients",     label: "Patients",         icon: Users,           adminOnly: false },
  { to: "/appointments", label: "Rendez-vous",      icon: Calendar,        adminOnly: false },
  { to: "/practitioners",label: "Praticiens",        icon: Stethoscope,     adminOnly: true },
  { to: "/chat",         label: "Chat IA",           icon: MessageSquare,   adminOnly: false },
];

export default function Layout() {
  const { user, logout, hasPlan, isAdmin: isAuthAdmin, plan, isSuperAdmin } = useAuth();
  const { staff, isAdmin, loading: staffLoading } = useStaff();
  const { settings } = useClinicSettings();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!staffLoading && !staff) return <PendingApproval />;

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const displayName = staff
    ? `${staff.first_name} ${staff.last_name}`
    : user?.email ?? "";

  const roleLabel = staff?.role === "admin"
    ? "Administrateur"
    : staff?.role === "receptionist"
    ? "Réceptionniste"
    : "Praticien";

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const PLAN_BADGE: Record<Plan, string> = { starter: "Starter", pro: "Pro", enterprise: "Enterprise" };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-white/20 text-white"
        : "text-indigo-200 hover:bg-white/10 hover:text-white"
    }`;

  function SidebarContent() {
    return (
      <>
        {/* Logo */}
        <div className="p-5 border-b border-indigo-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">{settings?.clinic_name ?? "Clinique"}</p>
              <p className="text-indigo-300 text-xs">{settings?.clinic_type || "Gestion médicale"}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {visibleItems.map(({ to, label, icon: Icon, requiredPlan }) => {
            const locked = requiredPlan && !hasPlan(requiredPlan);
            if (locked) {
              return (
                <NavLink
                  key={to}
                  to="/subscription"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-400 hover:bg-white/10 hover:text-indigo-200 transition-colors"
                >
                  <Icon className="w-4 h-4 flex-shrink-0 opacity-50" />
                  <span className="flex-1 opacity-50">{label}</span>
                  <span className="flex items-center gap-1 text-xs bg-indigo-500/30 text-indigo-200 px-1.5 py-0.5 rounded">
                    <Lock className="w-2.5 h-2.5" />
                    {PLAN_BADGE[requiredPlan]}
                  </span>
                </NavLink>
              );
            }
            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={navLinkClass}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer : Paramètres + utilisateur + plan badge + déconnexion */}
        <div className="p-3 border-t border-indigo-700 space-y-1">
          <NavLink
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className={navLinkClass}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            Paramètres
          </NavLink>

          {isSuperAdmin && (
            <NavLink
              to="/admin"
              onClick={() => setMobileOpen(false)}
              className={navLinkClass}
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              Admin plateforme
            </NavLink>
          )}

          {/* User info + plan badge */}
          <div className="px-3 py-2.5 rounded-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{displayName}</p>
                <p className="text-indigo-300 text-xs">{roleLabel}</p>
              </div>
              {/* Plan badge — cliquable pour admin */}
              {isAuthAdmin ? (
                <NavLink
                  to="/subscription"
                  onClick={() => setMobileOpen(false)}
                  title="Gérer l'abonnement"
                  className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <CreditCard className="w-3 h-3 text-indigo-300" />
                  <span className="text-xs font-semibold text-indigo-200 capitalize">{plan ?? "starter"}</span>
                </NavLink>
              ) : (
                <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-white/10 text-xs font-semibold text-indigo-300 capitalize">
                  {plan ?? "starter"}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-indigo-200 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-indigo-700 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-60 bg-indigo-700 transform transition-transform md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          className="absolute top-3 right-3 p-1 text-indigo-200 hover:text-white"
          onClick={() => setMobileOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <button onClick={() => setMobileOpen(true)} className="p-1 text-gray-500 dark:text-gray-400">
            <Menu className="w-5 h-5" />
          </button>
          <Stethoscope className="w-5 h-5 text-indigo-600" />
          <span className="font-semibold text-gray-800 dark:text-gray-100">{settings?.clinic_name ?? "Clinique"}</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
