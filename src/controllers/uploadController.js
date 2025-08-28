const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const path = require('path');

/**
 * Configure Cloudinary with environment variables
 */
const configureCloudinary = () => {
  // Debug: Log environment variables (without exposing secrets)
  console.log('Cloudinary Config Check:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing',
    api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
    api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing'
  });

  // Check if environment variables are set
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary environment variables are not properly configured');
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  console.log('Cloudinary configured successfully');
};

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * Upload and preprocess image
 * @route POST /api/upload
 * @access Private
 */
const uploadImage = async (req, res) => {
  try {
    // Configure Cloudinary first
    configureCloudinary();

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    const { originalname, buffer, mimetype } = req.file;
    const { sessionId, tags } = req.body;
    const userId = req.user?._id || 'dev-user-123'; // Get userId from authenticated user or use default for development

    // Generate unique filename
    const filename = `${uuidv4()}_${Date.now()}${path.extname(originalname)}`;
    
    // Preprocess image for better OCR
    const processedBuffer = await preprocessImage(buffer);
    
    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        public_id: `${userId}_${filename}`,
        folder: 'ai-study-helper',
        tags: tags ? tags.split(',') : [],
        transformation: [
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return res.status(500).json({
            success: false,
            error: 'Failed to upload image'
          });
        }
        
        // Return success response
        res.status(201).json({
          success: true,
          image: {
            id: `${userId}_${filename}`, // Clean ID without folder path
            cloudinaryId: result.public_id, // Full Cloudinary ID for reference
            url: result.secure_url,
            width: result.width,
            height: result.height,
            format: result.format,
            size: result.bytes,
            uploadedAt: new Date(),
            userId: userId.toString(),
            sessionId: sessionId || null,
            tags: tags ? tags.split(',') : []
          }
        });
      }
    );

    // Pipe the processed buffer to Cloudinary
    uploadResult.end(processedBuffer);

  } catch (error) {
    console.error('Upload error:', error);
    
    // Provide more specific error messages
    if (error.message.includes('Cloudinary environment variables')) {
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Cloudinary not configured'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process image upload',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Preprocess image for better OCR results
 */
const preprocessImage = async (buffer) => {
  try {
    // Use sharp for image preprocessing
    const processed = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF
      .resize(2048, 2048, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .sharpen() // Enhance edges
      .normalize() // Normalize contrast
      .grayscale() // Convert to grayscale for better OCR
      .png({ quality: 90 })
      .toBuffer();
    
    return processed;
  } catch (error) {
    console.error('Image preprocessing error:', error);
    // Return original buffer if preprocessing fails
    return buffer;
  }
};

/**
 * Get image by ID
 * @route GET /api/upload/:imageId
 * @access Private
 */
const getImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    
    // Construct the full Cloudinary ID with folder
    const fullImageId = `ai-study-helper/${imageId}`;
    
    // Get image info from Cloudinary
    const result = await cloudinary.api.resource(fullImageId);
    
    res.status(200).json({
      success: true,
      image: {
        id: imageId, // Return the clean ID
        cloudinaryId: result.public_id, // Full Cloudinary ID
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
        uploadedAt: result.created_at,
        tags: result.tags || []
      }
    });
  } catch (error) {
    console.error('Get image error:', error);
    res.status(404).json({
      success: false,
      error: 'Image not found'
    });
  }
};

/**
 * Delete image
 * @route DELETE /api/upload/:imageId
 * @access Private
 */
const deleteImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    
    // Construct the full Cloudinary ID with folder
    const fullImageId = `ai-study-helper/${imageId}`;
    
    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(fullImageId);
    
    if (result.result === 'ok') {
      res.status(200).json({
        success: true,
        message: 'Image deleted successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete image'
      });
    }
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete image'
    });
  }
};

module.exports = {
  uploadImage,
  getImage,
  deleteImage,
  upload
};
