const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Calendar CRUD operations
router.post('/create', calendarController.createCalendarEntry);
router.get('/entries', calendarController.getCalendarEntries);
router.get('/upcoming', calendarController.getUpcomingEntries);
router.get('/stats', calendarController.getCalendarStats);

// Individual calendar entry operations
router.put('/entry/:entryId', calendarController.updateCalendarEntry);
router.delete('/entry/:entryId', calendarController.deleteCalendarEntry);

// Bulk operations
router.post('/bulk-create', calendarController.bulkCreateEntries);

module.exports = router;
