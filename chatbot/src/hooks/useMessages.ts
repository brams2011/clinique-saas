import { useState, useCallback } from "react";
import { type Message, apiListMessages, apiChatSend, apiClearMessages } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export function useMessages(conversationId: string | null) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (!token || !conversationId) { setMessages([]); return; }
    setLoading(true);
    setError(null);
    try {
      const list = await apiListMessages(token, conversationId);
      setMessages(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [token, conversationId]);

  const sendMessage = useCallback(async (
    text: string,
    imageKey?: string,
    onConversationUpdated?: () => void
  ) => {
    if (!token || !conversationId || !text.trim()) return null;
    setSending(true);
    setError(null);
    try {
      const result = await apiChatSend(token, conversationId, text.trim(), imageKey);
      setMessages((prev) => [...prev, result.user_message, result.assistant_message]);
      onConversationUpdated?.();
      return result;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send message");
      return null;
    } finally {
      setSending(false);
    }
  }, [token, conversationId]);

  const clearMessages = useCallback(async () => {
    if (!token || !conversationId) return;
    try {
      await apiClearMessages(token, conversationId);
      setMessages([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to clear messages");
    }
  }, [token, conversationId]);

  return { messages, loading, sending, error, fetchMessages, sendMessage, clearMessages };
}
