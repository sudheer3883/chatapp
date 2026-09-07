/**
 * Utility to generate a cropped Blob/File from an image source and pixel crop coordinates
 * Compatible with react-easy-crop output.
 */

export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // Avoid CORS issues
    image.src = url;
  });

/**
 * Extracts the cropped area of an image using an HTML5 Canvas.
 * Returns a Blob ready to be appended to FormData for Multer upload.
 *
 * @param {string} imageSrc - Object URL or base64 data URL
 * @param {Object} pixelCrop - { x, y, width, height }
 * @param {number} rotation - Image rotation in degrees (optional)
 * @param {string} outputType - 'image/webp' or 'image/jpeg'
 * @param {number} quality - Compression quality 0.0 - 1.0
 * @returns {Promise<Blob>}
 */
export async function getCroppedImg(
  imageSrc,
  pixelCrop,
  rotation = 0,
  outputType = 'image/webp',
  quality = 0.92
) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context could not be created');
  }

  // Set canvas size to the cropped area dimensions
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Render cropped region
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty or crop failed'));
          return;
        }
        resolve(blob);
      },
      outputType,
      quality
    );
  });
}
