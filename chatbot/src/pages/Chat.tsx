import { useState } from "react";
import { useConversations } from "../hooks/useConversations";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import VoiceAgentButton from "../components/VoiceAgentButton";
import { useClinicSettings } from "../contexts/ClinicSettingsContext";

export default function Chat() {
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const conversationsHook = useConversations();
  const { updateConversationTimestamp } = conversationsHook;
  const { settings } = useClinicSettings();
  const agentId = settings?.elevenlabs_agent_id ?? "";

  function handleDelete(deletedId: string) {
    if (selectedConvId === deletedId) setSelectedConvId(null);
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {agentId && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">Agent vocal :</span>
          <VoiceAgentButton agentId={agentId} />
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          selectedId={selectedConvId}
          onSelect={setSelectedConvId}
          onDelete={handleDelete}
          conversationsHook={conversationsHook}
        />
        <ChatWindow
          conversationId={selectedConvId}
          onConversationUpdated={() => {
            if (selectedConvId) updateConversationTimestamp(selectedConvId);
          }}
        />
      </div>
    </div>
  );
}
