const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { uploadMediaStream } = require('../config/cloudinary');

/**
 * @desc    Get all conversations for logged-in user
 * @route   GET /api/chats
 * @access  Private
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate('participants', 'username displayName profilePic isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'username displayName' },
      })
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      data: { conversations },
    });
  } catch (error) {
    console.error('[ChatController] Error in getConversations:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Find or create 1-on-1 conversation with specific user
 * @route   POST /api/chats/conversation
 * @access  Private
 */
const getOrCreateDirectConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;
    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Recipient ID is required.' });
    }

    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot start conversation with yourself.' });
    }

    const conversation = await Conversation.findOrCreateDirectConversation(
      req.user._id,
      recipientId
    );

    return res.status(200).json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get messages for a conversation with pagination
 * @route   GET /api/chats/:conversationId/messages
 * @access  Private
 */
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const limit = parseInt(req.query.limit, 10) || 50;
    const before = req.query.before; // Date timestamp for cursor pagination

    // Ensure user is participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found or access denied.' });
    }

    const query = {
      conversationId,
      deletedFor: { $ne: req.user._id },
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'username displayName profilePic')
      .sort({ createdAt: -1 })
      .limit(limit);

    // Return in chronological order
    return res.status(200).json({
      success: true,
      data: { messages: messages.reverse() },
    });
  } catch (error) {
    console.error('[ChatController] Error in getMessages:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Send a message (text or media)
 * @route   POST /api/chats/send
 * @access  Private
 */
const sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    let { conversationId, recipientId, text, type = 'text', media } = req.body;

    // Direct conversation lookup or creation if conversationId wasn't passed
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        participants: senderId,
      });
    } else if (recipientId) {
      conversation = await Conversation.findOrCreateDirectConversation(senderId, recipientId);
      conversationId = conversation._id;
    }

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    // Determine other recipient in 1-on-1 (guarantee it is NEVER the sender)
    const otherParticipant = conversation.participants.find(
      (p) => (p._id ? p._id.toString() : p.toString()) !== senderId.toString()
    );
    if (otherParticipant) {
      recipientId = otherParticipant._id ? otherParticipant._id.toString() : otherParticipant.toString();
    } else if (!recipientId) {
      recipientId = senderId.toString();
    }

    // Create message document
    const message = await Message.create({
      conversationId,
      sender: senderId,
      recipient: recipientId,
      type,
      text: text || '',
      media: media || {},
      status: 'sent',
    });

    // Populate sender info for real-time broadcast
    await message.populate('sender', 'username displayName profilePic');

    // Update conversation lastMessage & increment recipient's unread counter
    let unreadUpdated = false;
    conversation.unreadCounts = conversation.unreadCounts.map((item) => {
      const itemUserId = item.user._id ? item.user._id.toString() : item.user.toString();
      if (itemUserId === recipientId.toString()) {
        unreadUpdated = true;
        return { user: item.user, count: (item.count || 0) + 1 };
      }
      return item;
    });

    if (!unreadUpdated) {
      conversation.unreadCounts.push({ user: recipientId, count: 1 });
    }

    conversation.lastMessage = message._id;
    await conversation.save();

    // Populate conversation for inbox updates
    await conversation.populate('participants', 'username displayName profilePic isOnline lastSeen');
    await conversation.populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'username displayName' },
    });

    // Real-time broadcast via Socket.io
    const io = req.app.get('io');
    if (io) {
      // 1. Send message to conversation room
      io.to(`conversation:${conversationId}`).emit('message:received', {
        message,
        conversationId,
      });

      // 2. Also emit directly to recipient's personal room so it reaches them even if they haven't joined the conversation room yet
      io.to(`user:${recipientId}`).emit('message:received', {
        message,
        conversationId,
      });

      // 3. Alert recipient personal room (for conversation list update & unread badge)
      io.to(`user:${recipientId}`).emit('conversation:updated', {
        conversation,
        lastMessage: message,
      });

      // 4. Sync sender's other sessions/tabs
      io.to(`user:${senderId}`).emit('conversation:updated', {
        conversation,
        lastMessage: message,
      });
    }

    return res.status(201).json({
      success: true,
      data: { message, conversation },
    });
  } catch (error) {
    console.error('[ChatController] Error in sendMessage:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Upload chat media (images, voice notes, documents)
 * @route   POST /api/chats/upload-media
 * @access  Private
 */
const uploadChatMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { mimetype, originalname, size, buffer } = req.file;

    // Detect resource type for Cloudinary
    let resourceType = 'auto';
    if (mimetype.startsWith('image/')) resourceType = 'image';
    else if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) resourceType = 'video';
    else resourceType = 'raw';

    let mediaData;
    try {
      const result = await uploadMediaStream(buffer, {
        resource_type: resourceType,
        public_id: `media_${Date.now()}_${originalname.replace(/\s+/g, '_')}`,
      });
      mediaData = {
        url: result.secure_url,
        publicId: result.public_id,
        fileType: mimetype,
        fileName: originalname,
        fileSize: size,
        thumbnailUrl: result.resource_type === 'image' ? result.secure_url : '',
        duration: result.duration || 0,
      };
    } catch (uploadErr) {
      console.warn('[ChatController] Cloudinary upload failed (using Base64 fallback):', uploadErr.message);
      const base64Url = `data:${mimetype};base64,${buffer.toString('base64')}`;
      mediaData = {
        url: base64Url,
        publicId: `local_${Date.now()}`,
        fileType: mimetype,
        fileName: originalname,
        fileSize: size,
        thumbnailUrl: mimetype.startsWith('image/') ? base64Url : '',
        duration: 0,
      };
    }

    return res.status(200).json({
      success: true,
      data: { media: mediaData },
    });
  } catch (error) {
    console.error('[ChatController] Error in uploadChatMedia:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Mark conversation messages as read
 * @route   PATCH /api/chats/:conversationId/read
 * @access  Private
 */
const markConversationAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // 1. Reset unread count for this user in conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found.' });
    }

    conversation.unreadCounts = conversation.unreadCounts.map((item) => {
      if (item.user.toString() === userId.toString()) {
        return { user: item.user, count: 0 };
      }
      return item;
    });
    await conversation.save();

    // 2. Mark unread messages sent by others as 'read'
    await Message.updateMany(
      {
        conversationId,
        sender: { $ne: userId },
        status: { $ne: 'read' },
      },
      {
        $set: { status: 'read', readAt: new Date() },
      }
    );

    // 3. Broadcast read receipt via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation:${conversationId}`).emit('message:read_receipt', {
        conversationId,
        readerId: userId.toString(),
        readAt: new Date(),
      });
    }

    return res.status(200).json({ success: true, message: 'Conversation marked as read.' });
  } catch (error) {
    console.error('[ChatController] Error in markConversationAsRead:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getConversations,
  getOrCreateDirectConversation,
  getMessages,
  sendMessage,
  uploadChatMedia,
  markConversationAsRead,
};
