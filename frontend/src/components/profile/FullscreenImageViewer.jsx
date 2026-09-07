import React, { useEffect } from 'react';
import { X, Download } from 'lucide-react';

/**
 * FullscreenImageViewer Modal
 * Displays high-resolution DP preview with download capability and keyboard shortcuts.
 */
export const FullscreenImageViewer = ({
  imageUrl,
  title = '',
  subtitle = '',
  isOpen,
  onClose,
}) => {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fade-in"
      onClick={onClose}
    >
      {/* Action Header */}
      <div
        className="absolute top-0 inset-x-0 flex items-center justify-between p-6 z-10 bg-gradient-to-b from-black/80 to-transparent"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white">
          <h4 className="font-semibold text-base">{title}</h4>
          {subtitle && <p className="text-xs text-zinc-400">@{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          <a
            href={imageUrl}
            download={`dp-${subtitle || 'user'}.webp`}
            target="_blank"
            rel="noreferrer"
            className="p-2 text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 rounded-full transition-colors"
            title="Download full image"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 rounded-full transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main High-Res Image Viewport */}
      <div
        className="relative max-w-2xl max-h-[85vh] p-2 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={title || 'Profile Picture'}
          className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl object-contain ring-1 ring-white/10"
        />
      </div>
    </div>
  );
};

export default FullscreenImageViewer;
