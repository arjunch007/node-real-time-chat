const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById } = require('../controllers/userController');
const auth = require('../middleware/auth');

router.get('/', auth, getAllUsers);
router.get('/:id', auth, getUserById);

module.exports = router;