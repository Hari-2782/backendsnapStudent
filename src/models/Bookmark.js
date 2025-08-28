const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  refType: {
    type: String,
    enum: ['session', 'quiz', 'node', 'chat', 'evidence'],
    required: true
  },
  refId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  note: {
    type: String,
    trim: true
  },
  contentSnapshot: {
    // Store a snapshot of the content at time of bookmarking
    text: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed },
    capturedAt: { type: Date, default: Date.now }
  },
  tags: [{
    type: String,
    trim: true
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  },
  access: {
    isPublic: { type: Boolean, default: false },
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  metadata: {
    sourceImageId: { type: String },
    sessionId: { type: String },
    lastAccessed: { type: Date, default: Date.now },
    accessCount: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes for performance
bookmarkSchema.index({ userId: 1, createdAt: -1 });
bookmarkSchema.index({ refType: 1, refId: 1 });
bookmarkSchema.index({ tags: 1 });
bookmarkSchema.index({ priority: 1 });
bookmarkSchema.index({ status: 1 });

// Virtual for age in days
bookmarkSchema.virtual('ageInDays').get(function() {
  const now = new Date();
  const created = this.createdAt;
  const diffTime = Math.abs(now - created);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to update access count
bookmarkSchema.methods.incrementAccess = function() {
  this.metadata.accessCount += 1;
  this.metadata.lastAccessed = new Date();
  return this.save();
};

// Method to add tag
bookmarkSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
  return this.save();
};

// Method to remove tag
bookmarkSchema.methods.removeTag = function(tag) {
  this.tags = this.tags.filter(t => t !== tag);
  return this.save();
};

// Method to update content snapshot
bookmarkSchema.methods.updateSnapshot = function(newContent) {
  this.contentSnapshot = {
    text: newContent.text || this.contentSnapshot.text,
    metadata: newContent.metadata || this.contentSnapshot.metadata,
    capturedAt: new Date()
  };
  return this.save();
};

// Static method to get bookmarks by type
bookmarkSchema.statics.getByType = function(userId, refType, limit = 20) {
  return this.find({ userId, refType })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method to search bookmarks
bookmarkSchema.statics.search = function(userId, query, limit = 20) {
  const searchRegex = new RegExp(query, 'i');
  return this.find({
    userId,
    $or: [
      { title: searchRegex },
      { description: searchRegex },
      { note: searchRegex },
      { tags: searchRegex }
    ]
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

module.exports = mongoose.model('Bookmark', bookmarkSchema);
