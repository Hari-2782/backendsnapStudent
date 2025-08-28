const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload image to Cloudinary
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Upload result
 */
const uploadImage = async (imageBuffer, options = {}) => {
  try {
    const {
      folder = 'ai-study-helper',
      publicId = `img_${uuidv4()}_${Date.now()}`,
      tags = [],
      transformation = []
    } = options;

    // Create upload stream
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          public_id: publicId,
          folder,
          tags,
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
            ...transformation
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      // Pipe the buffer to the upload stream
      uploadStream.end(imageBuffer);
    });

    return {
      success: true,
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      size: uploadResult.bytes,
      uploadedAt: new Date()
    };
  } catch (error) {
    console.error('Image upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Create and upload cropped image region
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {Object} bbox - Bounding box {x, y, width, height}
 * @param {Object} options - Crop options
 * @returns {Promise<Object>} Upload result
 */
const createCroppedImage = async (imageBuffer, bbox, options = {}) => {
  try {
    const {
      padding = 10,
      folder = 'ai-study-helper/crops',
      tags = ['crop', 'evidence']
    } = options;

    // Calculate crop dimensions with padding
    const { x, y, width, height } = bbox;
    const paddedX = Math.max(0, x - padding);
    const paddedY = Math.max(0, y - padding);
    const paddedWidth = Math.min(imageBuffer.width || 2048, width + 2 * padding);
    const paddedHeight = Math.min(imageBuffer.height || 2048, height + 2 * padding);

    // Create cropped image
    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: paddedX,
        top: paddedY,
        width: paddedWidth,
        height: paddedHeight
      })
      .png({ quality: 90 })
      .toBuffer();

    // Upload cropped image
    const publicId = `crop_${uuidv4()}_${Date.now()}`;
    const uploadResult = await uploadImage(croppedBuffer, {
      folder,
      publicId,
      tags: [...tags, 'cropped'],
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'png' }
      ]
    });

    if (uploadResult.success) {
      return {
        ...uploadResult,
        bbox: { x, y, width, height },
        paddedBbox: { x: paddedX, y: paddedY, width: paddedWidth, height: paddedHeight }
      };
    }

    return uploadResult;
  } catch (error) {
    console.error('Create cropped image error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get image information from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Image information
 */
const getImageInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId);
    
    return {
      success: true,
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      size: result.bytes,
      uploadedAt: result.created_at,
      tags: result.tags || []
    };
  } catch (error) {
    console.error('Get image info error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Deletion result
 */
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      return {
        success: true,
        message: 'Image deleted successfully',
        publicId
      };
    } else {
      return {
        success: false,
        error: 'Failed to delete image'
      };
    }
  } catch (error) {
    console.error('Delete image error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generate signed URL for private images
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - URL options
 * @returns {Promise<string>} Signed URL
 */
const generateSignedUrl = async (publicId, options = {}) => {
  try {
    const {
      expiresAt = Math.round(Date.now() / 1000) + 3600, // 1 hour
      transformation = []
    } = options;

    const url = cloudinary.url(publicId, {
      sign_url: true,
      type: 'upload',
      expires_at: expiresAt,
      transformation
    });

    return url;
  } catch (error) {
    console.error('Generate signed URL error:', error);
    throw error;
  }
};

/**
 * Optimize image for web delivery
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} options - Optimization options
 * @returns {Promise<Buffer>} Optimized image buffer
 */
const optimizeImage = async (imageBuffer, options = {}) => {
  try {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 85,
      format = 'webp'
    } = options;

    let sharpInstance = sharp(imageBuffer);

    // Resize if needed
    if (maxWidth || maxHeight) {
      sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to specified format
    switch (format) {
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality });
        break;
      default:
        sharpInstance = sharpInstance.webp({ quality });
    }

    return await sharpInstance.toBuffer();
  } catch (error) {
    console.error('Image optimization error:', error);
    return imageBuffer; // Return original if optimization fails
  }
};

/**
 * Create image thumbnail
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} options - Thumbnail options
 * @returns {Promise<Buffer>} Thumbnail buffer
 */
const createThumbnail = async (imageBuffer, options = {}) => {
  try {
    const {
      width = 300,
      height = 300,
      quality = 80,
      format = 'webp'
    } = options;

    let sharpInstance = sharp(imageBuffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      });

    // Convert to specified format
    switch (format) {
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality });
        break;
      default:
        sharpInstance = sharpInstance.webp({ quality });
    }

    return await sharpInstance.toBuffer();
  } catch (error) {
    console.error('Create thumbnail error:', error);
    throw error;
  }
};

/**
 * Get Cloudinary usage statistics
 * @returns {Promise<Object>} Usage statistics
 */
const getUsageStats = async () => {
  try {
    const result = await cloudinary.api.usage();
    
    return {
      success: true,
      plan: result.plan,
      credits: {
        used: result.credits.used,
        limit: result.credits.limit,
        remaining: result.credits.limit - result.credits.used
      },
      objects: {
        used: result.objects.used,
        limit: result.objects.limit,
        remaining: result.objects.limit - result.objects.used
      },
      bandwidth: {
        used: result.bandwidth.used,
        limit: result.bandwidth.limit,
        remaining: result.bandwidth.limit - result.bandwidth.used
      }
    };
  } catch (error) {
    console.error('Get usage stats error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  uploadImage,
  createCroppedImage,
  getImageInfo,
  deleteImage,
  generateSignedUrl,
  optimizeImage,
  createThumbnail,
  getUsageStats
};
