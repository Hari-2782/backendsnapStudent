const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const Evidence = require('../models/Evidence');
const ApiResponse = require('../utils/apiResponse');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/evidence
 * @desc    Get all evidence records for the authenticated user
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user?._id || 'dev-user-123';
    
    // Get evidence records (for debugging, show all for now)
    const evidence = await Evidence.find({}).sort({ createdAt: -1 }).limit(50);
    
    return res.json(ApiResponse.success('Evidence retrieved successfully', evidence));
    
  } catch (error) {
    console.error('❌ Get evidence error:', error);
    return res.status(500).json(ApiResponse.serverError('Failed to retrieve evidence', error));
  }
});

/**
 * @route   GET /api/evidence/:imageId
 * @desc    Get evidence records for a specific image
 * @access  Private
 */
router.get('/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user?._id || 'dev-user-123';
    
    if (!imageId) {
      return res.status(400).json(ApiResponse.error('imageId is required'));
    }
    
    console.log(`🔍 Searching for evidence with imageId: ${imageId}`);
    
    // Try multiple search strategies
    let evidence = await Evidence.find({ originalImageId: imageId });
    
    if (!evidence || evidence.length === 0) {
      console.log(`⚠️ No evidence found with originalImageId: ${imageId}`);
      
      // Try alternative search methods
      evidence = await Evidence.find({ 
        $or: [
          { originalImageId: imageId },
          { imageUrl: { $regex: imageId, $options: 'i' } }
        ]
      });
      
      if (!evidence || evidence.length === 0) {
        // Check if imageId might be a Cloudinary public ID
        const cloudinaryId = imageId.replace('ai-study-helper/', '');
        evidence = await Evidence.find({ 
          $or: [
            { originalImageId: cloudinaryId },
            { originalImageId: `ai-study-helper/${cloudinaryId}` }
          ]
        });
      }
    }
    
    if (!evidence || evidence.length === 0) {
      return res.status(404).json(ApiResponse.notFound(`No evidence found for image: ${imageId}`));
    }
    
    console.log(`✅ Found ${evidence.length} evidence records for image: ${imageId}`);
    
    return res.json(ApiResponse.success('Evidence retrieved successfully', {
      imageId,
      evidenceCount: evidence.length,
      evidence: evidence.map(ev => ({
        id: ev._id,
        text: ev.text,
        originalImageId: ev.originalImageId,
        imageUrl: ev.imageUrl,
        ocrConfidence: ev.ocrConfidence,
        ocrMethod: ev.ocrMethod,
        createdAt: ev.createdAt
      }))
    }));
    
  } catch (error) {
    console.error('❌ Get evidence by imageId error:', error);
    return res.status(500).json(ApiResponse.serverError('Failed to retrieve evidence', error));
  }
});

/**
 * @route   GET /api/evidence/debug/summary
 * @desc    Get a summary of all evidence records for debugging
 * @access  Private
 */
router.get('/debug/summary', async (req, res) => {
  try {
    const userId = req.user?._id || 'dev-user-123';
    
    // Get summary statistics
    const totalEvidence = await Evidence.countDocuments({});
    const evidenceByMethod = await Evidence.aggregate([
      {
        $group: {
          _id: '$ocrMethod',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const evidenceByImage = await Evidence.aggregate([
      {
        $group: {
          _id: '$originalImageId',
          count: { $sum: 1 },
          sampleText: { $first: '$text' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    const recentEvidence = await Evidence.find({})
      .sort({ createdAt: -1 })
      .limit(3)
      .select('originalImageId imageUrl text ocrMethod createdAt');
    
    return res.json(ApiResponse.success('Evidence summary retrieved successfully', {
      totalEvidence,
      evidenceByMethod,
      evidenceByImage,
      recentEvidence
    }));
    
  } catch (error) {
    console.error('❌ Get evidence summary error:', error);
    return res.status(500).json(ApiResponse.serverError('Failed to retrieve evidence summary', error));
  }
});

module.exports = router;
