const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

/**
 * Socket.IO Handler
 * Manages real-time presence (multi-tab safe), status/DP broadcasting,
 * typing indicators, message receipts, and WebRTC peer signaling.
 */
const initSocketServer = (io) => {
  // In-memory multi-connection tracker: userId -> Set of socketIds
  // (In production multi-node clusters, replace or back with Redis)
  const userSocketMap = new Map();

  // Socket.IO authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.cookie
          ?.split('; ')
          .find((row) => row.startsWith('token='))
          ?.split('=')[1];

      if (!token) {
        return next(new Error('Authentication failed: Missing token.'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey');
      const user = await User.findById(decoded.id || decoded.userId).select(
        '_id username displayName profilePic'
      );

      if (!user) {
        return next(new Error('User not found.'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication failed: Invalid token.'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();

    // 1. Register active socket for this user
    if (!userSocketMap.has(userId)) {
      userSocketMap.set(userId, new Set());
    }
    const userSockets = userSocketMap.get(userId);
    userSockets.add(socket.id);

    // Join personal room for targeted alerts & multi-tab synchronization
    socket.join(`user:${userId}`);

    console.log(`[Socket] User connected: ${socket.user.username} (${socket.id}) | Total active sockets: ${userSockets.size}`);

    // If this is the user's first active tab/device, mark online and broadcast status
    if (userSockets.size === 1) {
      try {
        await User.findByIdAndUpdate(userId, { isOnline: true });

        // Join conversation rooms for active conversations
        const conversations = await Conversation.find({ participants: userId }).select('_id');
        conversations.forEach((conv) => {
          socket.join(`conversation:${conv._id}`);
          // Broadcast online status to conversation participants
          socket.to(`conversation:${conv._id}`).emit('user:status_changed', {
            userId,
            isOnline: true,
            lastSeen: new Date(),
          });
        });
      } catch (err) {
        console.error('[Socket] Error updating online status on connect:', err);
      }
    } else {
      // Auto-join existing user conversations on subsequent tabs
      const conversations = await Conversation.find({ participants: userId }).select('_id');
      conversations.forEach((conv) => {
        socket.join(`conversation:${conv._id}`);
      });
    }

    // ------------------------------------------------------------------
    // Event: Explicit DP / Profile Update Broadcast from Client
    // ------------------------------------------------------------------
    socket.on('user:broadcast_dp_update', async (data) => {
      try {
        const payload = {
          userId,
          profilePic: data.profilePic,
          displayName: socket.user.displayName,
        };

        // Notify user's other open tabs
        socket.to(`user:${userId}`).emit('user:profile_updated', payload);

        // Notify all conversation rooms
        const conversations = await Conversation.find({ participants: userId }).select('_id');
        conversations.forEach((conv) => {
          socket.to(`conversation:${conv._id}`).emit('user:profile_updated', payload);
        });
      } catch (err) {
        console.error('[Socket] Error in user:broadcast_dp_update:', err);
      }
    });

    // ------------------------------------------------------------------
    // Event: Conversation Room Management
    // ------------------------------------------------------------------
    socket.on('conversation:join', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // ------------------------------------------------------------------
    // Event: Typing Indicators
    // ------------------------------------------------------------------
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:status', {
        conversationId,
        userId,
        username: socket.user.username,
        isTyping: true,
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:status', {
        conversationId,
        userId,
        username: socket.user.username,
        isTyping: false,
      });
    });

    // ------------------------------------------------------------------
    // Event: Delivery & Read Receipts (Single -> Double -> Blue Double Ticks)
    // ------------------------------------------------------------------
    socket.on('message:delivered', async ({ messageId, conversationId, senderId }) => {
      io.to(`user:${senderId}`).emit('message:status_updated', {
        messageId,
        conversationId,
        status: 'delivered',
        deliveredAt: new Date(),
      });
    });

    socket.on('message:read', async ({ conversationId, senderId }) => {
      io.to(`user:${senderId}`).emit('message:read_receipt', {
        conversationId,
        readerId: userId,
        readAt: new Date(),
      });
    });

    // ------------------------------------------------------------------
    // Event: WebRTC 1-on-1 Audio/Video Call Signaling
    // ------------------------------------------------------------------
    socket.on('call:initiate', ({ toUserId, offer, callType }) => {
      console.log(`[WebRTC] Call initiated from ${userId} to ${toUserId} (${callType})`);
      io.to(`user:${toUserId}`).emit('call:incoming', {
        from: {
          id: userId,
          username: socket.user.username,
          displayName: socket.user.displayName,
          profilePic: socket.user.profilePic,
        },
        offer,
        callType, // 'audio' | 'video'
      });
    });

    socket.on('call:accept', ({ toUserId, answer }) => {
      io.to(`user:${toUserId}`).emit('call:accepted', {
        fromUserId: userId,
        answer,
      });
    });

    socket.on('call:reject', ({ toUserId, reason }) => {
      io.to(`user:${toUserId}`).emit('call:rejected', {
        fromUserId: userId,
        reason: reason || 'Call declined',
      });
    });

    socket.on('call:ice_candidate', ({ toUserId, candidate }) => {
      io.to(`user:${toUserId}`).emit('call:ice_candidate', {
        fromUserId: userId,
        candidate,
      });
    });

    socket.on('call:end', ({ toUserId }) => {
      io.to(`user:${toUserId}`).emit('call:ended', {
        fromUserId: userId,
      });
    });

    // ------------------------------------------------------------------
    // Event: Disconnect Handler (Safe Multi-Tab Cleanup)
    // ------------------------------------------------------------------
    socket.on('disconnect', async () => {
      const activeSockets = userSocketMap.get(userId);
      if (activeSockets) {
        activeSockets.delete(socket.id);

        // Only mark offline if ALL sessions/tabs are closed
        if (activeSockets.size === 0) {
          userSocketMap.delete(userId);
          const lastSeen = new Date();

          try {
            await User.findByIdAndUpdate(userId, {
              isOnline: false,
              lastSeen,
            });

            // Broadcast offline status to all conversations
            const conversations = await Conversation.find({ participants: userId }).select('_id');
            conversations.forEach((conv) => {
              io.to(`conversation:${conv._id}`).emit('user:status_changed', {
                userId,
                isOnline: false,
                lastSeen,
              });
            });

            console.log(`[Socket] User ${socket.user.username} went OFFLINE. Last seen: ${lastSeen.toISOString()}`);
          } catch (err) {
            console.error('[Socket] Error updating offline status:', err);
          }
        }
      }
    });
  });

  return { io, userSocketMap };
};

module.exports = { initSocketServer };
