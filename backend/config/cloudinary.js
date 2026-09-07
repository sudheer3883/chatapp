const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// Configure Cloudinary credentials from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads an in-memory buffer to Cloudinary using an upload stream.
 * Automatically applies face-centered smart crop and format optimizations.
 *
 * @param {Buffer} buffer - File buffer from Multer memoryStorage
 * @param {string} folder - Target Cloudinary folder name (e.g. 'chatapp/avatars')
 * @returns {Promise<Object>} Resolves with { url, secure_url, public_id, thumbnailUrl }
 */
const uploadProfilePicStream = (buffer, folder = 'chatapp/avatars') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        format: 'webp', // Auto-convert to WEBP for optimal compression
        quality: 'auto:good',
        transformation: [
          { width: 500, height: 500, crop: 'fill', gravity: 'face' }, // Standard DP
        ],
      },
      (error, result) => {
        if (error) return reject(error);

        // Generate high-performance 150x150 thumbnail URL via Cloudinary URL transformation
        const thumbnailUrl = cloudinary.url(result.public_id, {
          width: 150,
          height: 150,
          crop: 'fill',
          gravity: 'face',
          quality: 'auto',
          fetch_format: 'auto',
          secure: true,
        });

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          thumbnailUrl,
        });
      }
    );

    // Pipe buffer into the streamifier read stream
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

/**
 * Deletes an image asset from Cloudinary using its public_id.
 * Safe to call even if asset does not exist or publicId is empty.
 *
 * @param {string} publicId - Cloudinary asset public ID
 * @returns {Promise<Object|null>}
 */
const deleteCloudinaryAsset = async (publicId) => {
  if (!publicId) return null;
  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true, // Invalidate CDN cache immediately
    });
  } catch (error) {
    console.error(`[Cloudinary] Failed to delete asset ${publicId}:`, error);
    return null;
  }
};

/**
 * Uploads any media type (image, audio, video, raw document) to Cloudinary
 */
const uploadMediaStream = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'chatapp/media',
        resource_type: options.resource_type || 'auto',
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

module.exports = {
  cloudinary,
  uploadProfilePicStream,
  uploadMediaStream,
  deleteCloudinaryAsset,
};
