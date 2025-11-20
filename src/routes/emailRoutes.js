const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', emailController.getEmails);
router.get('/:id', emailController.getEmailById);
router.post('/sync', emailController.triggerSync);

module.exports = router;
