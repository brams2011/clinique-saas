import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  type User,
  apiGetCurrentUser,
  apiLogout,
  decodeJwtPayload,
  getStoredToken,
  getStoredRefreshToken,
  setStoredTokens,
  clearStoredTokens,
  AUTH_EXPIRED_EVENT,
  TOKEN_REFRESHED_EVENT,
} from "../lib/api";

export type Plan = "starter" | "pro" | "enterprise";
export type Role = "owner" | "admin" | "practitioner" | "receptionist";
const PLAN_ORDER: Plan[] = ["starter", "pro", "enterprise"];
const ADMIN_ROLES: Role[] = ["owner", "admin"];

interface AuthState {
  token: string | null;
  user: User | null;
  userId: string | null;
  clinicId: string | null;
  plan: Plan | null;
  role: Role | null;
  isSuperAdmin: boolean;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPlan: (required: Plan) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null, user: null, userId: null, clinicId: null, plan: null, role: null,
    isSuperAdmin: false, loading: true,
  });

  useEffect(() => {
    const savedToken = getStoredToken();
    const savedRefresh = getStoredRefreshToken();
    if (savedToken && savedRefresh) {
      const payload = decodeJwtPayload(savedToken);
      apiGetCurrentUser(savedToken)
        .then((user) =>
          setState({
            token: savedToken, user,
            userId: payload.sub,
            clinicId: payload.clinic_id ?? null,
            plan: (payload.plan as Plan) ?? "starter",
            role: (payload.role as Role) ?? "owner",
            isSuperAdmin: !!payload.is_super_admin,
            loading: false,
          })
        )
        .catch(() => {
          clearStoredTokens();
          setState({ token: null, user: null, userId: null, clinicId: null, plan: null, role: null, isSuperAdmin: false, loading: false });
        });
    } else {
      clearStoredTokens();
      setState((s) => ({ ...s, loading: false }));
    }

    function onExpired() {
      setState({ token: null, user: null, userId: null, clinicId: null, plan: null, role: null, isSuperAdmin: false, loading: false });
    }
    function onRefreshed(e: Event) {
      const newToken = (e as CustomEvent<{ token: string }>).detail.token;
      const payload = decodeJwtPayload(newToken);
      setState((s) =>
        s.token ? {
          ...s, token: newToken,
          userId: payload.sub,
          clinicId: payload.clinic_id ?? s.clinicId,
          plan: (payload.plan as Plan) ?? s.plan,
          role: (payload.role as Role) ?? s.role,
          isSuperAdmin: !!payload.is_super_admin,
        } : s
      );
    }

    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    window.addEventListener(TOKEN_REFRESHED_EVENT, onRefreshed);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
      window.removeEventListener(TOKEN_REFRESHED_EVENT, onRefreshed);
    };
  }, []);

  async function login(token: string, refreshToken: string) {
    setStoredTokens(token, refreshToken);
    const payload = decodeJwtPayload(token);
    const user = await apiGetCurrentUser(token);
    setState({
      token, user,
      userId: payload.sub,
      clinicId: payload.clinic_id ?? null,
      plan: (payload.plan as Plan) ?? "starter",
      role: (payload.role as Role) ?? "owner",
      isSuperAdmin: !!payload.is_super_admin,
      loading: false,
    });
  }

  async function logout() {
    const { token } = state;
    clearStoredTokens();
    setState({ token: null, user: null, userId: null, clinicId: null, plan: null, role: null, isSuperAdmin: false, loading: false });
    if (token) await apiLogout(token).catch(() => {});
  }

  function hasPlan(required: Plan): boolean {
    if (!state.plan) return false;
    return PLAN_ORDER.indexOf(state.plan) >= PLAN_ORDER.indexOf(required);
  }

  const isAdmin = state.role !== null && ADMIN_ROLES.includes(state.role);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPlan, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
