import express from 'express';
import * as authController from '../controllers/authController';
import authMiddleware from '../middleware/authMiddleware';

const router = express.Router();

router.get('/google', authController.getGoogleAuthUrl);
router.get('/google/callback', authController.googleCallback);
router.get('/me', authMiddleware, authController.getCurrentUser);

router.post('/logout', authMiddleware, authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);

export default router;