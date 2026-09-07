import React, { useState, useRef } from 'react';
import {
  MessageSquare,
  Lock,
  Mail,
  User,
  AtSign,
  Loader2,
  AlertCircle,
  Camera,
  Trash2,
} from 'lucide-react';
import Avatar from '../common/Avatar';
import ImageCropperModal from '../profile/ImageCropperModal';
import { useAuth } from '../../context/AuthContext';

export const AuthModal = () => {
  const { login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form fields
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    displayName: '',
    usernameOrEmail: '',
  });

  // Profile Picture (DP) states during Signup
  const fileInputRef = useRef(null);
  const [rawImageFile, setRawImageFile] = useState(null);
  const [cropperModalOpen, setCropperModalOpen] = useState(false);
  const [croppedAvatarFile, setCroppedAvatarFile] = useState(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState('');

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRawImageFile(reader.result);
      setCropperModalOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = (croppedFile, previewUrl) => {
    setCroppedAvatarFile(croppedFile);
    setPreviewAvatarUrl(previewUrl);
    setCropperModalOpen(false);
  };

  const handleRemovePhoto = () => {
    setCroppedAvatarFile(null);
    setPreviewAvatarUrl('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await login(formData.usernameOrEmail, formData.password);
      } else {
        // If avatar was cropped, send FormData with 'profilePic'
        if (croppedAvatarFile) {
          const form = new FormData();
          form.append('username', formData.username);
          form.append('email', formData.email);
          form.append('password', formData.password);
          form.append('displayName', formData.displayName);
          form.append('profilePic', croppedAvatarFile);
          await signup(form);
        } else {
          await signup({
            username: formData.username,
            email: formData.email,
            password: formData.password,
            displayName: formData.displayName,
          });
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl animate-slide-up my-auto">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl shadow-lg shadow-indigo-500/25 mb-2.5">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white font-display">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {isLogin
              ? 'Sign in to access your chats and live calls'
              : 'Set up your profile and connect with contacts'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-xl mb-5 border border-zinc-800/80">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              isLogin
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError('');
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              !isLogin
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isLogin ? (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <AtSign className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  name="usernameOrEmail"
                  value={formData.usernameOrEmail}
                  onChange={handleChange}
                  required
                  placeholder="name@domain.com or username"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
                />
              </div>
            </div>
          ) : (
            <>
              {/* DP / Profile Photo Upload Section */}
              <div className="flex flex-col items-center justify-center pb-2">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <Avatar
                    src={previewAvatarUrl}
                    name={formData.displayName || formData.username || 'User'}
                    size="xl"
                    className="ring-2 ring-indigo-500/50 group-hover:ring-indigo-400 transition-all"
                  />
                  <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all">
                    <Camera className="w-5 h-5 text-white" />
                    <span className="text-[10px] text-zinc-200 font-medium mt-0.5">Edit DP</span>
                  </div>
                  <div className="absolute bottom-0 right-0 p-1 bg-indigo-600 rounded-full text-white ring-2 ring-zinc-900">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    {previewAvatarUrl ? 'Change Profile Photo' : 'Upload Profile Photo (DP)'}
                  </button>
                  {previewAvatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium ml-2"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Display Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Rahul Sharma"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    placeholder="e.g. rahul_sharma"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="rahul@example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm text-zinc-100 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/25 transition-all mt-6 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : isLogin ? (
              'Sign In'
            ) : (
              'Create Account & Set DP'
            )}
          </button>
        </form>
      </div>

      {/* 1:1 Circular Cropper Modal for Sign Up */}
      <ImageCropperModal
        imageSrc={rawImageFile}
        isOpen={cropperModalOpen}
        onClose={() => {
          setCropperModalOpen(false);
          setRawImageFile(null);
        }}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};

export default AuthModal;
