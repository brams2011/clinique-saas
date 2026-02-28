import { useConversation } from "@elevenlabs/react";
import { Mic, MicOff, PhoneOff, Loader } from "lucide-react";
import { useCallback } from "react";

interface Props {
  agentId: string;
}

export default function VoiceAgentButton({ agentId }: Props) {
  const conversation = useConversation({
    onConnect:    () => console.log("Agent vocal connecté"),
    onDisconnect: () => console.log("Agent vocal déconnecté"),
    onError:      (e) => console.error("Agent vocal erreur:", e),
  });

  const start = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({ agentId, connectionType: "webrtc" });
    } catch (e) {
      console.error("Impossible d'accéder au microphone:", e);
    }
  }, [agentId, conversation]);

  const stop = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const { status, isSpeaking } = conversation;
  const connected   = status === "connected";
  const connecting  = status === "connecting";

  if (!connected && !connecting) {
    return (
      <button
        onClick={start}
        title="Démarrer l'agent vocal"
        className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-all"
      >
        <Mic className="w-4 h-4" />
        Tester l'agent vocal
      </button>
    );
  }

  if (connecting) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-500 text-sm">
        <Loader className="w-4 h-4 animate-spin" />
        Connexion...
      </div>
    );
  }

  // connected
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium ${
        isSpeaking
          ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
          : "border-green-400 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
      }`}>
        {isSpeaking
          ? <><Mic className="w-4 h-4 animate-pulse" /> Agent parle...</>
          : <><MicOff className="w-4 h-4" /> En écoute</>
        }
      </div>
      <button
        onClick={stop}
        title="Terminer"
        className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950 transition-all"
      >
        <PhoneOff className="w-4 h-4" />
        Terminer
      </button>
    </div>
  );
}
