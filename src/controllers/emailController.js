const Email = require('../models/Email');
const emailSyncService = require('../services/emailSyncService');

exports.getEmails = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, isRead, isImportant } = req.query;

    const query = { userId: req.userId };

    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { 'from.email': { $regex: search, $options: 'i' } },
        { snippet: { $regex: search, $options: 'i' } }
      ];
    }

    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    if (isImportant !== undefined) {
      query.isImportant = isImportant === 'true';
    }

    const emails = await Email.find(query)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-body.html -body.text'); // Don't send full body in list

    const count = await Email.countDocuments(query);

    res.json({
      emails,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getEmailById = async (req, res) => {
  try {
    const email = await Email.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json({ email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.triggerSync = async (req, res) => {
  try {
    const result = await emailSyncService.syncUserEmails(req.userId);
    res.json({ message: 'Sync completed', result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
