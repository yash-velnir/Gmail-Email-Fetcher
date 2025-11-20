const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  threadId: String,
  from: {
    name: String,
    email: String
  },
  to: [{
    name: String,
    email: String
  }],
  subject: String,
  snippet: String,
  body: {
    text: String,
    html: String
  },
  date: {
    type: Date,
    index: true
  },
  labels: [String],
  isRead: Boolean,
  isImportant: Boolean,
  hasAttachments: Boolean,
  attachments: [{
    filename: String,
    mimeType: String,
    size: Number
  }],
  // For future AI classification
  aiClassification: {
    isImportant: Boolean,
    category: String,
    confidence: Number
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
emailSchema.index({ userId: 1, date: -1 });
emailSchema.index({ userId: 1, messageId: 1 }, { unique: true });

module.exports = mongoose.model('Email', emailSchema);
