import express from 'express';
import * as emailController from '../controllers/emailController';
import authMiddleware from '../middleware/authMiddleware';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

router.get('/', emailController.getEmails);
router.get('/:id', emailController.getEmailById);
router.post('/sync', emailController.triggerSync);

export default router;