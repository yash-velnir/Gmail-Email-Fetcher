#!/bin/bash

echo "🚀 Creating Gmail Email Fetcher Backend..."

# Create directory structure
mkdir -p src/{config,models,controllers,services,routes,middleware,jobs}

# Create .env file
cat > .env << 'EOF'
PORT=5000
MONGODB_URI=mongodb://localhost:27017/email-ai
JWT_SECRET=your_super_secret_jwt_key_change_this_random_12345

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# Frontend URL
FRONTEND_URL=http://localhost:3000
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
node_modules/
.env
.DS_Store
*.log
.vscode/
EOF

# Create package.json
cat > package.json << 'EOF'
{
  "name": "gmail-email-fetcher",
  "version": "1.0.0",
  "description": "AI-powered email classifier backend",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js"
  },
  "keywords": ["gmail", "ai", "email", "classifier"],
  "author": "",
  "license": "ISC"
}
EOF

# Create src/config/database.js
cat > src/config/database.js << 'EOF'
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
EOF

# Create src/config/gmail.js
cat > src/config/gmail.js << 'EOF'
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Scopes for Gmail API
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

module.exports = {
  oauth2Client,
  SCOPES
};
EOF

# Create src/config/constants.js
cat > src/config/constants.js << 'EOF'
module.exports = {
  SYNC_INTERVAL: 30 * 60 * 1000, // 30 minutes in milliseconds
  INITIAL_FETCH_DAYS: 7,
  MAX_RESULTS_PER_FETCH: 100
};
EOF

# Create src/models/User.js
cat > src/models/User.js << 'EOF'
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
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
  picture: String,
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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
EOF

# Create src/models/Email.js
cat > src/models/Email.js << 'EOF'
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
EOF

# Create src/middleware/authMiddleware.js
cat > src/middleware/authMiddleware.js << 'EOF'
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
EOF

# Create src/controllers/authController.js
cat > src/controllers/authController.js << 'EOF'
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const User = require('../models/User');
const { oauth2Client, SCOPES } = require('../config/gmail');

exports.getGoogleAuthUrl = (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force to get refresh token
  });

  res.json({ authUrl });
};

