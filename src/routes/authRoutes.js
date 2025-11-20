const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/google', authController.getGoogleAuthUrl);
router.get('/google/callback', authController.googleCallback);
router.get('/me', authMiddleware, authController.getCurrentUser);

router.post('/logout', authMiddleware, authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);

module.exports = router;