import React, { useState } from 'react';
import { getInitials, getAvatarGradient } from '../../utils/colorGenerator';

/**
 * Modern Avatar Component
 * Displays high-res DP with fallback to initials, loading skeletons,
 * and real-time online/offline status indicators.
 */
export const Avatar = ({
  src = '',
  name = '',
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  isOnline = false,
  showStatus = false,
  onClick = null,
  className = '',
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Size mapping
  const sizeClasses = {
    xs: 'w-7 h-7 text-xs',
    sm: 'w-9 h-9 text-sm',
    md: 'w-11 h-11 text-base',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl',
    '2xl': 'w-28 h-28 text-4xl',
  };

  const badgeSizeClasses = {
    xs: 'w-2 h-2 ring-1',
    sm: 'w-2.5 h-2.5 ring-2',
    md: 'w-3 h-3 ring-2',
    lg: 'w-3.5 h-3.5 ring-2',
    xl: 'w-4 h-4 ring-2',
    '2xl': 'w-5 h-5 ring-4',
  };

  const currentSizeClass = sizeClasses[size] || sizeClasses.md;
  const currentBadgeSizeClass = badgeSizeClasses[size] || badgeSizeClasses.md;
  const gradient = getAvatarGradient(name);
  const initials = getInitials(name);

  const hasValidImage = src && !imageError;

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex flex-shrink-0 items-center justify-center rounded-full select-none ${
        onClick ? 'cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95' : ''
      } ${className}`}
    >
      {/* Outer Glow / Ring Container */}
      <div
        className={`relative overflow-hidden rounded-full shadow-md ${currentSizeClass} ${
          hasValidImage ? 'bg-zinc-800' : `bg-gradient-to-tr ${gradient.bg}`
        }`}
      >
        {hasValidImage ? (
          <>
            {/* Loading Skeleton */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
            )}
            <img
              src={src}
              alt={name || 'Avatar'}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className={`w-full h-full object-cover rounded-full transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          <span className={`font-semibold tracking-wider ${gradient.text}`}>
            {initials}
          </span>
        )}
      </div>

      {/* Real-time Online / Offline Indicator Badge */}
      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-zinc-950 transition-colors duration-300 ${currentBadgeSizeClass} ${
            isOnline ? 'bg-emerald-500' : 'bg-zinc-500'
          }`}
        >
          {isOnline && (
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          )}
        </span>
      )}
    </div>
  );
};

export default Avatar;
