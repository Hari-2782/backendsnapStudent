const Bookmark = require('../models/Bookmark');
const Session = require('../models/Session');
const Quiz = require('../models/Quiz');
const Evidence = require('../models/Evidence');

/**
 * Create a new bookmark
 * @route POST /api/bookmarks
 * @access Private
 */
const createBookmark = async (req, res) => {
  try {
    const { refType, refId, title, description, note, tags, priority } = req.body;
    
    // Validate reference type and ID
    let refContent = null;
    let contentSnapshot = '';
    
    switch (refType) {
      case 'session':
        refContent = await Session.findOne({ sessionId: refId, userId: req.user._id });
        if (refContent) {
          contentSnapshot = JSON.stringify({
            title: refContent.title,
            description: refContent.description,
            nodes: refContent.nodes.slice(0, 3), // First 3 nodes
            tags: refContent.tags
          });
        }
        break;
      case 'quiz':
        refContent = await Quiz.findOne({ quizId: refId, userId: req.user._id });
        if (refContent) {
          contentSnapshot = JSON.stringify({
            title: refContent.title,
            description: refContent.description,
            questionCount: refContent.questions.length,
            tags: refContent.tags
          });
        }
        break;
      case 'evidence':
        refContent = await Evidence.findOne({ _id: refId });
        if (refContent) {
          contentSnapshot = JSON.stringify({
            text: refContent.text.substring(0, 200), // First 200 chars
            contentType: refContent.contentType,
            ocrConfidence: refContent.ocrConfidence
          });
        }
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid reference type'
        });
    }
    
    if (!refContent) {
      return res.status(404).json({
        success: false,
        error: 'Referenced content not found'
      });
    }
    
    // Create bookmark
    const bookmark = new Bookmark({
      userId: req.user._id,
      refType,
      refId,
      title: title || refContent.title || 'Untitled',
      description: description || refContent.description || '',
      note,
      tags: tags || [],
      priority: priority || 'medium',
      contentSnapshot,
      status: 'active'
    });
    
    await bookmark.save();
    
    res.status(201).json({
      success: true,
      message: 'Bookmark created successfully',
      bookmark
    });
  } catch (error) {
    console.error('Create bookmark error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create bookmark'
    });
  }
};

/**
 * Get all bookmarks for a user
 * @route GET /api/bookmarks
 * @access Private
 */
const getBookmarks = async (req, res) => {
  try {
    const { page = 1, limit = 20, refType, tags, priority, status } = req.query;
    
    // Build filter object
    const filter = { userId: req.user._id };
    if (refType) filter.refType = refType;
    if (tags) filter.tags = { $in: tags.split(',') };
    if (priority) filter.priority = priority;
    if (status) filter.status = status;
    
    const bookmarks = await Bookmark.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const total = await Bookmark.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      bookmarks,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalBookmarks: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bookmarks'
    });
  }
};

/**
 * Get a specific bookmark by ID
 * @route GET /api/bookmarks/:id
 * @access Private
 */
const getBookmarkById = async (req, res) => {
  try {
    const bookmark = await Bookmark.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!bookmark) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found'
      });
    }
    
    res.status(200).json({
      success: true,
      bookmark
    });
  } catch (error) {
    console.error('Get bookmark error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bookmark'
    });
  }
};

/**
 * Update a bookmark
 * @route PUT /api/bookmarks/:id
 * @access Private
 */
const updateBookmark = async (req, res) => {
  try {
    const { title, description, note, tags, priority, status } = req.body;
    
    const bookmark = await Bookmark.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id
      },
      {
        title,
        description,
        note,
        tags,
        priority,
        status
      },
      { new: true, runValidators: true }
    );
    
    if (!bookmark) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Bookmark updated successfully',
      bookmark
    });
  } catch (error) {
    console.error('Update bookmark error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update bookmark'
    });
  }
};

/**
 * Delete a bookmark
 * @route DELETE /api/bookmarks/:id
 * @access Private
 */
const deleteBookmark = async (req, res) => {
  try {
    const bookmark = await Bookmark.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!bookmark) {
      return res.status(404).json({
        success: false,
        error: 'Bookmark not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Bookmark deleted successfully'
    });
  } catch (error) {
    console.error('Delete bookmark error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete bookmark'
    });
  }
};

/**
 * Search bookmarks
 * @route GET /api/bookmarks/search
 * @access Private
 */
const searchBookmarks = async (req, res) => {
  try {
    const { q, refType, tags, priority } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    // Build search filter
    const filter = { userId: req.user._id };
    if (refType) filter.refType = refType;
    if (tags) filter.tags = { $in: tags.split(',') };
    if (priority) filter.priority = priority;
    
    // Text search across title, description, note, and contentSnapshot
    const searchFilter = {
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { note: { $regex: q, $options: 'i' } },
        { contentSnapshot: { $regex: q, $options: 'i' } }
      ]
    };
    
    const bookmarks = await Bookmark.find({
      ...filter,
      ...searchFilter
    }).sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      bookmarks,
      searchQuery: q,
      totalResults: bookmarks.length
    });
  } catch (error) {
    console.error('Search bookmarks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search bookmarks'
    });
  }
};

/**
 * Get bookmark statistics
 * @route GET /api/bookmarks/stats
 * @access Private
 */
const getBookmarkStats = async (req, res) => {
  try {
    const stats = await Bookmark.aggregate([
      { $match: { userId: req.user._id } },
      {
        $group: {
          _id: null,
          totalBookmarks: { $sum: 1 },
          byType: {
            $push: {
              refType: '$refType',
              count: 1
            }
          },
          byPriority: {
            $push: {
              priority: '$priority',
              count: 1
            }
          },
          byStatus: {
            $push: {
              status: '$status',
              count: 1
            }
          }
        }
      }
    ]);
    
    if (stats.length === 0) {
      return res.status(200).json({
        success: true,
        stats: {
          totalBookmarks: 0,
          byType: [],
          byPriority: [],
          byStatus: []
        }
      });
    }
    
    // Process aggregation results
    const result = stats[0];
    const byType = result.byType.reduce((acc, item) => {
      acc[item.refType] = (acc[item.refType] || 0) + item.count;
      return acc;
    }, {});
    
    const byPriority = result.byPriority.reduce((acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + item.count;
      return acc;
    }, {});
    
    const byStatus = result.byStatus.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + item.count;
      return acc;
    }, {});
    
    res.status(200).json({
      success: true,
      stats: {
        totalBookmarks: result.totalBookmarks,
        byType,
        byPriority,
        byStatus
      }
    });
  } catch (error) {
    console.error('Get bookmark stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bookmark statistics'
    });
  }
};

module.exports = {
  createBookmark,
  getBookmarks,
  getBookmarkById,
  updateBookmark,
  deleteBookmark,
  searchBookmarks,
  getBookmarkStats
};
