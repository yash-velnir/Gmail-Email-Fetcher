import cron from 'node-cron';
import emailSyncService from '../services/emailSyncService';

const startEmailSyncJob = (): void => {
  cron.schedule('*/30 * * * *', async () => {
    console.log('\n⏰ Running scheduled email sync...');
    try {
      await emailSyncService.syncAllUsers();
    } catch (error) {
      console.error('Cron job error:', error);
    }
  });

  console.log('✅ Email sync cron job started (runs every 30 minutes)');
};

export default startEmailSyncJob;