const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { uploadProfilePicStream } = require('../config/cloudinary');

/**
 * Generate JWT token and attach it as an HTTP-only cookie
 */
const sendTokenCookie = (user, statusCode, res, message) => {
  const token = jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET || 'supersecretjwtkey',
    { expiresIn: '7d' }
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  res.cookie('token', token, cookieOptions);

  return res.status(statusCode).json({
    success: true,
    message,
    token, // For mobile or environments unable to use cookies
    data: {
      user: {
        _id: user._id.toString(),
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        bio: user.bio,
        profilePic: user.profilePic,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
      },
    },
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/signup
 * @access  Public
 */
const signup = async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password || !displayName) {
      return res.status(400).json({
        success: false,
        message: 'All fields (username, email, password, display name) are required.',
      });
    }

    // Check duplicate username or email
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });

    if (existingUser) {
      const isEmail = existingUser.email === email.toLowerCase();
      return res.status(400).json({
        success: false,
        message: isEmail ? 'Email is already registered.' : 'Username is already taken.',
      });
    }

    // Upload avatar if attached during signup
    let profilePicData = { url: '', publicId: '', thumbnailUrl: '' };
    if (req.file) {
      try {
        const uploadResult = await uploadProfilePicStream(req.file.buffer, 'chatapp/avatars');
        profilePicData = {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          thumbnailUrl: uploadResult.thumbnailUrl,
        };
      } catch (uploadErr) {
        console.warn('[AuthController] Avatar upload during signup failed, proceeding with default avatar:', uploadErr.message);
      }
    }

    // Create user
    const newUser = await User.create({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password,
      displayName: displayName.trim(),
      profilePic: profilePicData,
      isOnline: true,
    });

    return sendTokenCookie(newUser, 201, res, 'Account created successfully.');
  } catch (error) {
    console.error('[AuthController] Error in signup:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error during registration.',
    });
  }
};

/**
 * @desc    Login user & issue cookie
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both username/email and password.',
      });
    }

    const query = usernameOrEmail.includes('@')
      ? { email: usernameOrEmail.toLowerCase().trim() }
      : { username: usernameOrEmail.toLowerCase().trim() };

    const user = await User.findOne(query).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. No user found.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password incorrect.',
      });
    }

    // Mark user online
    user.isOnline = true;
    await user.save();

    return sendTokenCookie(user, 200, res, 'Logged in successfully.');
  } catch (error) {
    console.error('[AuthController] Error in login:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error during login.',
    });
  }
};

/**
 * @desc    Logout user & clear cookie
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    if (req.user?._id) {
      await User.findByIdAndUpdate(req.user._id, {
        isOnline: false,
        lastSeen: new Date(),
      });
    }

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    console.error('[AuthController] Error in logout:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to logout.',
    });
  }
};

/**
 * @desc    Get currently logged in user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Search registered users to start new chat
 * @route   GET /api/auth/users
 * @access  Private
 */
const searchUsers = async (req, res) => {
  try {
    const search = req.query.search || '';
    const query = {
      _id: { $ne: req.user._id },
    };

    if (search.trim()) {
      query.$or = [
        { username: { $regex: search.trim(), $options: 'i' } },
        { displayName: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('username displayName bio profilePic isOnline lastSeen')
      .limit(30);

    return res.status(200).json({
      success: true,
      data: { users },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  signup,
  login,
  logout,
  getMe,
  searchUsers,
};
