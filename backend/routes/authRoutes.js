const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadProfilePic } = require('../middleware/multer');
const {
  signup,
  login,
  logout,
  getMe,
  searchUsers,
} = require('../controllers/authController');

router.post('/signup', uploadProfilePic, signup);
router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.get('/users', protect, searchUsers);

module.exports = router;
