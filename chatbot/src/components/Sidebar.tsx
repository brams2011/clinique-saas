import { useEffect } from "react";
import { type Conversation } from "../lib/api";
import { useConversations } from "../hooks/useConversations";
import { useAuth } from "../contexts/AuthContext";
import { PlusCircle, Trash2, MessageSquare, LogOut } from "lucide-react";

interface SidebarProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  conversationsHook: ReturnType<typeof useConversations>;
}

export default function Sidebar({ selectedId, onSelect, onDelete, conversationsHook }: SidebarProps) {
  const { user, logout } = useAuth();
  const { conversations, loading, fetchConversations, createConversation, deleteConversation } = conversationsHook;

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  async function handleNew() {
    const conv = await createConversation("New conversation");
    if (conv) onSelect(conv.id);
  }

  async function handleDelete(e: React.MouseEvent, conv: Conversation) {
    e.stopPropagation();
    if (!confirm(`Delete "${conv.title}"?`)) return;
    await deleteConversation(conv.id);
    onDelete(conv.id);
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={handleNew}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          New conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading && (
          <p className="text-gray-500 text-xs text-center py-4">Loading…</p>
        )}
        {!loading && conversations.length === 0 && (
          <p className="text-gray-500 text-xs text-center py-4">No conversations yet</p>
        )}
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`group flex items-start gap-2 px-3 py-2.5 rounded-lg cursor-pointer mb-1 transition-colors ${
              selectedId === conv.id
                ? "bg-gray-700 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{conv.title}</p>
              <p className="text-xs text-gray-500">{formatDate(conv.updated_at)}</p>
            </div>
            <button
              onClick={(e) => handleDelete(e, conv)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-400 transition-opacity flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
            {user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <p className="text-xs text-gray-400 truncate flex-1">{user?.email}</p>
          <button
            onClick={logout}
            className="p-1.5 text-gray-500 hover:text-white rounded transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
