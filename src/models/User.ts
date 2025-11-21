import mongoose, { Schema, Model } from 'mongoose';
import { IUser } from '../types';

const userSchema = new Schema<IUser>({
  googleId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  picture: {
    type: String
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: true
  },
  lastSyncedAt: {
    type: Date,
    default: null
  },
  isFirstSync: {
    type: Boolean,
    default: true
  },
  tokenVersion: {
    type: Number,
    default: 0
  },
  lastLogoutAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;