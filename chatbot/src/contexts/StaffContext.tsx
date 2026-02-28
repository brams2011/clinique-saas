import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { type ClinicStaff, apiGetMyStaffProfile } from "../lib/api";
import { useAuth } from "./AuthContext";

interface StaffContextValue {
  staff: ClinicStaff | null;
  role: "admin" | "practitioner" | "receptionist" | null;
  isAdmin: boolean;
  isPractitioner: boolean;
  isReceptionist: boolean;
  loading: boolean;
  reload: () => void;
}

const StaffContext = createContext<StaffContextValue | null>(null);

export function StaffProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [staff, setStaff] = useState<ClinicStaff | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!token) {
      setStaff(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiGetMyStaffProfile(token)
      .then((s) => { setStaff(s); setLoading(false); })
      .catch(() => { setStaff(null); setLoading(false); });
  }, [token, tick]);

  const role = staff?.role ?? null;

  return (
    <StaffContext.Provider value={{
      staff,
      role,
      isAdmin: role === "admin",
      isPractitioner: role === "practitioner",
      isReceptionist: role === "receptionist",
      loading,
      reload: () => setTick((t) => t + 1),
    }}>
      {children}
    </StaffContext.Provider>
  );
}

export function useStaff(): StaffContextValue {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaff must be used within StaffProvider");
  return ctx;
}
