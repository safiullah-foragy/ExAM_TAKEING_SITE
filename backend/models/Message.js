const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: String,
      required: true,
      index: true,
    },
    senderModel: {
      type: String,
      enum: ['User', 'Admin'],
      default: 'User',
    },
    senderName: {
      type: String,
      required: true,
    },
    senderPhoto: {
      type: String,
      default: null,
    },
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    recipientModel: {
      type: String,
      enum: ['User', 'Admin'],
      default: 'User',
    },
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    text: {
      type: String,
      default: '',
      trim: true,
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    mediaType: {
      type: String,
      enum: ['image', 'pdf', null],
      default: null,
    },
    mediaName: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
