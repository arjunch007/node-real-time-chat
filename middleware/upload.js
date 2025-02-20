const multer = require('multer');

// Set up storage engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'storage/uploads/chat/');
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now().toString()}-${file.originalname}`);
    }
});

// Common upload configuration
const createUpload = (isImageOnly = false) => {
    return multer({
        storage: storage,
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB
            files: 3 // Maximum number of files allowed
        },
        fileFilter: (req, file, cb) => {
            if (isImageOnly && !file.mimetype.startsWith('image/')) {
                cb(new Error('Only image files are allowed!'), false);
            } else {
                cb(null, true);
            }
        }
    });
};

// Export both upload options
module.exports = {
    upload: createUpload(false), // For all file types
    imageUpload: createUpload(true) // For images only
};