exports.googleCallback = async (req, res) => {
  try {
    const { code } = req.query;

    // Get tokens from Google
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Find or create user
    let user = await User.findOne({ googleId: data.id });

    if (user) {
      // Update existing user
      user.accessToken = tokens.access_token;
      user.refreshToken = tokens.refresh_token || user.refreshToken;
      user.picture = data.picture;
      await user.save();
    } else {
      // Create new user
      user = await User.create({
        googleId: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        isFirstSync: true
      });
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}`);
  } catch (error) {
    console.error('Auth Error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-accessToken -refreshToken');
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.logout = (req, res) => {
  res.json({ message: 'Logged out successfully' });
};
EOF

# Create src/controllers/emailController.js
cat > src/controllers/emailController.js << 'EOF'
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
EOF

# Create src/services/gmailService.js (part 1 due to size)
cat > src/services/gmailService.js << 'EOF'
const { google } = require('googleapis');
const { oauth2Client } = require('../config/gmail');

class GmailService {
  constructor(accessToken, refreshToken) {
    const auth = oauth2Client;
    auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    this.gmail = google.gmail({ version: 'v1', auth });
  }

  async fetchEmails(query, maxResults = 100) {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      return response.data.messages || [];
    } catch (error) {
      console.error('Error fetching email list:', error);
      throw error;
    }
  }

  async getEmailDetails(messageId) {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      return this.parseEmail(response.data);
    } catch (error) {
      console.error('Error fetching email details:', error);
      throw error;
    }
  }

  parseEmail(message) {
    const headers = message.payload.headers;
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : '';
    };

    const parseAddress = (addressString) => {
      if (!addressString) return null;
      const match = addressString.match(/(?:"?([^"]*)"?\s)?<?([^>]+)>?/);
      return {
        name: match?.[1] || '',
        email: match?.[2] || addressString
      };
    };

    let body = { text: '', html: '' };
    
    const getBody = (parts) => {
      if (!parts) {
        if (message.payload.body.data) {
          const data = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
          if (message.payload.mimeType === 'text/html') {
            body.html = data;
          } else {
            body.text = data;
          }
        }
        return;
      }

      parts.forEach(part => {
        if (part.parts) {
          getBody(part.parts);
        } else if (part.mimeType === 'text/plain' && part.body.data) {
          body.text = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body.data) {
          body.html = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      });
    };

    getBody(message.payload.parts);

    const attachments = [];
    const getAttachments = (parts) => {
      if (!parts) return;
      parts.forEach(part => {
        if (part.filename && part.body.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size
          });
        }
        if (part.parts) {
          getAttachments(part.parts);
        }
      });
    };
    getAttachments(message.payload.parts);

    return {
      messageId: message.id,
      threadId: message.threadId,
      from: parseAddress(getHeader('From')),
      to: getHeader('To').split(',').map(addr => parseAddress(addr.trim())),
      subject: getHeader('Subject'),
      snippet: message.snippet,
      body: body,
      date: new Date(parseInt(message.internalDate)),
      labels: message.labelIds || [],
      isRead: !message.labelIds?.includes('UNREAD'),
      isImportant: message.labelIds?.includes('IMPORTANT'),
      hasAttachments: attachments.length > 0,
      attachments: attachments
    };
  }
}

module.exports = GmailService;
EOF

# Create src/services/emailSyncService.js
cat > src/services/emailSyncService.js << 'EOF'
const User = require('../models/User');
const Email = require('../models/Email');
const GmailService = require('./gmailService');
const { INITIAL_FETCH_DAYS, MAX_RESULTS_PER_FETCH } = require('../config/constants');

class EmailSyncService {
  async syncUserEmails(userId) {
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

          const emailData = await gmailService.getEmailDetails(message.id);

          await Email.create({
            userId: user._id,
            ...emailData
          });

          synced++;
        } catch (error) {
          console.error(`Error processing email ${message.id}:`, error.message);
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

  async syncAllUsers() {
    try {
      const users = await User.find({});
      console.log(`\n🔄 Starting sync for ${users.length} users...`);

      for (const user of users) {
        try {
          await this.syncUserEmails(user._id);
        } catch (error) {
          console.error(`Error syncing user ${user.email}:`, error.message);
        }
      }

      console.log('✅ All users synced\n');
    } catch (error) {
      console.error('Error in syncAllUsers:', error);
    }
  }
}

module.exports = new EmailSyncService();
EOF

# Create src/routes/authRoutes.js
cat > src/routes/authRoutes.js << 'EOF'
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/google', authController.getGoogleAuthUrl);
router.get('/google/callback', authController.googleCallback);
router.get('/me', authMiddleware, authController.getCurrentUser);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
EOF

# Create src/routes/emailRoutes.js
cat > src/routes/emailRoutes.js << 'EOF'
const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', emailController.getEmails);
router.get('/:id', emailController.getEmailById);
router.post('/sync', emailController.triggerSync);

module.exports = router;
EOF

# Create src/jobs/emailSyncJob.js
cat > src/jobs/emailSyncJob.js << 'EOF'
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
EOF

# Create src/app.js
cat > src/app.js << 'EOF'
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const startEmailSyncJob = require('./jobs/emailSyncJob');

const authRoutes = require('./routes/authRoutes');
const emailRoutes = require('./routes/emailRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Connect to database
connectDB();

// Start cron job
startEmailSyncJob();

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
EOF

# Create README.md
cat > README.md << 'EOF'
# Gmail Email Fetcher Backend

AI-powered email classifier that fetches and organizes your Gmail emails.

## Setup

1. Install dependencies:
```bash
npm install express mongoose dotenv googleapis nodemailer node-cron jsonwebtoken bcryptjs cors
npm install --save-dev nodemon