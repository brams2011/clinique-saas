import { useEffect, useState } from "react";
import { type Message, fetchImageAsBlob } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Bot, User } from "lucide-react";

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const { token } = useAuth();
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const isUser = message.role === "user";

  useEffect(() => {
    if (!message.image_key || !token) return;
    let objUrl: string | null = null;
    fetchImageAsBlob(token, message.image_key)
      .then((url) => { objUrl = url; setImgSrc(url); })
      .catch(() => {});
    return () => { if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [message.image_key, token]);

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? "bg-indigo-600" : "bg-gray-200"
      }`}>
        {isUser
          ? <User className="w-4 h-4 text-white" />
          : <Bot className="w-4 h-4 text-gray-600" />
        }
      </div>

      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {imgSrc && (
          <div className={`rounded-2xl overflow-hidden ${isUser ? "rounded-tr-sm" : "rounded-tl-sm"}`}>
            <img
              src={imgSrc}
              alt="Uploaded"
              className="max-w-xs max-h-64 object-contain bg-gray-100"
            />
          </div>
        )}
        {message.content && (
          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
          }`}>
            {message.content}
          </div>
        )}
        <span className="text-xs text-gray-400 px-1">{formatTime(message.created_at)}</span>
      </div>
    </div>
  );
}
