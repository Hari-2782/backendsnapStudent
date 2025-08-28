const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true
  },
  originalImageId: {
    type: String,
    required: true
  },
  bbox: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  ocrConfidence: {
    type: Number,
    min: 0,
    max: 1,
    required: true
  },
  ocrMethod: {
    type: String,
    enum: ['tesseract', 'trocr', 'paddleocr', 'im2latex'],
    required: true
  },
  contentType: {
    type: String,
    enum: ['text', 'equation', 'diagram', 'mixed'],
    default: 'text'
  },
  metadata: {
    language: { type: String, default: 'en' },
    rotation: { type: Number, default: 0 },
    preprocessing: [{
      method: { type: String },
      applied: { type: Boolean, default: true },
      parameters: { type: mongoose.Schema.Types.Mixed }
    }],
    regionType: { type: String }, // 'header', 'body', 'caption', 'equation'
    lineCount: { type: Number },
    wordCount: { type: Number }
  },
  corrections: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    originalText: { type: String },
    correctedText: { type: String },
    confidence: { type: Number, min: 0, max: 1 },
    correctedAt: { type: Date, default: Date.now },
    reason: { type: String }
  }],
  usage: {
    totalReferences: { type: Number, default: 0 },
    lastReferenced: { type: Date },
    referencedIn: [{
      type: { type: String, enum: ['quiz', 'session', 'chat'] },
      id: { type: String },
      referencedAt: { type: Date, default: Date.now }
    }]
  },
  status: {
    type: String,
    enum: ['active', 'flagged', 'corrected', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes for performance
evidenceSchema.index({ originalImageId: 1 });
evidenceSchema.index({ ocrConfidence: 1 });
evidenceSchema.index({ contentType: 1 });
evidenceSchema.index({ 'usage.totalReferences': -1 });

// Virtual for area
evidenceSchema.virtual('area').get(function() {
  return this.bbox.width * this.bbox.height;
});

// Method to add correction
evidenceSchema.methods.addCorrection = function(correctionData) {
  this.corrections.push(correctionData);
  this.text = correctionData.correctedText;
  this.ocrConfidence = correctionData.confidence;
  this.status = 'corrected';
  return this.save();
};

// Method to increment reference count
evidenceSchema.methods.incrementReference = function(referenceType, referenceId) {
  this.usage.totalReferences += 1;
  this.usage.lastReferenced = new Date();
  this.usage.referencedIn.push({
    type: referenceType,
    id: referenceId,
    referencedAt: new Date()
  });
  return this.save();
};

// Method to get confidence level description
evidenceSchema.methods.getConfidenceLevel = function() {
  if (this.ocrConfidence >= 0.9) return 'high';
  if (this.ocrConfidence >= 0.7) return 'medium';
  if (this.ocrConfidence >= 0.5) return 'low';
  return 'very_low';
};

// Method to get bounding box as normalized coordinates (0-1)
evidenceSchema.methods.getNormalizedBbox = function(imageWidth, imageHeight) {
  return {
    x: this.bbox.x / imageWidth,
    y: this.bbox.y / imageHeight,
    width: this.bbox.width / imageWidth,
    height: this.bbox.height / imageHeight
  };
};

module.exports = mongoose.model('Evidence', evidenceSchema);
