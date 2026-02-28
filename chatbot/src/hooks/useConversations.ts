import { useState, useCallback } from "react";
import { type Conversation, apiListConversations, apiCreateConversation, apiDeleteConversation } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export function useConversations() {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiListConversations(token);
      setConversations(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const createConversation = useCallback(async (title = "New conversation"): Promise<Conversation | null> => {
    if (!token) return null;
    try {
      const conv = await apiCreateConversation(token, title);
      setConversations((prev) => [conv, ...prev]);
      return conv;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create conversation");
      return null;
    }
  }, [token]);

  const deleteConversation = useCallback(async (id: string) => {
    if (!token) return;
    try {
      await apiDeleteConversation(token, id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete conversation");
    }
  }, [token]);

  const updateConversationTimestamp = useCallback((id: string) => {
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, updated_at: new Date().toISOString() } : c
      );
      return updated.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    });
  }, []);

  return { conversations, loading, error, fetchConversations, createConversation, deleteConversation, updateConversationTimestamp };
}
