const multer = require('multer');
const { cloudinary } = require('../services/cloudinaryService');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const path = require('path');

console.log('🚀 Upload Controller: Using centralized Cloudinary service');

// Cloudinary is now configured centrally via cloudinaryService

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check file type - allow images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only image files and PDF documents are allowed'), false);
    }
  }
});

// Create a flexible upload middleware that accepts both 'file' and 'image' field names
const flexibleUpload = (req, res, next) => {
  // First try with 'file' field
  const fileUpload = upload.single('file');
  
  fileUpload(req, res, (err) => {
    if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
      // If 'file' field not found, try with 'image' field
      const imageUpload = upload.single('image');
      imageUpload(req, res, next);
    } else if (err) {
      next(err);
    } else {
      next();
    }
  });
};

/**
 * Upload and preprocess image or PDF
 * @route POST /api/upload
 * @access Private
 */
const uploadImage = async (req, res) => {
  try {
    // Cloudinary is already configured via cloudinaryService

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const { originalname, buffer, mimetype } = req.file;
    const { sessionId, tags } = req.body;
    const userId = req.user?._id || 'dev-user-123'; // Get userId from authenticated user or use default for development

    // Generate unique filename
    const filename = `${uuidv4()}_${Date.now()}${path.extname(originalname)}`;
    
    let processedBuffer;
    let resourceType = 'image';
    let uploadOptions = {
      resource_type: 'image',
      public_id: `${userId}_${filename}`,
      folder: 'ai-study-helper',
      tags: tags ? tags.split(',') : [],
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    };

    // Handle different file types
    if (mimetype.startsWith('image/')) {
      // Preprocess image for better OCR
      processedBuffer = await preprocessImage(buffer);
    } else if (mimetype === 'application/pdf') {
      // For PDFs, we'll upload as raw file
      resourceType = 'raw';
      uploadOptions = {
        resource_type: 'raw',
        public_id: `${userId}_${filename}`,
        folder: 'ai-study-helper',
        tags: tags ? tags.split(',') : [],
        format: 'pdf'
      };
      processedBuffer = buffer; // Use original buffer for PDFs
    }
    
    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return res.status(500).json({
            success: false,
            error: 'Failed to upload file'
          });
        }
        
        // Return success response
        const responseData = {
          id: `${userId}_${filename}`, // Clean ID without folder path
          cloudinaryId: result.public_id, // Full Cloudinary ID for reference
          url: result.secure_url,
          size: result.bytes,
          uploadedAt: new Date(),
          userId: userId.toString(),
          sessionId: sessionId || null,
          tags: tags ? tags.split(',') : [],
          fileType: mimetype.startsWith('image/') ? 'image' : 'pdf',
          originalName: originalname
        };

        // Add image-specific properties if it's an image
        if (mimetype.startsWith('image/')) {
          responseData.width = result.width;
          responseData.height = result.height;
          responseData.format = result.format;
        }

        res.status(201).json({
          success: true,
          file: responseData
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
 * Get file by ID
 * @route GET /api/upload/:imageId
 * @access Private
 */
const getImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    
    // Construct the full Cloudinary ID with folder
    const fullImageId = `ai-study-helper/${imageId}`;
    
    // Try to get file info from Cloudinary (try both image and raw)
    let result;
    let resourceType = 'image';
    
    try {
      result = await cloudinary.api.resource(fullImageId, { resource_type: 'image' });
    } catch (imageError) {
      try {
        result = await cloudinary.api.resource(fullImageId, { resource_type: 'raw' });
        resourceType = 'raw';
      } catch (rawError) {
        throw new Error('File not found');
      }
    }
    
    const responseData = {
      id: imageId, // Return the clean ID
      cloudinaryId: result.public_id, // Full Cloudinary ID
      url: result.secure_url,
      size: result.bytes,
      uploadedAt: result.created_at,
      tags: result.tags || [],
      fileType: resourceType === 'raw' ? 'pdf' : 'image'
    };

    // Add image-specific properties if it's an image
    if (resourceType === 'image') {
      responseData.width = result.width;
      responseData.height = result.height;
      responseData.format = result.format;
    }
    
    res.status(200).json({
      success: true,
      file: responseData
    });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(404).json({
      success: false,
      error: 'File not found'
    });
  }
};

/**
 * Delete file
 * @route DELETE /api/upload/:imageId
 * @access Private
 */
const deleteImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    
    // Construct the full Cloudinary ID with folder
    const fullImageId = `ai-study-helper/${imageId}`;
    
    // Try to delete from Cloudinary (try both image and raw)
    let result;
    
    try {
      result = await cloudinary.uploader.destroy(fullImageId, { resource_type: 'image' });
    } catch (imageError) {
      try {
        result = await cloudinary.uploader.destroy(fullImageId, { resource_type: 'raw' });
      } catch (rawError) {
        throw new Error('File not found');
      }
    }
    
    if (result.result === 'ok') {
      res.status(200).json({
        success: true,
        message: 'File deleted successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete file'
      });
    }
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file'
    });
  }
};

module.exports = {
  uploadImage,
  getImage,
  deleteImage,
  upload,
  flexibleUpload
};
