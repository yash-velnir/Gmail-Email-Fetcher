import User from '../models/User';
import Email from '../models/Email';
import GmailService from './gmailService';
import { INITIAL_FETCH_DAYS, MAX_RESULTS_PER_FETCH } from '../config/constants';
import { ISyncResult } from '../types';
import { Types } from 'mongoose';

class EmailSyncService {
  async syncUserEmails(userId: string | Types.ObjectId): Promise<ISyncResult> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const gmailService = new GmailService(user.accessToken, user.refreshToken);

      let query = '';
      
      if (user.isFirstSync) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - INITIAL_FETCH_DAYS);
        query = `after:${Math.floor(daysAgo.getTime() / 1000)}`;
        console.log(`🔄 First sync for user ${user.email} - fetching last ${INITIAL_FETCH_DAYS} days`);
      } 
      else if (user.lastSyncedAt) {
        const lastSyncTimestamp = Math.floor(user.lastSyncedAt.getTime() / 1000);
        query = `after:${lastSyncTimestamp}`;
        console.log(`🔄 Syncing new emails for user ${user.email} since ${user.lastSyncedAt}`);
      }

      const messages = await gmailService.fetchEmails(query, MAX_RESULTS_PER_FETCH);
      
      if (!messages || messages.length === 0) {
        console.log(`✅ No new emails for ${user.email}`);
        return { synced: 0, skipped: 0 };
      }

      console.log(`📧 Found ${messages.length} emails to process`);

      let synced = 0;
      let skipped = 0;

      for (const message of messages) {
        try {
          const existingEmail = await Email.findOne({ messageId: message.id });
          if (existingEmail) {
            skipped++;
            continue;
          }

          const emailData = await gmailService.getEmailDetails(message.id!);

          await Email.create({
            userId: user._id,
            ...emailData
          });

          synced++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error processing email ${message.id}:`, errorMessage);
        }
      }

      user.lastSyncedAt = new Date();
      user.isFirstSync = false;
      await user.save();

      console.log(`✅ Sync complete for ${user.email}: ${synced} synced, ${skipped} skipped`);

      return { synced, skipped };
    } catch (error) {
      console.error(`Error syncing emails for user ${userId}:`, error);
      throw error;
    }
  }

  async syncAllUsers(): Promise<void> {
    try {
      const users = await User.find({});
      console.log(`\n🔄 Starting sync for ${users.length} users...`);

      for (const user of users) {
        try {
          await this.syncUserEmails(user._id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error syncing user ${user.email}:`, errorMessage);
        }
      }

      console.log('✅ All users synced\n');
    } catch (error) {
      console.error('Error in syncAllUsers:', error);
    }
  }
}

export default new EmailSyncService();