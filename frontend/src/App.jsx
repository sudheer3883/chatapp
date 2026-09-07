import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { ChatProvider } from './context/ChatContext';

import AuthModal from './components/auth/AuthModal';
import Sidebar from './components/chat/Sidebar';
import ChatPane from './components/chat/ChatPane';
import CallModal from './components/call/CallModal';
import ProfileSettingsModal from './components/profile/ProfileSettingsModal';
import NewChatModal from './components/chat/NewChatModal';

const ChatDashboard = () => {
  const { user, updateUser } = useAuth();
  const { socket, setActiveCall } = useSocket();

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);

  // Trigger outbound call
  const handleStartCall = (peerUser, callType) => {
    setActiveCall({
      peerUser,
      callType,
      isInitiator: true,
    });
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Left Sidebar: Conversations, Presence & Contacts */}
      <Sidebar
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenNewChat={() => setNewChatModalOpen(true)}
      />

      {/* Right Main Pane: Active Conversation & Calling Canvas */}
      <ChatPane onStartCall={handleStartCall} />

      {/* WebRTC Video & Audio Calling Overlay */}
      <CallModal />

      {/* Profile & Avatar Settings Modal */}
      <ProfileSettingsModal
        user={user}
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        onUpdateUser={updateUser}
        socket={socket}
      />

      {/* New Conversation Selector Modal */}
      <NewChatModal
        isOpen={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
      />
    </div>
  );
};

const MainContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-indigo-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-zinc-400 font-medium">Initializing secure connection...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthModal />;
  }

  return (
    <SocketProvider>
      <ChatProvider>
        <ChatDashboard />
      </ChatProvider>
    </SocketProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
