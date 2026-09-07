const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { uploadProfilePicStream, deleteCloudinaryAsset } = require('../config/cloudinary');

/**
 * @desc    Update user profile picture (DP)
 * @route   PATCH /api/users/update-profile-pic
 * @access  Private
 */
const updateProfilePic = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided. Please attach an image under key "profilePic".',
      });
    }

    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Capture old publicId to clean up Cloudinary storage after successful upload
    const oldPublicId = user.profilePic?.publicId;

    // Stream upload newly cropped image buffer to Cloudinary (with automatic Base64 fallback)
    let uploadResult;
    try {
      uploadResult = await uploadProfilePicStream(req.file.buffer, 'chatapp/avatars');
    } catch (uploadErr) {
      console.warn('[UserController] Cloudinary upload failed (fallback to Base64 avatar):', uploadErr.message);
      const base64Image = `data:${req.file.mimetype || 'image/webp'};base64,${req.file.buffer.toString('base64')}`;
      uploadResult = {
        url: base64Image,
        publicId: `local_${Date.now()}`,
        thumbnailUrl: base64Image,
      };
    }

    // Update user document
    user.profilePic = {
      url: uploadResult.url,
      publicId: uploadResult.publicId,
      thumbnailUrl: uploadResult.thumbnailUrl,
      fallbackColor: user.profilePic?.fallbackColor || '#6366F1',
    };

    await user.save();

    // Async cleanup: Delete obsolete previous avatar from Cloudinary if it was a real cloud asset
    if (oldPublicId && !oldPublicId.startsWith('local_')) {
      deleteCloudinaryAsset(oldPublicId).catch((err) =>
        console.error(`[Cloudinary Cleanup Error] Failed to delete old asset ${oldPublicId}:`, err)
      );
    }

    // Broadcast DP change in real-time via Socket.io to all contacts & active conversations
    const io = req.app.get('io');
    if (io) {
      const payload = {
        userId: user._id.toString(),
        profilePic: user.profilePic,
        displayName: user.displayName,
      };

      // 1. Notify the user's other sessions/tabs
      io.to(`user:${user._id}`).emit('user:profile_updated', payload);

      // 2. Fetch user's conversation rooms and broadcast the DP change
      const userConversations = await Conversation.find({ participants: userId }).select('_id');
      userConversations.forEach((conv) => {
        io.to(`conversation:${conv._id}`).emit('user:profile_updated', payload);
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile picture updated successfully.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          profilePic: user.profilePic,
          isOnline: user.isOnline,
        },
      },
    });
  } catch (error) {
    console.error('[UserController] Error in updateProfilePic:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while uploading profile picture.',
    });
  }
};

/**
 * @desc    Remove user profile picture (revert to initials avatar)
 * @route   DELETE /api/users/remove-profile-pic
 * @access  Private
 */
const removeProfilePic = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const publicIdToDelete = user.profilePic?.publicId;

    // Reset profile picture fields
    user.profilePic.url = '';
    user.profilePic.publicId = '';
    user.profilePic.thumbnailUrl = '';

    await user.save();

    // Delete asset from Cloudinary
    if (publicIdToDelete) {
      deleteCloudinaryAsset(publicIdToDelete).catch((err) =>
        console.error(`[Cloudinary Cleanup Error] Failed to delete asset ${publicIdToDelete}:`, err)
      );
    }

    // Real-time broadcast of DP removal
    const io = req.app.get('io');
    if (io) {
      const payload = {
        userId: user._id.toString(),
        profilePic: user.profilePic,
        displayName: user.displayName,
      };

      io.to(`user:${user._id}`).emit('user:profile_updated', payload);

      const userConversations = await Conversation.find({ participants: userId }).select('_id');
      userConversations.forEach((conv) => {
        io.to(`conversation:${conv._id}`).emit('user:profile_updated', payload);
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile picture removed successfully.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          profilePic: user.profilePic,
          isOnline: user.isOnline,
        },
      },
    });
  } catch (error) {
    console.error('[UserController] Error in removeProfilePic:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error while removing profile picture.',
    });
  }
};

/**
 * @desc    Update display name and bio/status
 * @route   PATCH /api/users/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { displayName, bio } = req.body;
    const user = await User.findById(req.user._id);

    if (displayName) user.displayName = displayName.trim();
    if (typeof bio === 'string') user.bio = bio.trim();

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: { user },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  updateProfilePic,
  removeProfilePic,
  updateProfile,
};
