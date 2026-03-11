import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Video } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function VirtualConsultation() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { hasPlan } = useAuth();
  const appointmentId = params.get("appointment_id") || "";

  if (!hasPlan("enterprise")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mb-4">
          <Video className="w-8 h-8 text-violet-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Fonctionnalité Enterprise</h2>
        <p className="text-gray-500 text-sm max-w-sm mb-6">
          La consultation virtuelle est disponible uniquement avec le forfait <strong>Enterprise</strong>.
        </p>
        <button
          onClick={() => navigate("/subscription")}
          className="px-5 py-2.5 bg-violet-600 text-white font-semibold text-sm rounded-xl hover:bg-violet-700 transition-colors"
        >
          Voir les forfaits
        </button>
      </div>
    );
  }

  if (!appointmentId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <p className="text-gray-500">Aucun rendez-vous sélectionné.</p>
        <button onClick={() => navigate("/appointments")} className="mt-4 text-indigo-600 hover:underline text-sm">
          Retour aux rendez-vous
        </button>
      </div>
    );
  }

  const roomUrl = `https://meet.jit.si/cinique-${appointmentId}`;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Retour"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-violet-600" />
          <h1 className="font-semibold text-gray-900">Consultation virtuelle</h1>
        </div>
        <span className="ml-auto text-xs text-gray-400 font-mono hidden sm:block">{roomUrl}</span>
      </div>
      <iframe
        src={roomUrl}
        allow="camera; microphone; fullscreen; display-capture"
        className="flex-1 w-full border-0"
        title="Consultation virtuelle Jitsi Meet"
      />
    </div>
  );
}
