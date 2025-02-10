const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  firstName: { type: String, required: [true, 'First name is required'], trim: true },
  lastName: { type: String, required: [true, 'Last name is required'], trim: true },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    // select: false,
    minlength: [8, 'Password must be at least 8 characters']
  },
}, {
  timestamps: true // This will add createdAt and updatedAt fields automatically
});

// Hash password before saving the user
// UserSchema.pre('save', async function (next) {
//   if (!this.isModified('password')) return next();
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

UserSchema.methods.comparePassword = async function (candidatePassword) {
  try {

    if (!this.password) throw new Error('Password is not defined in the user object.');

    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    return isMatch;
  } catch (error) {
    console.error('Error in comparePassword:', error.message);
    throw new Error('Error comparing passwords');
  }
};

module.exports = mongoose.model('User', UserSchema);
