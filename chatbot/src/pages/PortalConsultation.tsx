import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Video } from "lucide-react";

export default function PortalConsultation() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const appointmentId = params.get("appointment_id") || "";

  if (!appointmentId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <p className="text-gray-500">Aucun rendez-vous sélectionné.</p>
        <button onClick={() => navigate("/portal/dashboard")} className="mt-4 text-indigo-600 hover:underline text-sm">
          Retour au portail
        </button>
      </div>
    );
  }

  const roomUrl = `https://meet.jit.si/cinique-${appointmentId}`;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={() => navigate("/portal/dashboard")}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Retour au portail"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-violet-600" />
          <h1 className="font-semibold text-gray-900">Consultation virtuelle</h1>
        </div>
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
