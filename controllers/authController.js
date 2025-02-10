const Joi = require('joi');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Register User
const registerUser = async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  try {
    // Create new user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists', status: false });
    }

    const newUser = new User({ firstName, lastName, email, password: hashedPassword });
    await newUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Respond with success and token
    res.status(200).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
      },
      status: true
    });

  } catch (error) {
    res.status(400).json({ message: error.message, status: false });
  }
};

const loginUser = async (req, res) => {
  const { email, password, rememberMe } = req.body;

  try {
    const { error } = loginSchema.validate({ email, password });

    if (error) {
      return res.status(400).json({ message: error.details[0].message, status: false });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found', status: false });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials', status: false });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: rememberMe ? '30d' : '1h' }
    );

    // Set token in cookies with appropriate expiration
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Ensure cookies are sent over HTTPS in production
      maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000, // 30 days or 1 hour
    };

    res.cookie('token', token, cookieOptions);

    // Respond with success and token
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      status: true
    });
  } catch (error) {
    console.log({ error });

    res.status(400).json({ message: error.message, status: false });
  }
};

// Middleware to protect routes by verifying JWT token in cookies
const authenticate = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(403).json({ message: 'No token found', status: false });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token', status: false });
  }
};

module.exports = { registerUser, loginUser, authenticate };