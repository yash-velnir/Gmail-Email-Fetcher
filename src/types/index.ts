import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  refreshToken: string;
  lastSyncedAt: Date | null;
  isFirstSync: boolean;
  tokenVersion: number;
  lastLogoutAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IEmailAddress {
  name?: string;
  email: string;
}

export interface IAttachment {
  filename: string;
  mimeType: string;
  size: number;
}

export interface IAIClassification {
  isImportant?: boolean;
  category?: string;
  confidence?: number;
}

export interface IEmail extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  messageId: string;
  threadId?: string;
  from: IEmailAddress;
  to: IEmailAddress[];
  subject?: string;
  snippet?: string;
  body: {
    text?: string;
    html?: string;
  };
  date: Date;
  labels: string[];
  isRead: boolean;
  isImportant: boolean;
  hasAttachments: boolean;
  attachments: IAttachment[];
  aiClassification?: IAIClassification;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBlacklistedToken extends Document {
  _id: Types.ObjectId;
  token: string;
  userId: Types.ObjectId;
  reason: 'logout' | 'security' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJWTPayload {
  userId: string;
  email: string;
  tokenVersion: number;
}

export interface ISyncResult {
  synced: number;
  skipped: number;
}

export interface IEmailData {
  messageId: string;
  threadId?: string | null; 
  from: IEmailAddress;
  to: IEmailAddress[];
  subject?: string | null; 
  snippet?: string | null; 
  body: {
    text?: string | null; 
    html?: string | null; 
  };
  date: Date;
  labels: string[];
  isRead: boolean;
  isImportant: boolean;
  hasAttachments: boolean;
  attachments: IAttachment[];
}