import { useState, useEffect, useRef } from "react";
import { Save, Building2, Clock, Sun, Moon, Monitor, Mic, Copy, Check, Users, ExternalLink, Printer } from "lucide-react";
import { useStaff } from "../contexts/StaffContext";
import { useTheme, type Theme } from "../contexts/ThemeContext";
import { useClinicSettings } from "../contexts/ClinicSettingsContext";
import { useAuth } from "../contexts/AuthContext";

const INPUT = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500";

const TIMEZONES = [
  "America/Toronto", "America/Montreal", "America/Vancouver",
  "America/Winnipeg", "America/Halifax", "America/St_Johns",
  "Europe/Paris", "Europe/Brussels", "Europe/Zurich", "UTC",
];

const CLINIC_TYPES = [
  "Médecine générale", "Médecine de famille", "Dentisterie", "Orthophonie",
  "Physiothérapie", "Psychologie", "Dermatologie", "Ophtalmologie",
  "Pédiatrie", "Gynécologie", "Cardiologie", "Neurologie", "Autre",
];

const DAYS = [
  { key: "monday",    label: "Lun" },
  { key: "tuesday",  label: "Mar" },
  { key: "wednesday",label: "Mer" },
  { key: "thursday", label: "Jeu" },
  { key: "friday",   label: "Ven" },
  { key: "saturday", label: "Sam" },
  { key: "sunday",   label: "Dim" },
];

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light",  label: "Clair",   icon: Sun },
  { value: "dark",   label: "Sombre",  icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
];

