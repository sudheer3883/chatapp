import React, { useState } from "react";
import {
  Search,
  Plus,
  Settings,
  LogOut,
  MessageSquare,
  Camera,
} from "lucide-react";
import Avatar from "../common/Avatar";
import { useAuth } from "../../context/AuthContext";
import { useChat } from "../../context/ChatContext";
import { useSocket } from "../../context/SocketContext";
import { getEntityId, getPartner } from "../../utils/chatHelpers";

export const Sidebar = ({ onOpenProfile, onOpenNewChat }) => {
  const { user, logout } = useAuth();
  const { conversations, activeConversation, setActiveConversation } =
    useChat();
  const { onlineUsers } = useSocket();
  const [searchQuery, setSearchQuery] = useState("");

  // Format relative timestamp
  const formatTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  // Helper to format last message snippet
  const getLastMessageText = (msg) => {
    if (!msg) return "Start a conversation";
    if (msg.type === "image") return "📷 Photo";
    if (msg.type === "audio") return "🎤 Voice message";
    if (msg.type === "document") return "📄 Document";
    return msg.text || "Media attachment";
  };

  // Filter conversations by contact name
  const filteredConversations = conversations.filter((conv) => {
    const partner = getPartner(conv, user);
    if (!partner) return false;
    const q = searchQuery.toLowerCase();
    return (
      partner.displayName?.toLowerCase().includes(q) ||
      partner.username?.toLowerCase().includes(q)
    );
  });

  return (
    <aside className="w-80 md:w-96 flex flex-col h-full bg-zinc-900 border-r border-zinc-800 select-none flex-shrink-0">
      {/* Top Profile Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md">
        <div
          onClick={onOpenProfile}
          className="flex items-center gap-3 cursor-pointer group p-1.5 -ml-1 rounded-2xl hover:bg-zinc-800/60 transition-all flex-1 min-w-0"
          title="Change DP / Edit Profile"
        >
          <div className="relative">
            <Avatar
              src={user?.profilePic?.url}
              name={user?.displayName || user?.username}
              size="md"
              isOnline={true}
              showStatus={true}
              className="ring-2 ring-indigo-500/50 group-hover:ring-indigo-400 transition-all"
            />
            <div className="absolute -bottom-1 -right-1 p-1 bg-indigo-600 rounded-full text-white ring-2 ring-zinc-900 shadow-sm group-hover:scale-110 transition-transform">
              <Camera className="w-2.5 h-2.5" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors truncate">
              {user?.displayName}
            </h2>
            <p className="text-[11px] text-indigo-400 font-medium truncate flex items-center gap-1">
              <span>Change DP & Bio</span>
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenNewChat}
            className="p-2.5 text-white bg-gradient-to-tr from-indigo-600 to-violet-500 hover:from-indigo-500 hover:to-violet-400 rounded-xl transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-105 font-semibold"
            title="Start New Chat"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all"
            title="DP & Profile Settings"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>DP</span>
          </button>
          <button
            onClick={logout}
            className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded-xl transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-zinc-800/80">
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-zinc-950 text-zinc-200 border border-zinc-800/90 rounded-xl focus:outline-none focus:border-indigo-500 transition-all placeholder-zinc-600"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40 p-2 space-y-1">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4 text-zinc-500">
            <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">No conversations yet.</p>
            <button
              onClick={onOpenNewChat}
              className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Start a new chat
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const partner = getPartner(conv, user);
            if (!partner) return null;

            const isSelected =
              getEntityId(activeConversation) === getEntityId(conv);
            const partnerId = getEntityId(partner);
            const livePresence = partnerId ? onlineUsers.get(partnerId) : null;
            const isOnline = livePresence
              ? livePresence.isOnline
              : partner.isOnline;

            // Find unread count for current user
            const unreadCount =
              conv.unreadCounts?.find(
                (u) => getEntityId(u.user) === getEntityId(user),
              )?.count || 0;

            return (
              <div
                key={conv._id}
                onClick={() => setActiveConversation(conv)}
                className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all ${
                  isSelected
                    ? "bg-indigo-600/15 border border-indigo-500/30"
                    : "hover:bg-zinc-800/60 border border-transparent"
                }`}
              >
                <Avatar
                  src={partner.profilePic?.url}
                  name={partner.displayName || partner.username}
                  size="md"
                  isOnline={isOnline}
                  showStatus={true}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3
                      className={`text-sm font-semibold truncate ${
                        isSelected ? "text-indigo-200" : "text-zinc-100"
                      }`}
                    >
                      {partner.displayName}
                    </h3>
                    <span className="text-[11px] text-zinc-500 flex-shrink-0 ml-2">
                      {formatTime(
                        conv.lastMessage?.createdAt || conv.updatedAt,
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p
                      className={`text-xs truncate ${
                        unreadCount > 0
                          ? "text-zinc-200 font-medium"
                          : "text-zinc-400"
                      }`}
                    >
                      {getLastMessageText(conv.lastMessage)}
                    </p>

                    {unreadCount > 0 && (
                      <span className="ml-2 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold text-white bg-indigo-600 rounded-full shadow-sm">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
