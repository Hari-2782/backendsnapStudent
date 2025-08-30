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
  // Store the actual message content for better retrieval
  content: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['question', 'answer', 'clarification', 'explanation', 'quiz_generation', 'rag_response', 'user_question'],
    default: 'question'
  },
  context: {
    sourceImageId: { type: String },
    imageUrl: { type: String },
    evidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }],
    relatedNodes: [{ type: String }],
    searchQuery: { type: String },
    intent: { type: String }, // 'study', 'quiz', 'clarify', 'explore'
    sessionContext: { type: String }, // Additional session context
    imageAnalysis: { type: String } // What was analyzed from the image
  },
  // Store the actual response data for better context
  responseData: {
    method: { type: String }, // 'rag-enhanced', 'vision-rag', 'fallback', etc.
    model: { type: String }, // Which AI model was used
    contextUsed: {
      sessions: { type: Number, default: 0 },
      evidence: { type: Number, default: 0 },
      chatHistory: { type: Number, default: 0 },
      hasImage: { type: Boolean, default: false }
    },
    processingTime: { type: Number }, // Response generation time
    confidence: { type: Number, min: 0, max: 1, default: 0.8 }
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
    modelUsed: { type: String },
    // Additional metadata for better tracking
    userIntent: { type: String }, // What the user was trying to achieve
    topic: { type: String }, // Main topic of the conversation
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
    subject: { type: String } // Academic subject area
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
    bookmarkIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bookmark' }],
    // Link to related images and evidence
    relatedImageIds: [{ type: String }],
    relatedEvidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }]
  }
}, {
  timestamps: true
});

// Indexes for performance
chatHistoryEntrySchema.index({ userId: 1, createdAt: -1 });
chatHistoryEntrySchema.index({ sessionId: 1, createdAt: -1 });
chatHistoryEntrySchema.index({ sourceImageId: 1, createdAt: -1 });
chatHistoryEntrySchema.index({ 'context.sourceImageId': 1, createdAt: -1 });

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
  } else if (contentType === 'image' && !this.relatedContent.relatedImageIds.includes(contentId)) {
    this.relatedContent.relatedImageIds.push(contentId);
  } else if (contentType === 'evidence' && !this.relatedContent.relatedEvidenceIds.includes(contentId)) {
    this.relatedContent.relatedEvidenceIds.push(contentId);
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

// Method to get chat history by image context
chatHistoryEntrySchema.statics.getChatHistoryByImage = async function(userId, imageId, limit = 20) {
  return await this.find({
    userId,
    $or: [
      { 'context.sourceImageId': imageId },
      { 'relatedContent.relatedImageIds': imageId }
    ]
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Method to get comprehensive chat history
chatHistoryEntrySchema.statics.getComprehensiveChatHistory = async function(userId, options = {}) {
  const { 
    limit = 50, 
    sessionId, 
    imageId, 
    startDate, 
    endDate,
    messageType 
  } = options;
  
  const query = { userId };
  
  if (sessionId) query.sessionId = sessionId;
  if (imageId) {
    query.$or = [
      { 'context.sourceImageId': imageId },
      { 'relatedContent.relatedImageIds': imageId }
    ];
  }
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  if (messageType) query.messageType = messageType;
  
  return await this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('relatedContent.evidenceIds', 'text imageUrl ocrConfidence')
    .populate('relatedContent.sessionIds', 'title description');
};

module.exports = mongoose.model('ChatHistoryEntry', chatHistoryEntrySchema);