function VoiceAgentSection({ baseUrl, agentId, onBaseUrlChange, onAgentIdChange }: {
  baseUrl: string; agentId: string;
  onBaseUrlChange: (v: string) => void; onAgentIdChange: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const webhookUrl = baseUrl.replace(/\/$/, "") + ":7133/webhook_elevenlabs";
  const hasUrl = baseUrl.trim() !== "";

  function copyUrl() {
    if (!hasUrl) return;
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const INPUT_CLS = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Mic className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Agent vocal (ElevenLabs)</h2>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        L'agent vocal crée automatiquement des rendez-vous dans l'application lors d'un appel.
        Configurez l'ID de l'agent et l'URL publique du serveur.
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            ID de l'agent ElevenLabs
          </label>
          <input
            type="text"
            value={agentId}
            onChange={(e) => onAgentIdChange(e.target.value)}
            placeholder="agent_xxxxxxxxxxxxxxxxxxxxxxxx"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            URL du serveur (ex: http://123.456.789.0 ou https://mondomaine.com)
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder="http://votre-ip-publique"
            className={INPUT_CLS}
          />
        </div>
        {hasUrl && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              URL webhook (à coller dans ElevenLabs → Agent → Settings → Webhooks)
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300 font-mono break-all">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={copyUrl}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copié" : "Copier"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Building2; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h2>
      </div>
      {children}
    </div>
  );
}

type FormData = {
  clinic_name: string; clinic_type: string;
  responsible_name: string; responsible_title: string;
  phone: string; email: string; address: string;
  city: string; postal_code: string; country: string;
  timezone: string; website: string;
  appointment_duration_mins: number;
  working_hours_start: string; working_hours_end: string;
  voice_agent_base_url: string;
  elevenlabs_agent_id: string;
};

export default function Settings() {
  const { isAdmin } = useStaff();
  const { theme, setTheme } = useTheme();
  const { settings, loading, update } = useClinicSettings();
  const { clinicId, hasPlan } = useAuth();

  const [form, setForm] = useState<FormData>({
    clinic_name: "", clinic_type: "", responsible_name: "", responsible_title: "",
    phone: "", email: "", address: "", city: "", postal_code: "", country: "Canada",
    timezone: "America/Toronto", website: "", appointment_duration_mins: 30,
    working_hours_start: "08:00", working_hours_end: "18:00",
    voice_agent_base_url: "", elevenlabs_agent_id: "",
  });
  const [workingDays, setWorkingDays] = useState<string[]>(["monday","tuesday","wednesday","thursday","friday"]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalLinkCopied, setPortalLinkCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Sync form when context settings load
  useEffect(() => {
    if (!settings) return;
    setForm({
      clinic_name: settings.clinic_name ?? "",
      clinic_type: settings.clinic_type ?? "",
      responsible_name: settings.responsible_name ?? "",
      responsible_title: settings.responsible_title ?? "",
      phone: settings.phone ?? "",
      email: settings.email ?? "",
      address: settings.address ?? "",
      city: settings.city ?? "",
      postal_code: settings.postal_code ?? "",
      country: settings.country ?? "Canada",
      timezone: settings.timezone ?? "America/Toronto",
      website: settings.website ?? "",
      appointment_duration_mins: settings.appointment_duration_mins ?? 30,
      working_hours_start: settings.working_hours_start ?? "08:00",
      working_hours_end: settings.working_hours_end ?? "18:00",
      voice_agent_base_url: settings.voice_agent_base_url ?? "",
      elevenlabs_agent_id: settings.elevenlabs_agent_id ?? "",
    });
    try { setWorkingDays(JSON.parse(settings.working_days ?? "[]")); } catch { /* ignore */ }
  }, [settings]);

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function toggleDay(day: string) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  const portalUrl = clinicId ? `${window.location.origin}/portal/login?clinic_id=${clinicId}` : "";

  function copyPortalLink() {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl).then(() => {
      setPortalLinkCopied(true);
      setTimeout(() => setPortalLinkCopied(false), 2000);
    });
  }

  function drawQr() {
    if (!portalUrl || !qrCanvasRef.current) return;
    // Simple URL-to-QR using Google Charts API rendered in an img, fallback
    const canvas = qrCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(portalUrl)}`;
    img.onload = () => { ctx.drawImage(img, 0, 0, 200, 200); };
  }

  function printQr() {
    if (!portalUrl) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Portail Patient — QR Code</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px}h2{color:#4f46e5}p{color:#555;font-size:14px}</style></head>
      <body>
        <h2>Portail Patient</h2>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(portalUrl)}" width="250" height="250" />
        <p style="margin-top:16px;font-size:12px;word-break:break-all">${portalUrl}</p>
        <p>Scannez ce code QR pour accéder à votre portail patient.</p>
        <script>window.onload=()=>{window.print();window.close()}<\/script>
      </body></html>`);
    win.document.close();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await update({ ...form, working_days: JSON.stringify(workingDays) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Paramètres</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Configuration de la clinique et préférences d'affichage</p>
      </div>

      {/* Apparence — tous les utilisateurs */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Sun className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Apparence</h2>
        </div>
        <div className="flex gap-3">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                theme === value
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Portail patient — Enterprise, admin seulement */}
      {isAdmin && hasPlan("enterprise") && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Portail patient</h2>
            <span className="ml-auto text-xs font-medium px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">Enterprise</span>
          </div>

          {/* Portal URL */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Partagez ce lien avec vos patients pour qu'ils accèdent à leur portail.
          </p>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
              {portalUrl || "Chargement…"}
            </div>
            <button
              type="button"
              onClick={copyPortalLink}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex-shrink-0"
            >
              {portalLinkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {portalLinkCopied ? "Copié !" : "Copier"}
            </button>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-violet-600 transition-colors"
              title="Ouvrir le portail"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          {/* QR Code */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              <canvas
                ref={qrCanvasRef}
                width={100}
                height={100}
                className="rounded-lg border border-gray-200 dark:border-gray-600"
                onMouseEnter={drawQr}
              />
              <img
                src={portalUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(portalUrl)}` : ""}
                alt="QR code portail"
                width={100}
                height={100}
                className="rounded-lg border border-gray-200 dark:border-gray-600"
              />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">QR code salle d'attente</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Imprimez ce QR code et affichez-le en salle d'attente. Les patients peuvent le scanner pour accéder à leur portail.
              </p>
              <button
                type="button"
                onClick={printQr}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-50 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimer le QR code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent vocal — admin + Enterprise seulement */}
      {isAdmin && hasPlan("enterprise") && <VoiceAgentSection
        baseUrl={form.voice_agent_base_url}
        agentId={form.elevenlabs_agent_id}
        onBaseUrlChange={(v) => setForm((f) => ({ ...f, voice_agent_base_url: v }))}
        onAgentIdChange={(v) => setForm((f) => ({ ...f, elevenlabs_agent_id: v }))}
      />}

      {/* Formulaire clinique — admin seulement */}
      {isAdmin ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Section title="Identité de la clinique" icon={Building2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Nom de la clinique *">
                  <input type="text" value={form.clinic_name} onChange={set("clinic_name")} className={INPUT} required placeholder="Ex: Clinique Santé Plus" />
                </Field>
              </div>
              <Field label="Type de clinique">
                <select value={form.clinic_type} onChange={set("clinic_type")} className={INPUT}>
                  <option value="">— Sélectionner —</option>
                  {CLINIC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Responsable général">
                <input type="text" value={form.responsible_name} onChange={set("responsible_name")} className={INPUT} placeholder="Nom complet" />
              </Field>
              <Field label="Titre du responsable">
                <input type="text" value={form.responsible_title} onChange={set("responsible_title")} className={INPUT} placeholder="Ex: Directeur médical" />
              </Field>
              <Field label="Site web">
                <input type="url" value={form.website} onChange={set("website")} className={INPUT} placeholder="https://..." />
              </Field>
            </div>
          </Section>

          <Section title="Contact" icon={Building2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Téléphone">
                <input type="tel" value={form.phone} onChange={set("phone")} className={INPUT} placeholder="+1 514 555-0000" />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email} onChange={set("email")} className={INPUT} placeholder="contact@clinique.com" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Adresse">
                  <input type="text" value={form.address} onChange={set("address")} className={INPUT} placeholder="123 rue de la Santé" />
                </Field>
              </div>
              <Field label="Ville">
                <input type="text" value={form.city} onChange={set("city")} className={INPUT} />
              </Field>
              <Field label="Code postal">
                <input type="text" value={form.postal_code} onChange={set("postal_code")} className={INPUT} placeholder="A1A 1A1" />
              </Field>
              <Field label="Pays">
                <input type="text" value={form.country} onChange={set("country")} className={INPUT} />
              </Field>
            </div>
          </Section>

          <Section title="Horaires & Configuration" icon={Clock}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Heure d'ouverture">
                <input type="time" value={form.working_hours_start} onChange={set("working_hours_start")} className={INPUT} />
              </Field>
              <Field label="Heure de fermeture">
                <input type="time" value={form.working_hours_end} onChange={set("working_hours_end")} className={INPUT} />
              </Field>
              <Field label="Durée RDV par défaut">
                <select value={form.appointment_duration_mins} onChange={set("appointment_duration_mins")} className={INPUT}>
                  {[15, 20, 30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>{m} min</option>
                  ))}
                </select>
              </Field>
              <Field label="Fuseau horaire">
                <select value={form.timezone} onChange={set("timezone")} className={INPUT}>
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Jours ouvrables</label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleDay(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        workingDays.includes(key)
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-indigo-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pb-6">
            {saved && <span className="text-sm text-green-600 dark:text-green-400 font-medium">Enregistré ✓</span>}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center">
          <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Les paramètres de la clinique sont modifiables par l'administrateur uniquement.
          </p>
        </div>
      )}
    </div>
  );
}
