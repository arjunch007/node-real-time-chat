const express = require('express');
const router = express.Router();
const { getMessages, createMessage, getChatUserList, updateMessagesReadStatus, loadMoreMessages, loadMoreOldMessages, getUnreadCountMessage } = require('../controllers/chatController');
const auth = require('../middleware/auth');
const { upload, imageUpload } = require('../middleware/upload');

router.get('/chat-users', auth, getChatUserList);

router.get('/:userId', auth, getMessages);

router.get('/load-more/:userId', auth, loadMoreMessages);
router.get('/load-more-old/:userId', auth, loadMoreOldMessages);
router.put('/:userId/read', auth, updateMessagesReadStatus);
router.get('/unread-count/:userId', auth, getUnreadCountMessage);

// router.post('', auth, upload.single('file'), createMessage); // Add upload middleware here

// Change from upload.single() to upload.array()
// router.post('', auth, upload.array('files', 3), createMessage); // 'files' is the field name, 5 is max number of files

router.post('', auth, (req, res, next) => {
    upload.array('files', 3)(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ status: false, message: 'File size too large. Max 10MB allowed.' });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({ status: false, message: 'Too many files. Max 3 allowed.' });
            }
            return res.status(400).json({ status: false, message: err.message });
        }
        createMessage(req, res);
    });
});



module.exports = router;