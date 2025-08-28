const mongoose = require('mongoose');

const chatHistoryEntrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: false // Can be null for global chat
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['question', 'answer', 'clarification', 'explanation', 'quiz_generation'],
    default: 'question'
  },
  context: {
    sourceImageId: { type: String },
    evidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
    relatedNodes: [{ type: String }],
    searchQuery: { type: String },
    intent: { type: String } // 'study', 'quiz', 'clarify', 'explore'
  },
  embeddings: {
    vector: { type: [Number] }, // 384-dimensional vector from all-MiniLM-L6-v2
    model: { type: String, default: 'all-MiniLM-L6-v2' },
    generatedAt: { type: Date, default: Date.now }
  },
  metadata: {
    tokens: { type: Number },
    language: { type: String, default: 'en' },
    confidence: { type: Number, min: 0, max: 1 },
    processingTime: { type: Number }, // milliseconds
    modelUsed: { type: String }
  },
  feedback: {
    helpful: { type: Boolean },
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
    reported: { type: Boolean, default: false },
    reportReason: { type: String }
  },
  relatedContent: {
    quizIds: [{ type: String }],
    sessionIds: [{ type: String }],
    bookmarkIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bookmark' }]
  }
}, {
  timestamps: true
});

// Indexes for performance
chatHistoryEntrySchema.index({ userId: 1, createdAt: -1 });
chatHistoryEntrySchema.index({ sessionId: 1, createdAt: -1 });
chatHistoryEntrySchema.index({ 'embeddings.vector': '2dsphere' }); // For vector similarity search
chatHistoryEntrySchema.index({ role: 1, createdAt: -1 });

// Virtual for message length
chatHistoryEntrySchema.virtual('messageLength').get(function() {
  return this.text.length;
});

// Method to add feedback
chatHistoryEntrySchema.methods.addFeedback = function(feedbackData) {
  this.feedback = { ...this.feedback, ...feedbackData };
  return this.save();
};

// Method to add related content
chatHistoryEntrySchema.methods.addRelatedContent = function(contentType, contentId) {
  if (contentType === 'quiz' && !this.relatedContent.quizIds.includes(contentId)) {
    this.relatedContent.quizIds.push(contentId);
  } else if (contentType === 'session' && !this.relatedContent.sessionIds.includes(contentId)) {
    this.relatedContent.sessionIds.push(contentId);
  }
  return this.save();
};

// Method to get conversation context (last N messages)
chatHistoryEntrySchema.statics.getConversationContext = async function(userId, sessionId, limit = 5) {
  const query = { userId };
  if (sessionId) {
    query.sessionId = sessionId;
  }
  
  return await this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .sort({ createdAt: 1 }); // Return in chronological order
};

// Method to get semantic context (similar messages)
chatHistoryEntrySchema.statics.getSemanticContext = async function(userId, queryEmbedding, limit = 3) {
  // This would use vector similarity search in production
  // For now, return recent messages as fallback
  return await this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('ChatHistoryEntry', chatHistoryEntrySchema);
