const express = require('express');
const quizController = require('../controllers/quizController');

const router = express.Router();

/**
 * @route   GET /api/quiz/:imageId
 * @desc    Generate quiz from image evidence
 * @access  Public (for development testing)
 */
router.get('/:imageId', quizController.generateQuizFromImage.bind(quizController));

/**
 * @route   GET /api/quiz/id/:quizId
 * @desc    Get quiz by ID
 * @access  Public (for development testing)
 */
router.get('/id/:quizId', quizController.getQuiz.bind(quizController));

/**
 * @route   GET /api/quiz/user/:userId
 * @desc    Get all quizzes for user
 * @access  Public (for development testing)
 */
router.get('/user/:userId', quizController.getUserQuizzes.bind(quizController));

module.exports = router;
