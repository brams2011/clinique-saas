import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  decodeJwtPayload,
  getStoredPatientToken,
  setStoredPatientToken,
  clearStoredPatientToken,
} from "../lib/api";

interface PatientAuthState {
  token: string | null;
  patientId: string | null;
  clinicId: string | null;
  loading: boolean;
}

interface PatientAuthContextValue extends PatientAuthState {
  loginPatient: (token: string) => void;
  logoutPatient: () => void;
}

const PatientAuthContext = createContext<PatientAuthContextValue | null>(null);

export function PatientAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PatientAuthState>({
    token: null, patientId: null, clinicId: null, loading: true,
  });

  useEffect(() => {
    const saved = getStoredPatientToken();
    if (saved) {
      const payload = decodeJwtPayload(saved);
      setState({
        token: saved,
        patientId: payload.patient_id ?? null,
        clinicId: payload.clinic_id ?? null,
        loading: false,
      });
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  function loginPatient(token: string) {
    setStoredPatientToken(token);
    const payload = decodeJwtPayload(token);
    setState({
      token,
      patientId: payload.patient_id ?? null,
      clinicId: payload.clinic_id ?? null,
      loading: false,
    });
  }

  function logoutPatient() {
    clearStoredPatientToken();
    setState({ token: null, patientId: null, clinicId: null, loading: false });
  }

  return (
    <PatientAuthContext.Provider value={{ ...state, loginPatient, logoutPatient }}>
      {children}
    </PatientAuthContext.Provider>
  );
}

export function usePatientAuth() {
  const ctx = useContext(PatientAuthContext);
  if (!ctx) throw new Error("usePatientAuth must be used inside PatientAuthProvider");
  return ctx;
}
