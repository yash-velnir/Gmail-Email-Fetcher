const cron = require('node-cron');
const emailSyncService = require('../services/emailSyncService');

const startEmailSyncJob = () => {
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

module.exports = startEmailSyncJob;
