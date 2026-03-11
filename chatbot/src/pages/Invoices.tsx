import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileDown, Pencil, Trash2, Receipt, Lock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import {
  type Invoice,
  apiListInvoices,
  apiDeleteInvoice,
  apiDownloadInvoiceDocx,
} from "../lib/api";

const STATUT_LABELS: Record<string, { label: string; classes: string }> = {
  en_attente: { label: "En attente", classes: "bg-orange-100 text-orange-700" },
  payee:      { label: "Payée",      classes: "bg-green-100  text-green-700"  },
  annulee:    { label: "Annulée",    classes: "bg-red-100    text-red-700"    },
};

export default function Invoices() {
  const { token, hasPlan } = useAuth();
  const navigate = useNavigate();

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
  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatut, setFilter]   = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    apiListInvoices(token, filterStatut ? { statut: filterStatut } : undefined)
      .then(setInvoices)
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, [token, filterStatut]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(inv: Invoice) {
    if (!token || !confirm(`Supprimer la facture ${inv.numero} ?`)) return;
    await apiDeleteInvoice(token, inv.id).catch(() => {});
    setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
  }

  async function handleDownload(inv: Invoice) {
    if (!token) return;
    setDownloading(inv.id);
    try {
      await apiDownloadInvoiceDocx(token, inv.id, inv.numero);
    } catch (e) {
      alert("Erreur génération DOCX : " + (e instanceof Error ? e.message : "inconnue"));
    } finally {
      setDownloading(null);
    }
  }

  const fmt = (n: number | string) =>
    `${parseFloat(String(n ?? 0)).toFixed(2)} $`;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Receipt className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Facturation</h1>
            <p className="text-sm text-gray-500">{invoices.length} facture(s)</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/invoices/new")}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nouvelle facture
        </button>
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          value={filterStatut}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="payee">Payée</option>
          <option value="annulee">Annulée</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Chargement…</div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Aucune facture trouvée.</p>
          <button
            onClick={() => navigate("/invoices/new")}
            className="mt-4 text-indigo-600 hover:underline text-sm font-medium"
          >
            Créer la première facture
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["N° Facture", "Patient", "Médecin", "Date visite", "Total", "Statut", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => {
                const st = STATUT_LABELS[inv.statut] ?? { label: inv.statut, classes: "bg-gray-100 text-gray-600" };
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-indigo-700">{inv.numero}</td>
                    <td className="px-4 py-3 text-gray-800">{inv.patient_nom || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{inv.medecin_nom || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                      {inv.date_visite ? new Date(inv.date_visite).toLocaleDateString("fr-CA") : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{fmt(inv.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${st.classes}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(inv)}
                          disabled={downloading === inv.id}
                          title="Télécharger DOCX"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-40 transition-colors"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/invoices/${inv.id}/edit`)}
                          title="Modifier"
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(inv)}
                          title="Supprimer"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
