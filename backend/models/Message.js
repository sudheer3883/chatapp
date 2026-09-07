const mongoose = require('mongoose');

/**
 * Message Schema
 * Supports rich media, voice notes, documents, delivery receipts (single/double ticks),
 * and soft-deletion ("delete for me" / "delete for everyone").
 */
const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required'],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Convenient for 1-on-1 direct routing & queries
    },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'document', 'system'],
      default: 'text',
    },
    text: {
      type: String,
      trim: true,
      maxlength: [4000, 'Message text cannot exceed 4000 characters'],
      default: '',
    },
    media: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
      fileType: { type: String, default: '' }, // e.g., 'image/webp', 'audio/mp3', 'application/pdf'
      fileName: { type: String, default: '' },
      fileSize: { type: Number, default: 0 }, // In bytes
      duration: { type: Number, default: 0 }, // For voice notes/video (seconds)
      thumbnailUrl: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isDeletedForEveryone: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound index for cursor-based chat history scrolling
messageSchema.index({ conversationId: 1, createdAt: -1 });

// Index for unread message aggregations
messageSchema.index({ conversationId: 1, recipient: 1, status: 1 });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
