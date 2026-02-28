import { useEffect, useRef, useState } from "react";
import { useMessages } from "../hooks/useMessages";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { Trash2, Bot } from "lucide-react";

interface Props {
  conversationId: string | null;
  onConversationUpdated: () => void;
}

export default function ChatWindow({ conversationId, onConversationUpdated }: Props) {
  const { messages, loading, sending, error, fetchMessages, sendMessage, clearMessages } = useMessages(conversationId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    fetchMessages();
    setInputValue("");
  }, [conversationId]); // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text: string, imageKey?: string) {
    await sendMessage(text, imageKey, onConversationUpdated);
  }

  async function handleClear() {
    if (!confirm("Clear all messages in this conversation?")) return;
    await clearMessages();
  }

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-400">
          <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a conversation or create a new one</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-600" />
          <span className="text-sm font-medium text-gray-700">AI Assistant</span>
        </div>
        <button
          onClick={handleClear}
          disabled={messages.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear messages
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="text-center text-gray-400 text-sm py-8">Loading…</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            Send a message to start the conversation
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {sending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-gray-600" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="text-center text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2 mx-auto max-w-sm">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput
        conversationId={conversationId}
        sending={sending}
        onSend={handleSend}
        inputValue={inputValue}
        setInputValue={setInputValue}
      />
    </div>
  );
}
