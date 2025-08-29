const Note = require('../models/Note');
const { cloudinary } = require('../services/cloudinaryService');
const { v4: uuidv4 } = require('uuid');

console.log('📝 Notes Controller: Using centralized Cloudinary service');

/**
 * Create a new note
 * @route POST /api/notes
 * @access Private
 */
const createNote = async (req, res) => {
  try {
    const { title, content, tags, category, priority, status, isPublic, isPinned } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required'
      });
    }

    // Handle image upload if provided
    let imageData = null;
    if (req.file) {
      try {
        // Upload image to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'ai-study-helper/notes',
          public_id: `note_${uuidv4()}`,
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
          ]
        });

        imageData = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          alt: title || 'Note image'
        };
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(500).json({
          success: false,
          error: 'Failed to upload image'
        });
      }
    }

    // Create note
    const note = new Note({
      title,
      content,
      tags: tags || [],
      image: imageData,
      userId,
      category: category || 'study',
      priority: priority || 'medium',
      status: status || 'draft',
      isPublic: isPublic || false,
      isPinned: isPinned || false
    });

    await note.save();

    // Populate user info
    await note.populate('userId', 'username email');

    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      note
    });

  } catch (error) {
    console.error('❌ Create note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create note',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all notes for the authenticated user
 * @route GET /api/notes
 * @access Private
 */
const getNotes = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 10,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      category,
      tags,
      search,
      status,
      isPinned
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
      category,
      tags: tags ? tags.split(',') : undefined,
      search,
      status,
      isPinned: isPinned === 'true'
    };

    const notes = await Note.findByUser(userId, options);

    // Get total count for pagination
    const totalQuery = { userId };
    if (category) totalQuery.category = category;
    if (status) totalQuery.status = status;
    if (isPinned !== undefined) totalQuery.isPinned = isPinned;
    if (tags && tags.length > 0) {
      totalQuery.tags = { $in: tags.map(tag => tag.toLowerCase()) };
    }
    if (search) {
      totalQuery.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const totalNotes = await Note.countDocuments(totalQuery);
    const totalPages = Math.ceil(totalNotes / limit);

    res.status(200).json({
      success: true,
      notes,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalNotes,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Get notes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notes'
    });
  }
};

/**
 * Get a single note by ID
 * @route GET /api/notes/:id
 * @access Private
 */
const getNoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const note = await Note.findOne({ _id: id, userId }).populate('userId', 'username email');

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    res.status(200).json({
      success: true,
      note
    });

  } catch (error) {
    console.error('❌ Get note by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve note'
    });
  }
};

/**
 * Update a note
 * @route PUT /api/notes/:id
 * @access Private
 */
const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const updateData = req.body;

    // Find the note
    const note = await Note.findOne({ _id: id, userId });
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Handle image update if new image provided
    if (req.file) {
      try {
        // Delete old image if exists
        if (note.image && note.image.publicId) {
          await cloudinary.uploader.destroy(note.image.publicId);
        }

        // Upload new image
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'ai-study-helper/notes',
          public_id: `note_${uuidv4()}`,
          transformation: [
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
          ]
        });

        updateData.image = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          alt: updateData.title || note.title || 'Note image'
        };
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(500).json({
          success: false,
          error: 'Failed to upload new image'
        });
      }
    }

    // Update the note
    const updatedNote = await Note.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'username email');

    res.status(200).json({
      success: true,
      message: 'Note updated successfully',
      note: updatedNote
    });

  } catch (error) {
    console.error('❌ Update note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update note',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a note
 * @route DELETE /api/notes/:id
 * @access Private
 */
const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const note = await Note.findOne({ _id: id, userId });
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Delete associated image from Cloudinary if exists
    if (note.image && note.image.publicId) {
      try {
        await cloudinary.uploader.destroy(note.image.publicId);
      } catch (imageError) {
        console.error('Failed to delete image from Cloudinary:', imageError);
      }
    }

    // Delete the note
    await Note.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete note'
    });
  }
};

/**
 * Update note tags
 * @route PATCH /api/notes/:id/tags
 * @access Private
 */
const updateNoteTags = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, tags } = req.body; // action: 'add' or 'remove'
    const userId = req.user._id;

    const note = await Note.findOne({ _id: id, userId });
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    if (action === 'add') {
      await note.addTags(tags);
    } else if (action === 'remove') {
      await note.removeTags(tags);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid action. Use "add" or "remove"'
      });
    }

    await note.populate('userId', 'username email');

    res.status(200).json({
      success: true,
      message: `Tags ${action}ed successfully`,
      note
    });

  } catch (error) {
    console.error('❌ Update note tags error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update note tags'
    });
  }
};

/**
 * Toggle note pin status
 * @route PATCH /api/notes/:id/pin
 * @access Private
 */
const toggleNotePin = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const note = await Note.findOne({ _id: id, userId });
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    await note.togglePin();
    await note.populate('userId', 'username email');

    res.status(200).json({
      success: true,
      message: `Note ${note.isPinned ? 'pinned' : 'unpinned'} successfully`,
      note
    });

  } catch (error) {
    console.error('❌ Toggle note pin error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle note pin status'
    });
  }
};

/**
 * Toggle note public status
 * @route PATCH /api/notes/:id/public
 * @access Private
 */
const toggleNotePublic = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const note = await Note.findOne({ _id: id, userId });
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    await note.togglePublic();
    await note.populate('userId', 'username email');

    res.status(200).json({
      success: true,
      message: `Note ${note.isPublic ? 'made public' : 'made private'} successfully`,
      note
    });

  } catch (error) {
    console.error('❌ Toggle note public error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle note public status'
    });
  }
};

/**
 * Get note statistics for the authenticated user
 * @route GET /api/notes/stats
 * @access Private
 */
const getNoteStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const stats = await Note.getUserStats(userId);

    res.status(200).json({
      success: true,
      stats: stats[0] || {
        totalNotes: 0,
        totalWords: 0,
        categories: [],
        uniqueTags: 0,
        pinnedNotes: 0,
        publicNotes: 0
      }
    });

  } catch (error) {
    console.error('❌ Get note stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve note statistics'
    });
  }
};

/**
 * Search notes
 * @route GET /api/notes/search
 * @access Private
 */
const searchNotes = async (req, res) => {
  try {
    const userId = req.user._id;
    const { q, category, tags, status } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const query = { userId };
    
    // Add filters
    if (category) query.category = category;
    if (status) query.status = status;
    if (tags) {
      query.tags = { $in: tags.split(',').map(tag => tag.toLowerCase()) };
    }

    // Search in title, content, and tags
    query.$or = [
      { title: { $regex: q, $options: 'i' } },
      { content: { $regex: q, $options: 'i' } },
      { tags: { $in: [new RegExp(q, 'i')] } }
    ];

    const notes = await Note.find(query)
      .sort({ updatedAt: -1 })
      .populate('userId', 'username email')
      .limit(20);

    res.status(200).json({
      success: true,
      query: q,
      results: notes,
      totalResults: notes.length
    });

  } catch (error) {
    console.error('❌ Search notes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search notes'
    });
  }
};

module.exports = {
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
};
