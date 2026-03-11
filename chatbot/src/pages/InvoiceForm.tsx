import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, ChevronLeft, Save, Lock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  type Invoice,
  type InvoiceLigne,
  apiGetInvoice,
  apiCreateInvoice,
  apiUpdateInvoice,
  apiGetNextInvoiceNumber,
} from "../lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-sm font-bold text-indigo-700 border-b border-indigo-100 pb-2 mb-4">
      {title}
    </h2>
  );
}

// ─── Calcul totaux ─────────────────────────────────────────────────────────────

function calcTotaux(
  lignes: InvoiceLigne[],
  remises: number,
  ramq: number,
  assurance: number,
  acompte: number
) {
  const sous_total = lignes.reduce((s, l) => s + (l.montant || 0), 0);
  const base = Math.max(0, sous_total - remises - ramq - assurance);
  const tps  = Math.round(base * 0.05    * 100) / 100;
  const tvq  = Math.round(base * 0.09975 * 100) / 100;
  const total = Math.max(0, base + tps + tvq - acompte);
  return { sous_total, tps, tvq, total };
}

const EMPTY_LIGNE: InvoiceLigne = { code: "", description: "", quantite: 1, prix_unitaire: 0, montant: 0 };

// ─── Component ────────────────────────────────────────────────────────────────

