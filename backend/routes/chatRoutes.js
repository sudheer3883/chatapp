const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadChatMedia: uploadMiddleware } = require('../middleware/multer');
const {
  getConversations,
  getOrCreateDirectConversation,
  getMessages,
  sendMessage,
  uploadChatMedia,
  markConversationAsRead,
} = require('../controllers/chatController');

router.use(protect);

router.get('/', getConversations);
router.post('/conversation', getOrCreateDirectConversation);
router.get('/:conversationId/messages', getMessages);
router.post('/send', sendMessage);
router.post('/upload-media', uploadMiddleware, uploadChatMedia);
router.patch('/:conversationId/read', markConversationAsRead);

module.exports = router;
