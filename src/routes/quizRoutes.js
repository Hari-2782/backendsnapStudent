const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { 
  generateQuiz, 
  getQuiz, 
  submitQuiz, 
  getQuizAnalytics 
} = require('../controllers/quizController');

const router = express.Router();

// Apply authentication middleware
if (process.env.NODE_ENV === 'development') {
  router.use(optionalAuth);
} else {
  router.use(authenticateToken);
}

/**
 * @route   POST /api/quiz/:imageId
 * @desc    Generate quiz from image/PDF content
 * @access  Private
 */
router.post('/:imageId', generateQuiz);

/**
 * @route   GET /api/quiz/generate/:imageId
 * @desc    Generate quiz from image/PDF content (GET method)
 * @access  Private
 */
router.get('/generate/:imageId', generateQuiz);

/**
 * @route   GET /api/quiz/:quizId
 * @desc    Get quiz by ID or generate quiz from image ID
 * @access  Private
 */
router.get('/:quizId', async (req, res) => {
  const { quizId } = req.params;
  
  // Check if this looks like an image ID (contains underscores and file extension)
  if (quizId.includes('_') && (quizId.includes('.jpg') || quizId.includes('.png') || quizId.includes('.pdf'))) {
    // This is an image ID, generate a quiz
    console.log('🔄 Image ID detected, generating quiz...');
    
    // Create a modified request object with imageId parameter
    const modifiedReq = {
      ...req,
      params: {
        ...req.params,
        imageId: quizId
      }
    };
    
    return generateQuiz(modifiedReq, res);
  } else {
    // This is a quiz ID, get existing quiz
    console.log('🔄 Quiz ID detected, retrieving quiz...');
    return getQuiz(req, res);
  }
});

/**
 * @route   GET /api/quiz/detail/:quizId
 * @desc    Get full quiz details by quiz ID (not image ID)
 * @access  Private
 */
router.get('/detail/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    const requestingUserId = req.user?._id || 'dev-user-123';
    
    // Get quiz from database
    const Quiz = require('../models/Quiz');
    const quiz = await Quiz.findOne({ id: quizId });
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }
    
    // Check access permissions
    if (process.env.NODE_ENV === 'development' || requestingUserId === quiz.userId) {
      res.status(200).json({
        success: true,
        quiz,
        message: 'Quiz retrieved successfully'
      });
    } else {
      res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own quizzes.'
      });
    }
    
  } catch (error) {
    console.error('❌ Get quiz detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quiz details'
    });
  }
});

/**
 * @route   GET /api/quiz/id/:quizId
 * @desc    Get quiz by ID (alternative route for frontend compatibility)
 * @access  Private
 */
router.get('/id/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    const requestingUserId = req.user?._id || 'dev-user-123';
    
    // Get quiz from database
    const Quiz = require('../models/Quiz');
    const quiz = await Quiz.findOne({ id: quizId });
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }
    
    // Check access permissions
    if (process.env.NODE_ENV === 'development' || requestingUserId === quiz.userId) {
      res.status(200).json({
        success: true,
        quiz,
        message: 'Quiz retrieved successfully'
      });
    } else {
      res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own quizzes.'
      });
    }
    
  } catch (error) {
    console.error('❌ Get quiz by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quiz'
    });
  }
});

/**
 * @route   POST /api/quiz/:quizId/submit
 * @desc    Submit quiz answers and get results
 * @access  Private
 */
router.post('/:quizId/submit', submitQuiz);

/**
 * @route   GET /api/quiz/:quizId/analytics
 * @desc    Get quiz analytics and performance data
 * @access  Private
 */
router.get('/:quizId/analytics', getQuizAnalytics);

/**
 * @route   GET /api/quiz/user/:userId
 * @desc    Get all quizzes for a specific user
 * @access  Private
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?._id || 'dev-user-123';
    
    // In production, you'd verify the requesting user has permission to view this user's quizzes
    // For now, we'll allow access if it's the same user or in development mode
    
    if (process.env.NODE_ENV === 'development' || requestingUserId === userId) {
      // Get all quizzes for this user from the Quiz model
      const Quiz = require('../models/Quiz');
      const quizzes = await Quiz.find({ userId })
        .sort({ createdAt: -1 })
        .select('-questions') // Don't include full questions for list view
        .limit(50);
      
      console.log(`🔍 Found ${quizzes.length} quizzes for user ${userId}`);
      
      res.status(200).json({
        success: true,
        quizzes,
        totalQuizzes: quizzes.length,
        userId,
        message: `Found ${quizzes.length} quizzes for user`
      });
    } else {
      res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own quizzes.'
      });
    }
    
  } catch (error) {
    console.error('❌ Get user quizzes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve user quizzes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
