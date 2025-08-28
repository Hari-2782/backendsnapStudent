const mongoose = require('mongoose');

const calendarSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    default: () => `sess_${Math.random().toString(36).substr(2, 9)}`
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 15,
    max: 480, // 8 hours max
    default: 60
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['planned', 'in-progress', 'completed', 'cancelled'],
    default: 'planned'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  color: {
    type: String,
    default: '#2563eb',
    validate: {
      validator: function(v) {
        return /^#[0-9A-F]{6}$/i.test(v);
      },
      message: 'Color must be a valid hex color code'
    }
  },
  emoji: {
    type: String,
    default: '📚'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    ref: 'Session'
  },
  mindMapId: {
    type: String,
    ref: 'MindMap'
  },
  quizId: {
    type: String,
    ref: 'Quiz'
  },
  tags: [{
    type: String,
    trim: true
  }],
  recurring: {
    enabled: {
      type: Boolean,
      default: false
    },
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    interval: {
      type: Number,
      default: 1
    },
    endAfter: {
      type: Number, // Number of occurrences
      default: null
    },
    endDate: {
      type: Date,
      default: null
    }
  },
  reminders: [{
    time: {
      type: Number, // Minutes before start
      required: true,
      min: 0,
      max: 1440 // 24 hours
    },
    type: {
      type: String,
      enum: ['notification', 'email', 'sms'],
      default: 'notification'
    },
    sent: {
      type: Boolean,
      default: false
    }
  }],
  metadata: {
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    },
    estimatedStudyTime: {
      type: Number, // Minutes
      default: 60
    },
    prerequisites: [{
      type: String
    }],
    learningObjectives: [{
      type: String
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
calendarSchema.index({ userId: 1, startDate: 1 });
calendarSchema.index({ userId: 1, status: 1 });
calendarSchema.index({ userId: 1, subject: 1 });
calendarSchema.index({ startDate: 1, endDate: 1 });

// Virtual for end date calculation
calendarSchema.virtual('calculatedEndDate').get(function() {
  if (this.endDate) return this.endDate;
  return new Date(this.startDate.getTime() + this.duration * 60000);
});

// Pre-save middleware to set end date if not provided
calendarSchema.pre('save', function(next) {
  if (!this.endDate) {
    this.endDate = this.calculatedEndDate;
  }
  next();
});

// Method to check if session conflicts with existing ones
calendarSchema.methods.hasConflict = async function() {
  const Calendar = this.constructor;
  const conflictingSession = await Calendar.findOne({
    userId: this.userId,
    _id: { $ne: this._id },
    status: { $ne: 'cancelled' },
    $or: [
      {
        startDate: { $lt: this.endDate },
        endDate: { $gt: this.startDate }
      }
    ]
  });
  return conflictingSession;
};

// Method to get upcoming sessions
calendarSchema.statics.getUpcoming = function(userId, limit = 10) {
  return this.find({
    userId,
    startDate: { $gte: new Date() },
    status: { $in: ['planned', 'in-progress'] }
  })
  .sort({ startDate: 1 })
  .limit(limit);
};

// Method to get sessions by date range
calendarSchema.statics.getByDateRange = function(userId, startDate, endDate) {
  return this.find({
    userId,
    startDate: { $gte: startDate },
    endDate: { $lte: endDate },
    status: { $ne: 'cancelled' }
  }).sort({ startDate: 1 });
};

module.exports = mongoose.model('Calendar', calendarSchema);
