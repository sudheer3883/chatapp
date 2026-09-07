import React, { useState, useEffect } from "react";
import {
  Search,
  X,
  MessageSquarePlus,
  Loader2,
  User,
  MessageCircle,
} from "lucide-react";
import Avatar from "../common/Avatar";
import { useChat } from "../../context/ChatContext";

export const NewChatModal = ({ isOpen, onClose }) => {
  const { startDirectChat } = useChat();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setError("");
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `/api/auth/users?search=${encodeURIComponent(search)}`,
          {
            credentials: "include",
          },
        );
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setUsers(data.data.users || []);
          }
        } else {
          setError("Failed to load contacts");
        }
      } catch (err) {
        console.error("[NewChatModal] Error searching users:", err);
        setError("Connection error. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [isOpen, search]);

  const handleSelectUser = async (recipientId) => {
    try {
      await startDirectChat(recipientId);
      onClose();
      setSearch("");
    } catch (err) {
      setError("Failed to start conversation");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100">New Chat</h3>
              <p className="text-xs text-zinc-500">Select a contact</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all hover:scale-110"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/30 backdrop-blur-sm sticky top-16 z-10">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or @username..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder-zinc-600"
              autoFocus
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* User list */}
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <span className="text-sm">Finding contacts...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 space-y-3">
              <MessageSquarePlus className="w-8 h-8 mx-auto opacity-50" />
              <div>
                <p className="text-sm font-medium">
                  {search ? "No contacts found" : "No contacts"}
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  {search
                    ? `Try searching with a different name`
                    : "Invite friends to chat"}
                </p>
              </div>
            </div>
          ) : (
            users.map((targetUser) => (
              <button
                key={targetUser._id}
                onClick={() => handleSelectUser(targetUser._id)}
                className="w-full flex items-center gap-3.5 p-3 rounded-2xl hover:bg-zinc-800/80 active:bg-zinc-800 transition-all group text-left"
              >
                <Avatar
                  src={targetUser.profilePic?.url}
                  name={targetUser.displayName || targetUser.username}
                  size="md"
                  isOnline={targetUser.isOnline}
                  showStatus={true}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors truncate">
                    {targetUser.displayName}
                  </h4>
                  <p className="text-xs text-zinc-400 truncate">
                    @{targetUser.username}
                  </p>
                  {targetUser.bio && (
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5 line-clamp-1">
                      {targetUser.bio}
                    </p>
                  )}
                </div>
                <MessageCircle className="w-5 h-5 text-zinc-600 group-hover:text-indigo-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100" />
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        {!loading && users.length > 0 && (
          <div className="px-4 py-3 border-t border-zinc-800/50 bg-zinc-900/30 text-center text-xs text-zinc-500">
            Click on a contact to start chatting
          </div>
        )}
      </div>
    </div>
  );
};

export default NewChatModal;
