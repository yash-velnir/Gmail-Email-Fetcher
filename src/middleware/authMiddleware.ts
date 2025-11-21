import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import BlacklistedToken from '../models/BlacklistedToken';
import { IJWTPayload } from '../types';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      tokenVersion?: number;
    }
  }
}

const authMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    // 1. Verify JWT signature and expiration
    const decoded = jwt.verify(token, jwtSecret) as IJWTPayload;

    // 2. Check if token is blacklisted
    const blacklisted = await BlacklistedToken.findOne({ token });
    if (blacklisted) {
      res.status(401).json({ 
        error: 'Token has been revoked',
        reason: blacklisted.reason 
      });
      return;
    }

    // 3. Check token version (for logout from all devices)
    if (decoded.tokenVersion !== undefined) {
      const user = await User.findById(decoded.userId).select('tokenVersion');
      
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      if (decoded.tokenVersion !== user.tokenVersion) {
        res.status(401).json({ 
          error: 'Token version mismatch. Please login again.',
          reason: 'User logged out from all devices'
        });
        return;
      }
    }

    // 4. Attach user info to request
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.tokenVersion = decoded.tokenVersion;
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};

export default authMiddleware;