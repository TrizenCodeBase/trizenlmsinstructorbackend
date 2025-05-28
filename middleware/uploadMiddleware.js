import multer from 'multer';

const storage = multer.memoryStorage();

// File filter to allow only images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an image! Please upload an image file.'), false);
    }
};

// Configure multer for profile picture uploads
export const uploadProfilePicture = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
    }
}).single('profilePicture');

// Error handling middleware for multer
export const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                message: 'File size is too large. Maximum size is 5MB'
            });
        }
        return res.status(400).json({
            message: err.message
        });
    }
    next(err);
}; 