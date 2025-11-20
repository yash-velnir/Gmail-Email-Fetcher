const jwt = require('jsonwebtoken');
const User = require('../models/User');
const BlacklistedToken = require('../models/BlacklistedToken');

module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // 1. Verify JWT signature and expiration
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 2. Check if token is blacklisted
    const blacklisted = await BlacklistedToken.findOne({ token });
    if (blacklisted) {
      return res.status(401).json({ 
        error: 'Token has been revoked',
        reason: blacklisted.reason 
      });
    }

    // 3. Check token version (for logout from all devices)
    if (decoded.tokenVersion !== undefined) {
      const user = await User.findById(decoded.userId).select('tokenVersion');
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (decoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({ 
          error: 'Token version mismatch. Please login again.',
          reason: 'User logged out from all devices'
        });
      }
    }

    // 4. Attach user info to request
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.tokenVersion = decoded.tokenVersion;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};