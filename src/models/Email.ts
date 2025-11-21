import mongoose, { Schema, Model } from 'mongoose';
import { IEmail } from '../types';

const emailSchema = new Schema<IEmail>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  threadId: {
    type: String
  },
  from: {
    name: String,
    email: String
  },
  to: [{
    name: String,
    email: String
  }],
  subject: {
    type: String
  },
  snippet: {
    type: String
  },
  body: {
    text: String,
    html: String
  },
  date: {
    type: Date,
    index: true
  },
  labels: [String],
  isRead: {
    type: Boolean
  },
  isImportant: {
    type: Boolean
  },
  hasAttachments: {
    type: Boolean
  },
  attachments: [{
    filename: String,
    mimeType: String,
    size: Number
  }],
  aiClassification: {
    isImportant: Boolean,
    category: String,
    confidence: Number
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
emailSchema.index({ userId: 1, date: -1 });
emailSchema.index({ userId: 1, messageId: 1 }, { unique: true });

const Email: Model<IEmail> = mongoose.model<IEmail>('Email', emailSchema);

export default Email;