const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const User = require('../models/User');
const BlacklistedToken = require('../models/BlacklistedToken');
const { oauth2Client, SCOPES } = require('../config/gmail');
const emailSyncService = require('../services/emailSyncService');

exports.getGoogleAuthUrl = (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  res.json({ authUrl });
};

exports.googleCallback = async (req, res) => {
  const { code } = req.query;

  // Check if code exists
  if (!code) {
    return res.redirect(`/auth/error?message=${encodeURIComponent('No authorization code received')}`);
  }

  try {
    // Get tokens from Google
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Find or create user
    let user = await User.findOne({ googleId: data.id });
    let isNewUser = false;

    if (user) {
      // Update existing user
      user.accessToken = tokens.access_token;
      user.refreshToken = tokens.refresh_token || user.refreshToken;
      user.picture = data.picture;
      user.name = data.name;
      // Increment token version on each login
      user.tokenVersion = (user.tokenVersion || 0) + 1;
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
        isFirstSync: true,
        tokenVersion: 1
      });
      isNewUser = true;
    }

    // Generate JWT token with version
    const jwtToken = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        tokenVersion: user.tokenVersion
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Trigger email sync in background for new users or first sync
    if (isNewUser || user.isFirstSync) {
      emailSyncService.syncUserEmails(user._id).catch(err => {
        console.error('Initial sync error:', err);
      });
    }

    // Redirect to success page with token
    res.redirect(`/auth/success?token=${jwtToken}`);

  } catch (error) {
    console.error('❌ Auth Error:', error.message);
    
    // Handle specific errors
    let errorMessage = 'Authentication failed';
    
    if (error.message?.includes('invalid_grant')) {
      errorMessage = 'Authorization code has already been used or expired';
    } else if (error.message?.includes('redirect_uri_mismatch')) {
      errorMessage = 'OAuth redirect URI mismatch';
    } else if (error.message?.includes('invalid_client')) {
      errorMessage = 'Invalid OAuth client credentials';
    } else {
      errorMessage = error.message;
    }
    
    res.redirect(`/auth/error?message=${encodeURIComponent(errorMessage)}`);
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

exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const userId = req.userId;

    if (!token || !userId) {
      return res.status(400).json({ error: 'No token or user found' });
    }

    // 1. Get token expiration from JWT
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    // 2. Add token to blacklist
    await BlacklistedToken.create({
      token: token,
      userId: userId,
      reason: 'logout',
      expiresAt: expiresAt
    });

    // 3. Update user's last logout time
    await User.findByIdAndUpdate(userId, {
      lastLogoutAt: new Date()
    });

    console.log(`✅ User ${req.userEmail} logged out successfully`);

    res.json({ 
      message: 'Logged out successfully',
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

exports.logoutAll = async (req, res) => {
  try {
    const userId = req.userId;

    // Increment token version to invalidate all existing tokens
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { tokenVersion: 1 },
        lastLogoutAt: new Date()
      },
      { new: true }
    );

    console.log(`✅ User ${req.userEmail} logged out from all devices (new version: ${user.tokenVersion})`);

    res.json({ 
      message: 'Logged out from all devices successfully',
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};