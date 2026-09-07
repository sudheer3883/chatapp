const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadProfilePic } = require('../middleware/multer');
const {
  updateProfilePic,
  removeProfilePic,
  updateProfile,
} = require('../controllers/userController');

// All profile management routes require authentication
router.use(protect);

/**
 * @route   PATCH /api/users/update-profile-pic
 * @desc    Upload cropped avatar image, stream to Cloudinary, broadcast via Socket.io
 */
router.patch('/update-profile-pic', uploadProfilePic, updateProfilePic);

/**
 * @route   DELETE /api/users/remove-profile-pic
 * @desc    Remove avatar, delete from Cloudinary, revert to initials fallback
 */
router.delete('/remove-profile-pic', removeProfilePic);

/**
 * @route   PATCH /api/users/profile
 * @desc    Update displayName and status/bio
 */
router.patch('/profile', updateProfile);

module.exports = router;
