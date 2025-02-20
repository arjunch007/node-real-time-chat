const express = require('express');
const router = express.Router();
const { getMessages, createMessage, getChatUserList, updateMessagesReadStatus, loadMoreMessages, loadMoreOldMessages, getUnreadCountMessage } = require('../controllers/chatController');
const auth = require('../middleware/auth');
// const upload = require('../middleware/upload');

router.get('/chat-users', auth, getChatUserList);

router.get('/:userId', auth, getMessages);

router.get('/load-more/:userId', auth, loadMoreMessages);
router.get('/load-more-old/:userId', auth, loadMoreOldMessages);
router.put('/:userId/read', auth, updateMessagesReadStatus);
router.get('/unread-count/:userId', auth, getUnreadCountMessage);

router.post('', auth, createMessage); // Add upload middleware here



module.exports = router;