const mongoose = require('mongoose');

/**
 * Conversation Schema
 * Represents 1-on-1 private conversations as well as group chats.
 * Optimized with denormalized lastMessage and unreadCounters for sub-millisecond inbox renders.
 */
const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      trim: true,
      maxlength: [100, 'Group name cannot exceed 100 characters'],
      default: '',
    },
    groupAvatar: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      thumbnailUrl: { type: String, default: '' },
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    unreadCounts: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        count: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Optimize queries for finding a user's conversations ordered by latest message
conversationSchema.index({ participants: 1, updatedAt: -1 });

// Helper to quickly find or create a 1-on-1 conversation
conversationSchema.statics.findOrCreateDirectConversation = async function (userA, userB) {
  let conversation = await this.findOne({
    isGroup: false,
    participants: { $all: [userA, userB], $size: 2 },
  })
    .populate('participants', 'username displayName profilePic isOnline lastSeen')
    .populate({
      path: 'lastMessage',
      populate: { path: 'sender', select: 'username displayName' },
    });

  if (!conversation) {
    conversation = await this.create({
      participants: [userA, userB],
      isGroup: false,
      unreadCounts: [
        { user: userA, count: 0 },
        { user: userB, count: 0 },
      ],
    });

    conversation = await this.findById(conversation._id).populate(
      'participants',
      'username displayName profilePic isOnline lastSeen'
    );
  }

  return conversation;
};

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
