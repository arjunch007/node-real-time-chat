const express = require('express');
const { registerUser, loginUser, authenticate } = require('../controllers/authController');

const router = express.Router();

// Route to register a new user
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected Route with authentication middleware
router.get('/protected', authenticate, (req, res) => {
    res.json({ message: 'Protected data', user: req.user });
});

module.exports = router;