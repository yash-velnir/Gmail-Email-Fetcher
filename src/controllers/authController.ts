import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import User from '../models/User';
import BlacklistedToken from '../models/BlacklistedToken';
import { oauth2Client, SCOPES } from '../config/gmail';
import emailSyncService from '../services/emailSyncService';
import { AuthCallbackQuery, JWTDecoded } from '../types/request.types';

export const getGoogleAuthUrl = (req: Request, res: Response): void => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  res.json({ authUrl });
};

export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.query as AuthCallbackQuery;

  // Check if code exists
  if (!code) {
    res.redirect(`/auth/error?message=${encodeURIComponent('No authorization code received')}`);
    return;
  }

  try {
    // Get tokens from Google
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Validate required tokens
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Missing required tokens from Google');
    }

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    // Validate user data
    if (!data.id || !data.email || !data.name) {
      throw new Error('Incomplete user data from Google');
    }

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

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured');
    }

    // Generate JWT token with version
    const jwtToken = jwt.sign(
      { 
        userId: user._id.toString(), 
        email: user.email,
        tokenVersion: user.tokenVersion
      },
      jwtSecret,
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
    const err = error as Error;
    console.error('❌ Auth Error:', err.message);
    
    // Handle specific errors
    let errorMessage = 'Authentication failed';
    
    if (err.message?.includes('invalid_grant')) {
      errorMessage = 'Authorization code has already been used or expired';
    } else if (err.message?.includes('redirect_uri_mismatch')) {
      errorMessage = 'OAuth redirect URI mismatch';
    } else if (err.message?.includes('invalid_client')) {
      errorMessage = 'Invalid OAuth client credentials';
    } else {
      errorMessage = err.message;
    }
    
    res.redirect(`/auth/error?message=${encodeURIComponent(errorMessage)}`);
  }
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('-accessToken -refreshToken');
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const userId = req.userId;

    if (!token || !userId) {
      res.status(400).json({ error: 'No token or user found' });
      return;
    }

    // 1. Get token expiration from JWT
    const decoded = jwt.decode(token) as JWTDecoded;
    
    if (!decoded || !decoded.exp) {
      res.status(400).json({ error: 'Invalid token format' });
      return;
    }

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

export const logoutAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Increment token version to invalidate all existing tokens
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { tokenVersion: 1 },
        lastLogoutAt: new Date()
      },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

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