import { useRef, type KeyboardEvent, type ChangeEvent, useCallback } from "react";
import { useImageUpload } from "../hooks/useImageUpload";
import { Send, Paperclip, X, Loader2 } from "lucide-react";

interface Props {
  conversationId: string | null;
  sending: boolean;
  onSend: (text: string, imageKey?: string) => Promise<void>;
  inputValue: string;
  setInputValue: (v: string) => void;
}

export default function ChatInput({ conversationId, sending, onSend, inputValue, setInputValue }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { preview, pendingFile, uploading, error: uploadError, selectFile, clearFile, uploadPending } = useImageUpload(conversationId);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
    e.target.value = "";
  }, [selectFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (file) { e.preventDefault(); selectFile(file); }
  }, [selectFile]);

  async function handleSend() {
    if (sending || uploading) return;
    const text = inputValue.trim();
    if (!text && !pendingFile) return;
    let imageKey: string | undefined;
    if (pendingFile) {
      imageKey = await uploadPending();
      if (pendingFile && !imageKey) return; // upload failed, don't send
    }
    const msgText = text || (imageKey ? "[image]" : "");
    if (!msgText) return;
    setInputValue("");
    await onSend(msgText, imageKey);
  }

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [inputValue, pendingFile, sending, uploading]); // eslint-disable-line

  const disabled = sending || uploading || !conversationId;

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      {(preview || uploadError) && (
        <div className="mb-3 flex items-start gap-2">
          {preview && (
            <div className="relative">
              <img src={preview} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
              <button
                onClick={clearFile}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center hover:bg-gray-900"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-40 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          title="Attach image"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          placeholder={conversationId ? "Type a message… (Enter to send, Shift+Enter for newline)" : "Select or create a conversation"}
          rows={1}
          className="flex-1 resize-none px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed overflow-hidden"
          style={{ minHeight: "40px", maxHeight: "160px" }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 160) + "px";
          }}
        />

        <button
          onClick={handleSend}
          disabled={disabled || (!inputValue.trim() && !pendingFile)}
          className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {sending || uploading
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <Send className="w-5 h-5" />
          }
        </button>
      </div>
    </div>
  );
}
