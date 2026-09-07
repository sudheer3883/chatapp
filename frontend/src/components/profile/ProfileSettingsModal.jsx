import React, { useState, useRef } from 'react';
import {
  Camera,
  Trash2,
  Eye,
  Check,
  X,
  Loader2,
  User,
  Info,
  AtSign,
  AlertCircle,
} from 'lucide-react';
import Avatar from '../common/Avatar';
import ImageCropperModal from './ImageCropperModal';
import FullscreenImageViewer from './FullscreenImageViewer';

/**
 * Profile Settings & DP Management Modal
 * Handles live preview, 1:1 cropping, instant optimistic updates,
 * fallback initial avatars, fullscreen viewing, and status/bio updates.
 */
export const ProfileSettingsModal = ({
  user,
  isOpen,
  onClose,
  onUpdateUser,
  socket,
}) => {
  const fileInputRef = useRef(null);

  // Form states
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');

  // Image cropping and preview states
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [cropperModalOpen, setCropperModalOpen] = useState(false);
  const [fullscreenViewerOpen, setFullscreenViewerOpen] = useState(false);

  // Status and feedback
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Handle local file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    // Validate size (e.g., max 10MB raw before crop)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 10MB limit.');
      return;
    }

    setErrorMsg('');
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageFile(reader.result);
      setCropperModalOpen(true);
    };
    reader.readAsDataURL(file);

    // Reset input so re-selecting same file triggers onChange
    e.target.value = '';
  };

  // Upload cropped image to backend
  const handleCroppedImageUpload = async (croppedBlobFile, localPreviewUrl) => {
    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    // 1. Optimistic UI update
    const previousPic = user.profilePic;
    if (onUpdateUser) {
      onUpdateUser({
        ...user,
        profilePic: {
          ...user.profilePic,
          url: localPreviewUrl,
          thumbnailUrl: localPreviewUrl,
        },
      });
    }

    try {
      const formData = new FormData();
      formData.append('profilePic', croppedBlobFile);

      const response = await fetch('/api/users/update-profile-pic', {
        method: 'PATCH',
        body: formData,
        credentials: 'include', // sends HTTP-only cookie
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update profile picture.');
      }

      // 2. Commit updated server profile
      const updatedUser = {
        ...user,
        profilePic: data.data.user.profilePic,
      };

      if (onUpdateUser) onUpdateUser(updatedUser);
      setSuccessMsg('Profile picture updated successfully!');

      // 3. Broadcast update to active contacts via Socket.io
      if (socket) {
        socket.emit('user:broadcast_dp_update', {
          profilePic: data.data.user.profilePic,
        });
      }
    } catch (err) {
      console.error('[ProfileSettings] DP upload failed:', err);
      setErrorMsg(err.message || 'Error updating avatar.');

      // Rollback optimistic update
      if (onUpdateUser) {
        onUpdateUser({ ...user, profilePic: previousPic });
      }
    } finally {
      setIsUploading(false);
      setSelectedImageFile(null);
    }
  };

  // Remove DP (revert to initials avatar)
  const handleRemoveProfilePic = async () => {
    if (!window.confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }

    setIsUploading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const previousPic = user.profilePic;

    // Optimistic reset
    if (onUpdateUser) {
      onUpdateUser({
        ...user,
        profilePic: {
          url: '',
          publicId: '',
          thumbnailUrl: '',
          fallbackColor: user.profilePic?.fallbackColor || '#6366F1',
        },
      });
    }

    try {
      const response = await fetch('/api/users/remove-profile-pic', {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to remove profile picture.');
      }

      const updatedUser = {
        ...user,
        profilePic: data.data.user.profilePic,
      };

      if (onUpdateUser) onUpdateUser(updatedUser);
      setSuccessMsg('Profile picture removed.');

      // Socket.io broadcast
      if (socket) {
        socket.emit('user:broadcast_dp_update', {
          profilePic: data.data.user.profilePic,
        });
      }
    } catch (err) {
      console.error('[ProfileSettings] DP removal failed:', err);
      setErrorMsg(err.message || 'Error removing avatar.');
      // Rollback
      if (onUpdateUser) {
        onUpdateUser({ ...user, profilePic: previousPic });
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Save Name & Status
  const handleSaveProfileInfo = async (e) => {
    e.preventDefault();
    setIsSavingInfo(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName, bio }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save profile information.');
      }

      if (onUpdateUser) {
        onUpdateUser({
          ...user,
          displayName: data.data.user.displayName,
          bio: data.data.user.bio,
        });
      }
      setSuccessMsg('Profile details saved!');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile.');
    } finally {
      setIsSavingInfo(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div className="relative w-full max-w-md overflow-hidden bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
            <h2 className="text-lg font-semibold text-zinc-100">Profile Settings</h2>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-xl hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
            {/* Feedback Alerts */}
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-2 p-3 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Profile Picture Hero Section */}
            <div className="flex flex-col items-center justify-center pt-2">
              <div className="relative group">
                <Avatar
                  src={user?.profilePic?.url}
                  name={user?.displayName || user?.username}
                  size="2xl"
                  isOnline={user?.isOnline}
                  showStatus={true}
                  className="ring-4 ring-zinc-800 ring-offset-4 ring-offset-zinc-900"
                />

                {/* Hover Camera Overlay to Change Photo */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer backdrop-blur-[2px]"
                >
                  <Camera className="w-8 h-8 text-white mb-1 drop-shadow" />
                  <span className="text-xs font-medium text-zinc-200">Change Photo</span>
                </button>

                {/* Loading spinner overlay */}
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/70 backdrop-blur-sm">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  </div>
                )}
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Avatar Action Toolbar */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-xl border border-zinc-700/60 transition-all shadow-sm"
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  Upload Photo
                </button>

                {user?.profilePic?.url && (
                  <>
                    <button
                      type="button"
                      onClick={() => setFullscreenViewerOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700/60 rounded-xl border border-zinc-700/60 transition-all"
                      title="View Fullscreen"
                    >
                      <Eye className="w-3.5 h-3.5 text-zinc-400" />
                      Preview
                    </button>

                    <button
                      type="button"
                      onClick={handleRemoveProfilePic}
                      disabled={isUploading}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all"
                      title="Remove Profile Picture"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Profile Info Form */}
            <form onSubmit={handleSaveProfileInfo} className="space-y-4 pt-2 border-t border-zinc-800">
              {/* Username (Read-only) */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1.5">
                  <AtSign className="w-3.5 h-3.5 text-zinc-500" />
                  Username
                </label>
                <div className="px-3.5 py-2 text-sm text-zinc-400 bg-zinc-950/60 border border-zinc-800/80 rounded-xl select-none">
                  @{user?.username}
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 mb-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                  required
                  placeholder="Enter your name"
                  className="w-full px-3.5 py-2 text-sm text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
                />
              </div>

              {/* Status / Bio */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                    <Info className="w-3.5 h-3.5 text-zinc-500" />
                    About / Bio
                  </label>
                  <span className="text-[11px] text-zinc-500">{bio.length}/160</span>
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={160}
                  rows={3}
                  placeholder="Tell contacts a little about yourself"
                  className="w-full px-3.5 py-2 text-sm text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none placeholder-zinc-600"
                />
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingInfo}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {isSavingInfo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving changes...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Details
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Embedded 1:1 Image Cropper Modal */}
      <ImageCropperModal
        imageSrc={selectedImageFile}
        isOpen={cropperModalOpen}
        onClose={() => {
          setCropperModalOpen(false);
          setSelectedImageFile(null);
        }}
        onCropComplete={handleCroppedImageUpload}
      />

      {/* Fullscreen High-Resolution Image Viewer */}
      <FullscreenImageViewer
        imageUrl={user?.profilePic?.url}
        title={user?.displayName || user?.username}
        subtitle={user?.username}
        isOpen={fullscreenViewerOpen}
        onClose={() => setFullscreenViewerOpen(false)}
      />
    </>
  );
};

export default ProfileSettingsModal;
