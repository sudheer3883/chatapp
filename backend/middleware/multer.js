const multer = require('multer');

/**
 * In-memory storage for Multer.
 * Buffers files directly in RAM so they can be streamed directly
 * to Cloudinary without creating orphaned temporary files on the host filesystem.
 */
const storage = multer.memoryStorage();

// Allowed MIME types for profile picture updates
const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
];

/**
 * File filter to ensure only valid images are uploaded
 */
const profilePicFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.');
    error.status = 400;
    cb(error, false);
  }
};

/**
 * Multer instance for profile pictures (max 5MB)
 */
const uploadProfilePic = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: profilePicFilter,
});

/**
 * Error handling wrapper middleware for Multer errors
 */
const handleMulterUpload = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'File too large. Maximum allowed size is 5MB.',
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
        });
      } else if (err) {
        return res.status(err.status || 400).json({
          success: false,
          message: err.message || 'File upload failed.',
        });
      }
      next();
    });
  };
};

const uploadChatMedia = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for chat attachments & audio
  },
});

module.exports = {
  uploadProfilePic: handleMulterUpload(uploadProfilePic.single('profilePic')),
  uploadChatMedia: handleMulterUpload(uploadChatMedia.single('file')),
  rawMulter: multer,
};
