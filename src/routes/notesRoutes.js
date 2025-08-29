const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { 
  createNote, 
  getNotes, 
  getNoteById, 
  updateNote, 
  deleteNote,
  updateNoteTags,
  toggleNotePin,
  toggleNotePublic,
  getNoteStats,
  searchNotes
} = require('../controllers/notesController');
const multer = require('multer');

// Configure multer for note image uploads (memory storage for Vercel compatibility)
const noteImageUpload = multer({
  storage: multer.memoryStorage(), // Use memory storage instead of disk storage
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const router = express.Router();

// Apply authentication middleware
if (process.env.NODE_ENV === 'development') {
  router.use(optionalAuth);
} else {
  router.use(authenticateToken);
}

/**
 * @route   POST /api/notes
 * @desc    Create a new note with optional image
 * @access  Private
 */
router.post('/', noteImageUpload.single('image'), createNote);

/**
 * @route   GET /api/notes
 * @desc    Get all notes for authenticated user with pagination and filters
 * @access  Private
 */
router.get('/', getNotes);

/**
 * @route   GET /api/notes/search
 * @desc    Search notes by query, category, tags, or status
 * @access  Private
 */
router.get('/search', searchNotes);

/**
 * @route   GET /api/notes/stats
 * @desc    Get note statistics for authenticated user
 * @access  Private
 */
router.get('/stats', getNoteStats);

/**
 * @route   GET /api/notes/:id
 * @desc    Get a single note by ID
 * @access  Private
 */
router.get('/:id', getNoteById);

/**
 * @route   PUT /api/notes/:id
 * @desc    Update a note with optional image
 * @access  Private
 */
router.put('/:id', noteImageUpload.single('image'), updateNote);

/**
 * @route   DELETE /api/notes/:id
 * @desc    Delete a note and its associated image
 * @access  Private
 */
router.delete('/:id', deleteNote);

/**
 * @route   PATCH /api/notes/:id/tags
 * @desc    Add or remove tags from a note
 * @access  Private
 */
router.patch('/:id/tags', updateNoteTags);

/**
 * @route   PATCH /api/notes/:id/pin
 * @desc    Toggle pin status of a note
 * @access  Private
 */
router.patch('/:id/pin', toggleNotePin);

/**
 * @route   PATCH /api/notes/:id/public
 * @desc    Toggle public status of a note
 * @access  Private
 */
router.patch('/:id/public', toggleNotePublic);

module.exports = router;
