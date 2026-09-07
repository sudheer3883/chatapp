import React, { useState, useEffect, useRef } from "react";
import {
  Phone,
  Video,
  Send,
  Paperclip,
  Mic,
  Check,
  CheckCheck,
  FileText,
  Download,
  Loader2,
  Image as ImageIcon,
  Play,
  Pause,
  MessageSquare,
} from "lucide-react";
import Avatar from "../common/Avatar";
import VoiceRecorder from "./VoiceRecorder";
import FullscreenImageViewer from "../profile/FullscreenImageViewer";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { useSocket } from "../../context/SocketContext";
import { getEntityId, getPartner } from "../../utils/chatHelpers";

export const ChatPane = ({ onStartCall }) => {
  const { user } = useAuth();
  const {
    activeConversation,
    messages,
    sendMessage,
    sendTypingStatus,
    typingUsers,
  } = useChat();
  const { onlineUsers } = useSocket();

  const [inputText, setInputText] = useState("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Identify conversation partner reliably
  const partner = getPartner(activeConversation, user);
  const partnerId = getEntityId(partner);
  const livePresence = partnerId ? onlineUsers.get(partnerId) : null;
  const isOnline = livePresence ? livePresence.isOnline : partner?.isOnline;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  // Handle typing debounce
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    sendTypingStatus(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 2000);
  };

  // Handle sending text
  const handleSendText = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    sendTypingStatus(false);
    sendMessage({ text: inputText.trim(), type: "text" });
    setInputText("");
  };

  // Handle file attachment upload
  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/chats/upload-media", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      if (data.success && data.data?.media) {
        const type = file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("audio/")
            ? "audio"
            : "document";

        await sendMessage({
          type,
          media: data.data.media,
          text: file.type.startsWith("image/") ? "" : file.name,
        });
      }
    } catch (err) {
      console.error("[ChatPane] Media upload error:", err);
    } finally {
      setIsUploadingMedia(false);
      e.target.value = "";
    }
  };

  // Handle voice note send
  const handleSendVoiceNote = async (audioBlobFile, duration) => {
    setIsUploadingMedia(true);
    setIsRecordingVoice(false);

    try {
      const formData = new FormData();
      formData.append("file", audioBlobFile);

      const res = await fetch("/api/chats/upload-media", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      if (data.success && data.data?.media) {
        await sendMessage({
          type: "audio",
          media: { ...data.data.media, duration },
          text: "Voice message",
        });
      }
    } catch (err) {
      console.error("[ChatPane] Voice note upload error:", err);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  if (!activeConversation || !partner) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-500 select-none p-6 text-center">
        <div className="space-y-6 max-w-sm">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600/20 to-violet-600/20 border border-indigo-500/30 flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-indigo-400" />
            </div>
          </div>

          {/* Text */}
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Welcome to ChatApp!
            </h3>
            <p className="text-sm text-zinc-400">
              Select a conversation from the left sidebar to start chatting, or
              create a new one by clicking the{" "}
              <span className="text-indigo-400 font-semibold">"+"</span> button
              above.
            </p>
          </div>

          {/* Features list */}
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
              <MessageSquare className="w-5 h-5 text-indigo-400 flex-shrink-0" />
              <span className="text-sm text-zinc-300">Real-time messaging</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
              <Phone className="w-5 h-5 text-indigo-400 flex-shrink-0" />
              <span className="text-sm text-zinc-300">Audio & video calls</span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
              <ImageIcon className="w-5 h-5 text-indigo-400 flex-shrink-0" />
              <span className="text-sm text-zinc-300">
                Share photos & media
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isPartnerTyping = typingUsers[activeConversation._id];

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-zinc-900/90 border-b border-zinc-800 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <Avatar
            src={partner.profilePic?.url}
            name={partner.displayName || partner.username}
            size="md"
            isOnline={isOnline}
            showStatus={true}
            onClick={() =>
              partner.profilePic?.url && setPreviewImage(partner.profilePic.url)
            }
          />
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {partner.displayName}
            </h2>
            <p className="text-xs text-zinc-400">
              {isPartnerTyping ? (
                <span className="text-indigo-400 font-medium animate-pulse">
                  typing...
                </span>
              ) : isOnline ? (
                <span className="text-emerald-400">Online</span>
              ) : (
                "Offline"
              )}
            </p>
          </div>
        </div>

        {/* Action icons: Audio Call & Video Call */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStartCall(partner, "audio")}
            className="p-2 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-xl transition-colors"
            title="Start Audio Call"
          >
            <Phone className="w-5 h-5" />
          </button>
          <button
            onClick={() => onStartCall(partner, "video")}
            className="p-2 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-xl transition-colors"
            title="Start Video Call"
          >
            <Video className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.map((msg) => {
          const isMe = getEntityId(msg.sender) === getEntityId(user);

          return (
            <div
              key={msg._id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <div
                className={`relative max-w-sm md:max-w-md px-4 py-2.5 rounded-2xl shadow-sm text-sm break-words ${
                  isMe
                    ? "bg-indigo-600 text-white rounded-br-xs"
                    : "bg-zinc-800 text-zinc-100 rounded-bl-xs"
                }`}
              >
                {/* 1. Image Media */}
                {msg.type === "image" && msg.media?.url && (
                  <div className="mb-1.5 rounded-xl overflow-hidden cursor-pointer">
                    <img
                      src={msg.media.url}
                      alt="Attachment"
                      onClick={() => setPreviewImage(msg.media.url)}
                      className="max-h-64 w-full object-cover rounded-xl hover:opacity-95 transition-opacity"
                    />
                  </div>
                )}

                {/* 2. Voice Note Media */}
                {msg.type === "audio" && msg.media?.url && (
                  <div className="flex items-center gap-3 py-1 min-w-[200px]">
                    <audio
                      src={msg.media.url}
                      controls
                      className="w-full h-8 accent-indigo-400 text-xs"
                    />
                  </div>
                )}

                {/* 3. Document Media */}
                {msg.type === "document" && msg.media?.url && (
                  <a
                    href={msg.media.url}
                    download={msg.media.fileName || "file"}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 p-2 bg-black/20 rounded-xl mb-1 hover:bg-black/30 transition-colors"
                  >
                    <FileText className="w-6 h-6 flex-shrink-0 text-indigo-300" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">
                        {msg.media.fileName}
                      </p>
                      <span className="text-[10px] opacity-75">
                        {(msg.media.fileSize / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <Download className="w-4 h-4 flex-shrink-0 opacity-75" />
                  </a>
                )}

                {/* Text Message */}
                {msg.text && (
                  <p className="leading-relaxed text-[13.5px]">{msg.text}</p>
                )}

                {/* Timestamp & Delivery/Read Status Receipts */}
                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none ${
                    isMe ? "text-indigo-200" : "text-zinc-400"
                  }`}
                >
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isMe && (
                    <span>
                      {msg.status === "read" ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                      ) : msg.status === "delivered" ? (
                        <CheckCheck className="w-3.5 h-3.5 text-indigo-200" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-indigo-200" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator bubble */}
        {isPartnerTyping && (
          <div className="flex items-center gap-1.5 p-3 bg-zinc-850 bg-zinc-800 rounded-2xl rounded-bl-xs w-20">
            <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.4s]" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Uploading Banner */}
      {isUploadingMedia && (
        <div className="px-6 py-2 bg-zinc-900 border-t border-zinc-800 flex items-center gap-2 text-xs text-indigo-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Sending media attachment...</span>
        </div>
      )}

      {/* Input Composer / Voice Recorder */}
      <div className="p-4 bg-zinc-900/90 border-t border-zinc-800">
        {isRecordingVoice ? (
          <VoiceRecorder
            onSendAudio={handleSendVoiceNote}
            onCancel={() => setIsRecordingVoice(false)}
          />
        ) : (
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
              title="Attach media or document"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelected}
              className="hidden"
            />

            {/* Voice Recorder Trigger */}
            <button
              type="button"
              onClick={() => setIsRecordingVoice(true)}
              className="p-2.5 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-xl transition-colors"
              title="Record Voice Note"
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Message Input Box */}
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2.5 text-sm bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl focus:outline-none focus:border-indigo-500 transition-all placeholder-zinc-500"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl disabled:opacity-40 disabled:hover:bg-indigo-600 transition-all shadow-md shadow-indigo-600/20"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}
      </div>

      {/* Fullscreen High-Res Image Preview */}
      <FullscreenImageViewer
        imageUrl={previewImage}
        title="Image Preview"
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};

export default ChatPane;
