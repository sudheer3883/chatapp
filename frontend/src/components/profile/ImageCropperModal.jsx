import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { ZoomIn, ZoomOut, RotateCw, X, Check, Loader2 } from 'lucide-react';
import { getCroppedImg } from '../../utils/cropImage';

/**
 * Image Cropper Modal
 * Provides 1:1 circular crop, live preview, zoom slider, rotation, and high-DPI export.
 */
export const ImageCropperModal = ({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = (newCrop) => setCrop(newCrop);
  const onZoomChange = (newZoom) => setZoom(newZoom);

  const handleCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    try {
      setIsProcessing(true);
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
        'image/webp',
        0.95
      );
      // Create a File from Blob with a consistent name
      const croppedFile = new File([croppedBlob], 'avatar.webp', {
        type: 'image/webp',
      });
      await onCropComplete(croppedFile, URL.createObjectURL(croppedBlob));
      onClose();
    } catch (error) {
      console.error('[Cropper] Error cropping image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Edit Profile Picture</h3>
            <p className="text-xs text-zinc-400">Drag to adjust, scroll or use slider to zoom</p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors rounded-lg hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Crop Viewport Area */}
        <div className="relative w-full h-80 bg-zinc-950 select-none">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={onCropChange}
            onCropComplete={handleCropComplete}
            onZoomChange={onZoomChange}
          />
        </div>

        {/* Controls Section */}
        <div className="p-6 space-y-4 bg-zinc-900">
          {/* Zoom Slider */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setZoom((prev) => Math.max(1, prev - 0.2))}
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.05}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
            />
            <button
              onClick={() => setZoom((prev) => Math.min(3, prev + 0.2))}
              className="text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ZoomIn className="w-5 h-5" />
            </button>

            {/* Rotate Button */}
            <button
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              title="Rotate 90 degrees"
              className="p-2 ml-2 text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <RotateCw className="w-5 h-5" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Apply & Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropperModal;
