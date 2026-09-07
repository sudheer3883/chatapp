import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { getEntityId, getPartner } from '../utils/chatHelpers';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // { [conversationId]: string (username) }

  const myId = getEntityId(user);

  // 1. Fetch conversations on initial load
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/chats', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setConversations(data.data.conversations);
        }
      }
    } catch (err) {
      console.error('[ChatContext] Error fetching conversations:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 2. Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    const activeId = getEntityId(activeConversation);

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/chats/${activeId}/messages`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setMessages(data.data.messages);
          }
        }

        // Mark as read immediately when opened
        await fetch(`/api/chats/${activeId}/read`, {
          method: 'PATCH',
          credentials: 'include',
        });

        // Reset local unread counter for this conversation
        setConversations((prev) =>
          prev.map((c) =>
            getEntityId(c) === activeId
              ? {
                  ...c,
                  unreadCounts: c.unreadCounts?.map((u) =>
                    getEntityId(u.user) === myId ? { ...u, count: 0 } : u
                  ),
                }
              : c
          )
        );

        if (socket) {
          socket.emit('conversation:join', activeId);
        }
      } catch (err) {
        console.error('[ChatContext] Error loading messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [activeConversation, myId, socket]);

  // 3. Socket event listeners for messages, typing, receipts, and profile DP broadcasts
  useEffect(() => {
    if (!socket || !user) return;

    // Real-time new message handler
    const handleNewMessage = ({ message, conversationId }) => {
      const currentActiveId = getEntityId(activeConversation);

      if (currentActiveId === getEntityId(conversationId)) {
        setMessages((prev) => {
          if (prev.some((m) => getEntityId(m) === getEntityId(message))) return prev;
          return [...prev, message];
        });

        // Notify read receipt immediately if sender is not current user
        if (getEntityId(message.sender) !== myId) {
          socket.emit('message:read', {
            conversationId,
            senderId: getEntityId(message.sender),
          });
        }
      }

      // Update lastMessage and unread count in conversations list
      setConversations((prev) => {
        const convExists = prev.some((c) => getEntityId(c) === getEntityId(conversationId));
        if (!convExists) {
          // Trigger conversation list refetch if it's a completely new incoming conversation
          fetchConversations();
          return prev;
        }

        const updated = prev.map((c) => {
          if (getEntityId(c) === getEntityId(conversationId)) {
            const isCurrentChat = currentActiveId === getEntityId(conversationId);
            return {
              ...c,
              lastMessage: message,
              updatedAt: new Date().toISOString(),
              unreadCounts: c.unreadCounts?.map((u) => {
                const isMe = getEntityId(u.user) === myId;
                return isMe && !isCurrentChat
                  ? { ...u, count: (u.count || 0) + 1 }
                  : u;
              }),
            };
          }
          return c;
        });

        return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });
    };

    // Live Conversation Updated broadcast (when someone sends a first message or updates conversation)
    const handleConversationUpdated = ({ conversation, lastMessage }) => {
      const convId = getEntityId(conversation);

      setConversations((prev) => {
        const exists = prev.some((c) => getEntityId(c) === convId);
        let updatedList;
        if (exists) {
          updatedList = prev.map((c) =>
            getEntityId(c) === convId ? { ...c, ...conversation, lastMessage } : c
          );
        } else {
          updatedList = [{ ...conversation, lastMessage }, ...prev];
        }
        return updatedList.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });

      // Auto-join socket room for newly arrived conversation
      socket.emit('conversation:join', convId);
    };

    // Typing status listener
    const handleTypingStatus = ({ conversationId, userId, username, isTyping }) => {
      // Ignore own typing
      if (getEntityId(userId) === myId) return;

      setTypingUsers((prev) => ({
        ...prev,
        [conversationId]: isTyping ? username : null,
      }));
    };

    // Read receipt listener (turn tick blue)
    const handleReadReceipt = ({ conversationId }) => {
      if (getEntityId(activeConversation) === getEntityId(conversationId)) {
        setMessages((prev) =>
          prev.map((msg) =>
            getEntityId(msg.sender) === myId
              ? { ...msg, status: 'read', readAt: new Date() }
              : msg
          )
        );
      }
    };

    // DP & profile live update broadcast across contacts
    const handleProfileUpdated = ({ userId, profilePic, displayName }) => {
      setConversations((prev) =>
        prev.map((conv) => ({
          ...conv,
          participants: conv.participants.map((p) =>
            getEntityId(p) === getEntityId(userId)
              ? { ...p, profilePic, displayName: displayName || p.displayName }
              : p
          ),
        }))
      );

      if (activeConversation) {
        setActiveConversation((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            participants: prev.participants.map((p) =>
              getEntityId(p) === getEntityId(userId)
                ? { ...p, profilePic, displayName: displayName || p.displayName }
                : p
            ),
          };
        });
      }
    };

    socket.on('message:received', handleNewMessage);
    socket.on('conversation:updated', handleConversationUpdated);
    socket.on('typing:status', handleTypingStatus);
    socket.on('message:read_receipt', handleReadReceipt);
    socket.on('user:profile_updated', handleProfileUpdated);

    return () => {
      socket.off('message:received', handleNewMessage);
      socket.off('conversation:updated', handleConversationUpdated);
      socket.off('typing:status', handleTypingStatus);
      socket.off('message:read_receipt', handleReadReceipt);
      socket.off('user:profile_updated', handleProfileUpdated);
    };
  }, [socket, activeConversation, user, myId, fetchConversations]);

  // Send text or media message
  const sendMessage = async ({ text, type = 'text', media = null }) => {
    if (!activeConversation) return;

    const partner = getPartner(activeConversation, user);
    const recipientId = getEntityId(partner);

    // Optimistic message placeholder
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      conversationId: getEntityId(activeConversation),
      sender: user,
      recipient: partner,
      text: text || '',
      type,
      media: media || {},
      status: 'sent',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetch('/api/chats/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationId: getEntityId(activeConversation),
          recipientId,
          text,
          type,
          media,
        }),
      });

      const data = await res.json();
      if (data.success && data.data?.message) {
        setMessages((prev) =>
          prev.map((msg) => (msg._id === tempId ? data.data.message : msg))
        );
      }
    } catch (err) {
      console.error('[ChatContext] Send message error:', err);
    }
  };

  // Start or open a direct chat with someone
  const startDirectChat = async (recipientId) => {
    try {
      const res = await fetch('/api/chats/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recipientId: getEntityId(recipientId) }),
      });

      const data = await res.json();
      if (data.success && data.data?.conversation) {
        const conv = data.data.conversation;
        setActiveConversation(conv);
        if (socket) {
          socket.emit('conversation:join', getEntityId(conv));
        }
        await fetchConversations();
        return conv;
      }
    } catch (err) {
      console.error('[ChatContext] Start direct chat error:', err);
    }
  };

  // Emit typing indicators
  const sendTypingStatus = (isTyping) => {
    if (!socket || !activeConversation) return;
    socket.emit(isTyping ? 'typing:start' : 'typing:stop', {
      conversationId: getEntityId(activeConversation),
    });
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversation,
        setActiveConversation,
        messages,
        loadingMessages,
        typingUsers,
        sendMessage,
        startDirectChat,
        sendTypingStatus,
        fetchConversations,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
};
