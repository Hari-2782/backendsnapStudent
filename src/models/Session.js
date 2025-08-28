const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  nodes: [{
    id: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['concept', 'definition', 'example', 'formula', 'diagram'],
      default: 'concept'
    },
    content: {
      type: String,
      required: true
    },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 }
    },
    metadata: {
      confidence: { type: Number, min: 0, max: 1, default: 0.8 },
      sourceImageId: { type: String },
      evidenceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Evidence' }]
    }
  }],
  edges: [{
    id: {
      type: String,
      required: true
    },
    source: {
      type: String,
      required: true
    },
    target: {
      type: String,
      required: true
    },
    label: {
      type: String
    },
    type: {
      type: String,
      enum: ['related', 'depends_on', 'leads_to', 'similar_to'],
      default: 'related'
    }
  }],
  sourceImages: [{
    imageId: { type: String, required: true },
    imageUrl: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    processedAt: { type: Date }
  }],
  tags: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft'
  },
  studyProgress: {
    completedNodes: [{ type: String }],
    totalNodes: { type: Number, default: 0 },
    lastStudied: { type: Date }
  },
  // Social signals
  likes: { type: Number, default: 0 },
  likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Minimal chat transcript for reopen
  chat: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    messageType: { type: String, default: 'text' },
    metadata: { type: Object, default: {} }
  }],
  // Optional source info to generate meaningful titles
  source: {
    uploadFilename: { type: String },
    imageUrl: { type: String }
  }
}, {
  timestamps: true
});

// Indexes for performance
sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ sessionId: 1 });
sessionSchema.index({ tags: 1 });

// Virtual for total nodes count
sessionSchema.virtual('totalNodesCount').get(function() {
  return this.nodes.length;
});

// Method to add node
sessionSchema.methods.addNode = function(nodeData) {
  this.nodes.push(nodeData);
  this.studyProgress.totalNodes = this.nodes.length;
  return this.save();
};

// Method to add edge
sessionSchema.methods.addEdge = function(edgeData) {
  this.edges.push(edgeData);
  return this.save();
};

// Helper to compute a meaningful title if missing/placeholder
sessionSchema.methods.computeDisplayTitle = function() {
  if (this.title && this.title.trim() && !this.title.startsWith('Session ')) return this.title;
  if (this.source?.uploadFilename) {
    return `Study Session from ${this.source.uploadFilename}`;
  }
  if (this.nodes && this.nodes.length > 0) {
    const first = this.nodes[0];
    return `Study Session: ${String(first.content).slice(0, 40)}`;
  }
  return `Study Session ${this.sessionId}`;
};

module.exports = mongoose.model('Session', sessionSchema);
