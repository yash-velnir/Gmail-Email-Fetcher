import mongoose, { Schema, Model } from 'mongoose';
import { IBlacklistedToken } from '../types';

const blacklistedTokenSchema = new Schema<IBlacklistedToken>({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    enum: ['logout', 'security', 'expired'],
    default: 'logout'
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Automatically delete expired blacklisted tokens
blacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const BlacklistedToken: Model<IBlacklistedToken> = mongoose.model<IBlacklistedToken>(
  'BlacklistedToken', 
  blacklistedTokenSchema
);

export default BlacklistedToken;