export default function InvoiceForm() {
  const { token, hasPlan } = useAuth();
  const navigate  = useNavigate();
  const { id }    = useParams<{ id: string }>();
  const isEdit    = Boolean(id);

  if (!hasPlan("pro")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-indigo-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Fonctionnalité Pro &amp; Enterprise</h2>
        <p className="text-gray-500 text-sm max-w-sm mb-6">
          Le module Facturation est disponible à partir du forfait <strong>Pro</strong>. Passez à la version supérieure pour créer et gérer vos factures médicales.
        </p>
        <button
          onClick={() => navigate("/subscription")}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          Voir les forfaits
        </button>
      </div>
    );
  }

  const [loading, setSaving_]  = useState(false);
  const [saving,  setSaving]   = useState(false);
  const [error,   setError]    = useState<string | null>(null);

  // ── Champs ──
  const [numero,          setNumero]          = useState("");
  const [statut,          setStatut]          = useState<Invoice["statut"]>("en_attente");
  const [patientNom,      setPatientNom]      = useState("");
  const [patientRamq,     setPatientRamq]     = useState("");
  const [patientDossier,  setPatientDossier]  = useState("");
  const [patientTel,      setPatientTel]      = useState("");
  const [patientEmail,    setPatientEmail]    = useState("");
  const [patientAdresse,  setPatientAdresse]  = useState("");
  const [medecinNom,      setMedecinNom]      = useState("");
  const [medecinLicence,  setMedecinLicence]  = useState("");
  const [medecinSpec,     setMedecinSpec]     = useState("");
  const [dateVisite,      setDateVisite]      = useState("");
  const [dateEcheance,    setDateEcheance]    = useState("");
  const [diagnostic,      setDiagnostic]      = useState("");
  const [assureur,        setAssureur]        = useState("");
  const [noPolice,        setNoPolice]        = useState("");
  const [noReclamation,   setNoReclamation]   = useState("");
  const [notes,           setNotes]           = useState("");
  const [lignes,          setLignes]          = useState<InvoiceLigne[]>([{ ...EMPTY_LIGNE }]);
  const [remises,         setRemises]         = useState(0);
  const [ramqCouverture,  setRamq]            = useState(0);
  const [assuranceCov,    setAssurance]       = useState(0);
  const [acompte,         setAcompte]         = useState(0);

  // ── Chargement ──
  useEffect(() => {
    if (!token) return;
    if (isEdit && id) {
      setSaving_(true);
      apiGetInvoice(token, id)
        .then((inv) => {
          setNumero(inv.numero);
          setStatut(inv.statut);
          setPatientNom(inv.patient_nom || "");
          setPatientRamq(inv.patient_ramq || "");
          setPatientDossier(inv.patient_dossier || "");
          setPatientTel(inv.patient_telephone || "");
          setPatientEmail(inv.patient_email || "");
          setPatientAdresse(inv.patient_adresse || "");
          setMedecinNom(inv.medecin_nom || "");
          setMedecinLicence(inv.medecin_licence || "");
          setMedecinSpec(inv.medecin_specialite || "");
          setDateVisite(inv.date_visite || "");
          setDateEcheance(inv.date_echeance || "");
          setDiagnostic(inv.diagnostic_cim10 || "");
          setAssureur(inv.assureur || "");
          setNoPolice(inv.no_police || "");
          setNoReclamation(inv.no_reclamation || "");
          setNotes(inv.notes || "");
          setLignes(inv.lignes?.length ? inv.lignes : [{ ...EMPTY_LIGNE }]);
          setRemises(Number(inv.remises) || 0);
          setRamq(Number(inv.ramq_couverture) || 0);
          setAssurance(Number(inv.assurance_couverture) || 0);
          setAcompte(Number(inv.acompte) || 0);
        })
        .catch(() => setError("Facture introuvable"))
        .finally(() => setSaving_(false));
    } else {
      apiGetNextInvoiceNumber(token)
        .then(setNumero)
        .catch(() => setNumero(`INV-${new Date().getFullYear()}-0001`));
    }
  }, [token, id, isEdit]);

  // ── Lignes ──
  const updateLigne = useCallback((idx: number, field: keyof InvoiceLigne, value: string | number) => {
    setLignes((prev) => {
      const next = prev.map((l, i) => {
        if (i !== idx) return l;
        const updated = { ...l, [field]: value };
        if (field === "quantite" || field === "prix_unitaire") {
          updated.montant = Math.round(Number(updated.quantite) * Number(updated.prix_unitaire) * 100) / 100;
        }
        return updated;
      });
      return next;
    });
  }, []);

  const addLigne    = () => setLignes((p) => [...p, { ...EMPTY_LIGNE }]);
  const removeLigne = (idx: number) => setLignes((p) => p.filter((_, i) => i !== idx));

  // ── Totaux calculés ──
  const { sous_total, tps, tvq, total } = calcTotaux(lignes, remises, ramqCouverture, assuranceCov, acompte);
  const fmt = (n: number) => `${n.toFixed(2)} $`;

  // ── Soumission ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!patientNom.trim()) { setError("Le nom du patient est requis."); return; }
    setError(null);
    setSaving(true);
    const data: Partial<Invoice> = {
      numero, statut,
      patient_nom: patientNom || null,
      patient_ramq: patientRamq || null,
      patient_dossier: patientDossier || null,
      patient_telephone: patientTel || null,
      patient_email: patientEmail || null,
      patient_adresse: patientAdresse || null,
      medecin_nom: medecinNom || null,
      medecin_licence: medecinLicence || null,
      medecin_specialite: medecinSpec || null,
      date_visite: dateVisite || null,
      date_echeance: dateEcheance || null,
      diagnostic_cim10: diagnostic || null,
      assureur: assureur || null,
      no_police: noPolice || null,
      no_reclamation: noReclamation || null,
      notes: notes || null,
      lignes,
      sous_total,
      remises,
      ramq_couverture: ramqCouverture,
      assurance_couverture: assuranceCov,
      tps,
      tvq,
      acompte,
      total,
    };
    try {
      if (isEdit && id) {
        await apiUpdateInvoice(token, id, data);
      } else {
        await apiCreateInvoice(token, data);
      }
      navigate("/invoices");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-center text-gray-400 text-sm">Chargement…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate("/invoices")} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? `Modifier ${numero}` : "Nouvelle facture"}
          </h1>
          {!isEdit && <p className="text-xs text-gray-400 mt-0.5">N° attribué : {numero}</p>}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* ── Section 1 — Patient ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle title="1. Informations patient" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nom complet" required>
              <input className={INPUT} value={patientNom} onChange={(e) => setPatientNom(e.target.value)} placeholder="Nom Prénom" />
            </Field>
            <Field label="N° RAMQ">
              <input className={INPUT} value={patientRamq} onChange={(e) => setPatientRamq(e.target.value)} placeholder="ABCD 0000 0000" />
            </Field>
            <Field label="N° dossier">
              <input className={INPUT} value={patientDossier} onChange={(e) => setPatientDossier(e.target.value)} />
            </Field>
            <Field label="Téléphone">
              <input className={INPUT} value={patientTel} onChange={(e) => setPatientTel(e.target.value)} />
            </Field>
            <Field label="Courriel">
              <input className={INPUT} type="email" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} />
            </Field>
            <Field label="Adresse">
              <input className={INPUT} value={patientAdresse} onChange={(e) => setPatientAdresse(e.target.value)} />
            </Field>
          </div>
        </div>

        {/* ── Section 2 — Médecin & assurance ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle title="2. Médecin & assurance" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nom du médecin">
              <input className={INPUT} value={medecinNom} onChange={(e) => setMedecinNom(e.target.value)} />
            </Field>
            <Field label="N° licence">
              <input className={INPUT} value={medecinLicence} onChange={(e) => setMedecinLicence(e.target.value)} />
            </Field>
            <Field label="Spécialité">
              <input className={INPUT} value={medecinSpec} onChange={(e) => setMedecinSpec(e.target.value)} />
            </Field>
            <Field label="Assureur">
              <input className={INPUT} value={assureur} onChange={(e) => setAssureur(e.target.value)} />
            </Field>
            <Field label="N° police">
              <input className={INPUT} value={noPolice} onChange={(e) => setNoPolice(e.target.value)} />
            </Field>
            <Field label="N° réclamation">
              <input className={INPUT} value={noReclamation} onChange={(e) => setNoReclamation(e.target.value)} />
            </Field>
          </div>
        </div>

        {/* ── Section 3 — Dates & diagnostic ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle title="3. Dates & diagnostic" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Date de visite">
              <input className={INPUT} type="date" value={dateVisite} onChange={(e) => setDateVisite(e.target.value)} />
            </Field>
            <Field label="Date d'échéance">
              <input className={INPUT} type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} />
            </Field>
            <Field label="Code diagnostic CIM-10">
              <input className={INPUT} value={diagnostic} onChange={(e) => setDiagnostic(e.target.value)} placeholder="ex: J00, M54.5" />
            </Field>
            {isEdit && (
              <Field label="Statut">
                <select className={INPUT} value={statut} onChange={(e) => setStatut(e.target.value as Invoice["statut"])}>
                  <option value="en_attente">En attente</option>
                  <option value="payee">Payée</option>
                  <option value="annulee">Annulée</option>
                </select>
              </Field>
            )}
          </div>
        </div>

        {/* ── Section 4 — Actes médicaux ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle title="4. Actes médicaux" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm mb-3">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Code", "Description", "Qté", "Prix unitaire", "Montant", ""].map((h) => (
                    <th key={h} className="pb-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, idx) => (
                  <tr key={idx} className="border-b border-gray-50">
                    <td className="py-2 pr-2 w-24">
                      <input className={INPUT} value={l.code} onChange={(e) => updateLigne(idx, "code", e.target.value)} placeholder="Code" />
                    </td>
                    <td className="py-2 pr-2">
                      <input className={INPUT} value={l.description} onChange={(e) => updateLigne(idx, "description", e.target.value)} placeholder="Description de l'acte" />
                    </td>
                    <td className="py-2 pr-2 w-20">
                      <input className={INPUT} type="number" min="1" step="1" value={l.quantite} onChange={(e) => updateLigne(idx, "quantite", parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="py-2 pr-2 w-32">
                      <input className={INPUT} type="number" min="0" step="0.01" value={l.prix_unitaire} onChange={(e) => updateLigne(idx, "prix_unitaire", parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="py-2 pr-2 w-28 font-mono text-gray-700">
                      {l.montant.toFixed(2)} $
                    </td>
                    <td className="py-2 w-8">
                      {lignes.length > 1 && (
                        <button type="button" onClick={() => removeLigne(idx)} className="p-1 text-gray-300 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={addLigne} className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            <Plus className="w-4 h-4" />
            Ajouter un acte
          </button>
        </div>

        {/* ── Section 5 — Totaux ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle title="5. Calcul des totaux" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Déductions */}
            <div className="space-y-3">
              <Field label="Remises ($)">
                <input className={INPUT} type="number" min="0" step="0.01" value={remises} onChange={(e) => setRemises(parseFloat(e.target.value) || 0)} />
              </Field>
              <Field label="Couverture RAMQ ($)">
                <input className={INPUT} type="number" min="0" step="0.01" value={ramqCouverture} onChange={(e) => setRamq(parseFloat(e.target.value) || 0)} />
              </Field>
              <Field label="Couverture assurance ($)">
                <input className={INPUT} type="number" min="0" step="0.01" value={assuranceCov} onChange={(e) => setAssurance(parseFloat(e.target.value) || 0)} />
              </Field>
              <Field label="Acompte ($)">
                <input className={INPUT} type="number" min="0" step="0.01" value={acompte} onChange={(e) => setAcompte(parseFloat(e.target.value) || 0)} />
              </Field>
            </div>

            {/* Résumé */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              {[
                ["Sous-total",          fmt(sous_total)],
                ["Remises",             `- ${fmt(remises)}`],
                ["Couverture RAMQ",     `- ${fmt(ramqCouverture)}`],
                ["Couverture assurance",`- ${fmt(assuranceCov)}`],
                ["TPS (5%)",            fmt(tps)],
                ["TVQ (9.975%)",        fmt(tvq)],
                ["Acompte",             `- ${fmt(acompte)}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-gray-600">
                  <span>{label}</span>
                  <span className="font-mono">{value}</span>
                </div>
              ))}
              <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-gray-900 text-base">
                <span>TOTAL DÛ</span>
                <span className="font-mono text-indigo-700">{fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 6 — Notes ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <SectionTitle title="6. Notes" />
          <textarea
            className={INPUT}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informations complémentaires, instructions de paiement…"
          />
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3 pb-6">
          <button
            type="button"
            onClick={() => navigate("/invoices")}
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Sauvegarde…" : isEdit ? "Enregistrer" : "Créer la facture"}
          </button>
        </div>
      </form>
    </div>
  );
}
