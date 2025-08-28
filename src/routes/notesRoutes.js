const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const Note = require('../models/Note');

const router = express.Router();

// Allow optional auth so frontend without token still works in dev.
router.use(optionalAuth);

/**
 * @route   PUT /notes/:id
 * @desc    Create or update a note by noteId. If authenticated, ties to userId.
 * @access  Public (dev) / Authenticated (pref)
 */
router.put('/:id', async (req, res) => {
  try {
    const noteId = req.params.id;
    const { title = '', content = '', tags = [] } = req.body || {};

    if (!noteId) {
      return res.status(400).json({ success: false, error: 'noteId is required' });
    }

    const filter = { noteId };
    // If user present, scope by userId
    if (req.user?._id) {
      filter.userId = req.user._id;
    }

    const update = {
      $set: {
        title: String(title),
        content: String(content),
        tags: Array.isArray(tags) ? tags.map(String) : [],
      },
      $setOnInsert: {
        noteId,
        userId: req.user?._id || undefined,
        createdAt: new Date(),
      }
    };

    const note = await Note.findOneAndUpdate(filter, update, { new: true, upsert: true });

    return res.status(200).json({ success: true, note });
  } catch (error) {
    console.error('Notes PUT error:', error);
    return res.status(500).json({ success: false, error: 'Failed to save note' });
  }
});

module.exports = router;
