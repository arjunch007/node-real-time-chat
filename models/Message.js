const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    from_user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    to_user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Recipient user ID is required.']
    },
    content: {
        type: String,
        required: [true, 'Please enter your message.']
    },
    is_read: {
        type: Boolean,
        default: 0
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);