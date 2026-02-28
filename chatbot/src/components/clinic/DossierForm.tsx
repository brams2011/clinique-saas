import { useState } from "react";
import { type Dossier, apiCreateDossier } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useStaff } from "../../contexts/StaffContext";
import { X } from "lucide-react";

const TYPES: { value: Dossier["type"]; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "consultation", label: "Consultation" },
  { value: "prescription", label: "Ordonnance" },
  { value: "lab_result", label: "Résultat de labo" },
  { value: "imaging", label: "Imagerie" },
  { value: "referral", label: "Référence" },
  { value: "other", label: "Autre" },
];

interface Props {
  patientId: string;
  appointmentId?: string;
  onCreated: (dossier: Dossier) => void;
  onCancel: () => void;
}

export default function DossierForm({ patientId, appointmentId, onCreated, onCancel }: Props) {
  const { token } = useAuth();
  const { staff } = useStaff();
  const [form, setForm] = useState<{ type: Dossier["type"]; title: string; content: string }>({
    type: "note",
    title: "",
    content: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const dossier = await apiCreateDossier(token, {
        patient_id: patientId,
        practitioner_id: staff?.id ?? null,
        appointment_id: appointmentId ?? null,
        type: form.type,
        title: form.title.trim(),
        content: form.content.trim() || null,
        is_confidential: false,
      });
      onCreated(dossier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">Nouveau dossier</h3>
        <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Dossier["type"] }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Titre *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Consultation initiale"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contenu</label>
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            rows={4}
            placeholder="Notes cliniques, observations..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving || !form.title.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
