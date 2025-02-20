const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    message_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    file_type: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Media', mediaSchema); 