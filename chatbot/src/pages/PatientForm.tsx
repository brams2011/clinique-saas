import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Save } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiCreatePatient, apiGetPatient, apiUpdatePatient, decodeJwtSub, type Patient } from "../lib/api";

type FormData = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  city: string;
  postal_code: string;
  health_card_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  notes: string;
};

const EMPTY: FormData = {
  first_name: "", last_name: "", email: "", phone: "",
  date_of_birth: "", gender: "", address: "", city: "",
  postal_code: "", health_card_number: "",
  emergency_contact_name: "", emergency_contact_phone: "", notes: "",
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function PatientForm() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !token || !id) return;
    apiGetPatient(token, id).then((p) => {
      setForm({
        first_name: p.first_name ?? "",
        last_name: p.last_name ?? "",
        email: p.email ?? "",
        phone: p.phone ?? "",
        date_of_birth: p.date_of_birth ?? "",
        gender: p.gender ?? "",
        address: p.address ?? "",
        city: p.city ?? "",
        postal_code: p.postal_code ?? "",
        health_card_number: p.health_card_number ?? "",
        emergency_contact_name: p.emergency_contact_name ?? "",
        emergency_contact_phone: p.emergency_contact_phone ?? "",
        notes: p.notes ?? "",
      });
      setLoading(false);
    }).catch(() => { setError("Patient introuvable"); setLoading(false); });
  }, [isEdit, token, id]);

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);

    const data: Partial<Patient> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      gender: (form.gender as Patient["gender"]) || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      postal_code: form.postal_code.trim() || null,
      health_card_number: form.health_card_number.trim() || null,
      emergency_contact_name: form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
      notes: form.notes.trim() || null,
    };

    try {
      if (isEdit && id) {
        await apiUpdatePatient(token, id, data);
        navigate(`/patients/${id}`);
      } else {
        const sub = decodeJwtSub(token);
        const created = await apiCreatePatient(token, { ...data, created_by: sub ?? undefined });
        navigate(`/patients/${created.id}`);
      }
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{isEdit ? "Modifier le patient" : "Nouveau patient"}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Informations personnelles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Prénom" required>
              <input type="text" value={form.first_name} onChange={set("first_name")} className={INPUT} required />
            </Field>
            <Field label="Nom" required>
              <input type="text" value={form.last_name} onChange={set("last_name")} className={INPUT} required />
            </Field>
            <Field label="Date de naissance">
              <input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} className={INPUT} />
            </Field>
            <Field label="Genre">
              <select value={form.gender} onChange={set("gender")} className={INPUT}>
                <option value="">— Sélectionner —</option>
                <option value="male">Homme</option>
                <option value="female">Femme</option>
                <option value="other">Autre</option>
              </select>
            </Field>
            <Field label="Numéro carte santé">
              <input type="text" value={form.health_card_number} onChange={set("health_card_number")} className={INPUT} placeholder="XXXX XXXX XXXX" />
            </Field>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email">
              <input type="email" value={form.email} onChange={set("email")} className={INPUT} />
            </Field>
            <Field label="Téléphone">
              <input type="tel" value={form.phone} onChange={set("phone")} className={INPUT} placeholder="+1 514 555-0000" />
            </Field>
            <Field label="Adresse">
              <input type="text" value={form.address} onChange={set("address")} className={INPUT} />
            </Field>
            <Field label="Ville">
              <input type="text" value={form.city} onChange={set("city")} className={INPUT} />
            </Field>
            <Field label="Code postal">
              <input type="text" value={form.postal_code} onChange={set("postal_code")} className={INPUT} placeholder="A1A 1A1" />
            </Field>
          </div>
        </div>

        {/* Emergency contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Contact d'urgence</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nom">
              <input type="text" value={form.emergency_contact_name} onChange={set("emergency_contact_name")} className={INPUT} />
            </Field>
            <Field label="Téléphone">
              <input type="tel" value={form.emergency_contact_phone} onChange={set("emergency_contact_phone")} className={INPUT} />
            </Field>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Notes générales</h2>
          <textarea
            value={form.notes}
            onChange={set("notes")}
            rows={3}
            placeholder="Allergies, antécédents, remarques..."
            className={`${INPUT} resize-none`}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex gap-3 justify-end pb-6">
          <button type="button" onClick={() => navigate(-1)} className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50">
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Enregistrement..." : isEdit ? "Enregistrer" : "Créer le patient"}
          </button>
        </div>
      </form>
    </div>
  );
}
