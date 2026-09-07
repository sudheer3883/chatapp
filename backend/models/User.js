const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema
 * Manages user credentials, profile information, avatar (DP) metadata,
 * and real-time connectivity status.
 */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Prevents leaking password hashes in standard queries
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: [50, 'Display name cannot exceed 50 characters'],
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [160, 'Bio cannot exceed 160 characters'],
      default: 'Hey there! I am using ChatApp.',
    },
    profilePic: {
      url: {
        type: String,
        default: '',
      },
      publicId: {
        type: String,
        default: '', // Cloudinary public_id used for fast deletion/invalidation
      },
      thumbnailUrl: {
        type: String,
        default: '', // Cloudinary transformed thumbnail URL (e.g. w_150,h_150,c_fill,g_face)
      },
      fallbackColor: {
        type: String,
        default: '#6366F1', // Deterministic gradient/solid color for avatar initials
      },
    },
    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound text index for global search
userSchema.index({ displayName: 'text', username: 'text', email: 'text' });

/**
 * Pre-save middleware: Hashes the password if modified
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Pre-save middleware: Automatically generate fallback avatar color based on username
 */
userSchema.pre('save', function (next) {
  if (this.isModified('username') && !this.profilePic.fallbackColor) {
    const palette = [
      '#6366F1', '#EC4899', '#8B5CF6', '#10B981',
      '#F59E0B', '#3B82F6', '#14B8A6', '#F43F5E',
    ];
    let hash = 0;
    for (let i = 0; i < this.username.length; i++) {
      hash = this.username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % palette.length;
    this.profilePic.fallbackColor = palette[index];
  }
  next();
});

/**
 * Instance method to compare password during authentication
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
module.exports = User;
