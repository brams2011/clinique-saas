import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { apiGetClinicSettings, apiUpdateClinicSettings, type ClinicSettings } from "../lib/api";

interface ClinicSettingsContextValue {
  settings: ClinicSettings | null;
  loading: boolean;
  update: (data: Partial<ClinicSettings>) => Promise<void>;
  reload: () => void;
}

const ClinicSettingsContext = createContext<ClinicSettingsContextValue>({
  settings: null,
  loading: true,
  update: async () => {},
  reload: () => {},
});

export function ClinicSettingsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    apiGetClinicSettings(token)
      .then(setSettings)
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, [token, tick]);

  async function update(data: Partial<ClinicSettings>) {
    if (!token || !settings) return;
    const updated = await apiUpdateClinicSettings(token, settings.id, data);
    setSettings(updated);
  }

  function reload() { setTick((t) => t + 1); }

  return (
    <ClinicSettingsContext.Provider value={{ settings, loading, update, reload }}>
      {children}
    </ClinicSettingsContext.Provider>
  );
}

export function useClinicSettings() {
  return useContext(ClinicSettingsContext);
}
