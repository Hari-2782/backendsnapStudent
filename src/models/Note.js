const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true,
    maxlength: [10000, 'Content cannot exceed 10000 characters']
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  image: {
    url: {
      type: String,
      default: null
    },
    publicId: {
      type: String,
      default: null
    },
    alt: {
      type: String,
      default: null
    }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  category: {
    type: String,
    enum: ['study', 'personal', 'work', 'ideas', 'other'],
    default: 'study'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
noteSchema.index({ userId: 1, createdAt: -1 });
noteSchema.index({ userId: 1, tags: 1 });
noteSchema.index({ userId: 1, category: 1 });
noteSchema.index({ userId: 1, isPinned: -1, updatedAt: -1 });

// Virtual for formatted creation date
noteSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for formatted updated date
noteSchema.virtual('formattedUpdatedAt').get(function() {
  return this.updatedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for word count
noteSchema.virtual('wordCount').get(function() {
  return this.content ? this.content.split(/\s+/).length : 0;
});

// Virtual for reading time estimate
noteSchema.virtual('readingTime').get(function() {
  const wordsPerMinute = 200;
  return Math.ceil(this.wordCount / wordsPerMinute);
});

// Pre-save middleware to clean tags
noteSchema.pre('save', function(next) {
  if (this.tags) {
    // Remove empty tags and duplicates
    this.tags = this.tags
      .filter(tag => tag && tag.trim().length > 0)
      .map(tag => tag.trim().toLowerCase())
      .filter((tag, index, arr) => arr.indexOf(tag) === index);
  }
  next();
});

// Static method to find notes by user with pagination
noteSchema.statics.findByUser = function(userId, options = {}) {
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
  } = options;

  const query = { userId };
  
  // Add filters
  if (category) query.category = category;
  if (status) query.status = status;
  if (isPinned !== undefined) query.isPinned = isPinned;
  
  // Tag filter
  if (tags && tags.length > 0) {
    query.tags = { $in: tags.map(tag => tag.toLowerCase()) };
  }
  
  // Search filter
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  return this.find(query)
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('userId', 'username email')
    .exec();
};

// Static method to get note statistics for a user
noteSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalNotes: { $sum: 1 },
        totalWords: { $sum: { $strLenCP: '$content' } },
        categories: { $addToSet: '$category' },
        tags: { $addToSet: '$tags' },
        pinnedNotes: { $sum: { $cond: ['$isPinned', 1, 0] } },
        publicNotes: { $sum: { $cond: ['$isPublic', 1, 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        totalNotes: 1,
        totalWords: 1,
        categories: 1,
        uniqueTags: { $size: { $setUnion: '$tags' } },
        pinnedNotes: 1,
        publicNotes: 1
      }
    }
  ]);
};

// Instance method to add tags
noteSchema.methods.addTags = function(newTags) {
  if (!Array.isArray(newTags)) {
    newTags = [newTags];
  }
  
  this.tags = [...new Set([...this.tags, ...newTags])];
  return this.save();
};

// Instance method to remove tags
noteSchema.methods.removeTags = function(tagsToRemove) {
  if (!Array.isArray(tagsToRemove)) {
    tagsToRemove = [tagsToRemove];
  }
  
  this.tags = this.tags.filter(tag => !tagsToRemove.includes(tag));
  return this.save();
};

// Instance method to toggle pin status
noteSchema.methods.togglePin = function() {
  this.isPinned = !this.isPinned;
  return this.save();
};

// Instance method to toggle public status
noteSchema.methods.togglePublic = function() {
  this.isPublic = !this.isPublic;
  return this.save();
};

module.exports = mongoose.model('Note', noteSchema);
