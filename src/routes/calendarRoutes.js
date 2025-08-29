const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { 
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  markTaskCompleted,
  markTaskIncomplete,
  getWeeklyProgress,
  getMonthlyProgress,
  getOverallProgress,
  getTasksBySubject,
  getUpcomingTasks,
  getTasksByDateRange,
  bulkUpdateStatus
} = require('../controllers/calendarController');

const router = express.Router();

// Apply authentication middleware
if (process.env.NODE_ENV === 'development') {
  router.use(optionalAuth);
} else {
  router.use(authenticateToken);
}

/**
 * @route   POST /api/calendar
 * @desc    Create a new calendar task
 * @access  Private
 */
router.post('/', createTask);

/**
 * @route   GET /api/calendar
 * @desc    Get all tasks for authenticated user with pagination and filters
 * @access  Private
 */
router.get('/', getTasks);

/**
 * @route   GET /api/calendar/upcoming
 * @desc    Get upcoming tasks
 * @access  Private
 */
router.get('/upcoming', getUpcomingTasks);

/**
 * @route   GET /api/calendar/range
 * @desc    Get tasks by date range
 * @access  Private
 */
router.get('/range', getTasksByDateRange);

/**
 * @route   GET /api/calendar/progress/weekly
 * @desc    Get weekly progress statistics
 * @access  Private
 */
router.get('/progress/weekly', getWeeklyProgress);

/**
 * @route   GET /api/calendar/progress/monthly
 * @desc    Get monthly progress statistics
 * @access  Private
 */
router.get('/progress/monthly', getMonthlyProgress);

/**
 * @route   GET /api/calendar/progress/overall
 * @desc    Get overall user progress
 * @access  Private
 */
router.get('/progress/overall', getOverallProgress);

/**
 * @route   GET /api/calendar/progress/subject/:subject
 * @desc    Get tasks by subject with progress
 * @access  Private
 */
router.get('/progress/subject/:subject', getTasksBySubject);

/**
 * @route   GET /api/calendar/:id
 * @desc    Get a single task by ID
 * @access  Private
 */
router.get('/:id', getTaskById);

/**
 * @route   PUT /api/calendar/:id
 * @desc    Update a task
 * @access  Private
 */
router.put('/:id', updateTask);

/**
 * @route   DELETE /api/calendar/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete('/:id', deleteTask);

/**
 * @route   PATCH /api/calendar/:id/complete
 * @desc    Mark task as completed
 * @access  Private
 */
router.patch('/:id/complete', markTaskCompleted);

/**
 * @route   PATCH /api/calendar/:id/incomplete
 * @desc    Mark task as incomplete
 * @access  Private
 */
router.patch('/:id/incomplete', markTaskIncomplete);

/**
 * @route   PATCH /api/calendar/bulk-status
 * @desc    Bulk update task status
 * @access  Private
 */
router.patch('/bulk-status', bulkUpdateStatus);

module.exports = router;
