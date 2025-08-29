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
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  actualDuration: {
    type: Number, // Actual time spent in minutes
    min: 0,
    default: 0
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
calendarSchema.index({ userId: 1, isCompleted: 1 });
calendarSchema.index({ startDate: 1, endDate: 1 });

// Virtual for end date calculation
calendarSchema.virtual('calculatedEndDate').get(function() {
  if (this.endDate) return this.endDate;
  return new Date(this.startDate.getTime() + this.duration * 60000);
});

// Virtual for progress percentage
calendarSchema.virtual('progressPercentage').get(function() {
  if (this.isCompleted) return 100;
  if (this.status === 'cancelled') return 0;
  if (this.status === 'planned') return 0;
  if (this.status === 'in-progress') return 50;
  return 0;
});

// Virtual for formatted duration
calendarSchema.virtual('formattedDuration').get(function() {
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});

// Virtual for formatted actual duration
calendarSchema.virtual('formattedActualDuration').get(function() {
  if (!this.actualDuration) return 'Not started';
  const hours = Math.floor(this.actualDuration / 60);
  const minutes = this.actualDuration % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});

// Pre-save middleware to set end date if not provided
calendarSchema.pre('save', function(next) {
  if (!this.endDate) {
    this.endDate = this.calculatedEndDate;
  }
  
  // Update completedAt when marking as completed
  if (this.isCompleted && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  // Update status when marking as completed
  if (this.isCompleted && this.status !== 'completed') {
    this.status = 'completed';
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

// Method to mark task as completed
calendarSchema.methods.markCompleted = function(actualDuration = null) {
  this.isCompleted = true;
  this.status = 'completed';
  this.completedAt = new Date();
  if (actualDuration !== null) {
    this.actualDuration = actualDuration;
  }
  return this.save();
};

// Method to mark task as incomplete
calendarSchema.methods.markIncomplete = function() {
  this.isCompleted = false;
  this.status = 'planned';
  this.completedAt = null;
  this.actualDuration = 0;
  return this.save();
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

// Method to get weekly progress statistics
calendarSchema.statics.getWeeklyProgress = function(userId, weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        startDate: { $gte: weekStart, $lt: weekEnd },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completedTasks: { $sum: { $cond: ['$isCompleted', 1, 0] } },
        totalPlannedDuration: { $sum: '$duration' },
        totalActualDuration: { $sum: { $ifNull: ['$actualDuration', 0] } },
        totalPlannedTime: { $sum: '$duration' },
        completedTime: { $sum: { $cond: ['$isCompleted', '$duration', 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        totalTasks: 1,
        completedTasks: 1,
        totalPlannedDuration: 1,
        totalActualDuration: 1,
        totalPlannedTime: 1,
        completedTime: 1,
        completionRate: {
          $multiply: [
            { $divide: ['$completedTasks', '$totalTasks'] },
            100
          ]
        },
        progressPercentage: {
          $multiply: [
            { $divide: ['$completedTime', '$totalPlannedTime'] },
            100
          ]
        }
      }
    }
  ]);
};

// Method to get monthly progress statistics
calendarSchema.statics.getMonthlyProgress = function(userId, monthStart) {
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        startDate: { $gte: monthStart, $lt: monthEnd },
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completedTasks: { $sum: { $cond: ['$isCompleted', 1, 0] } },
        totalPlannedDuration: { $sum: '$duration' },
        totalActualDuration: { $sum: { $ifNull: ['$actualDuration', 0] } },
        totalPlannedTime: { $sum: '$duration' },
        completedTime: { $sum: { $cond: ['$isCompleted', '$duration', 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        totalTasks: 1,
        completedTasks: 1,
        totalPlannedDuration: 1,
        totalActualDuration: 1,
        totalPlannedTime: 1,
        completedTime: 1,
        completionRate: {
          $multiply: [
            { $divide: ['$completedTasks', '$totalTasks'] },
            100
          ]
        },
        progressPercentage: {
          $multiply: [
            { $divide: ['$completedTime', '$totalPlannedTime'] },
            100
          ]
        }
      }
    }
  ]);
};

// Method to get overall user progress
calendarSchema.statics.getUserProgress = function(userId) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: null,
        totalTasks: { $sum: 1 },
        completedTasks: { $sum: { $cond: ['$isCompleted', 1, 0] } },
        totalPlannedDuration: { $sum: '$duration' },
        totalActualDuration: { $sum: { $ifNull: ['$actualDuration', 0] } },
        totalPlannedTime: { $sum: '$duration' },
        completedTime: { $sum: { $cond: ['$isCompleted', '$duration', 0] } },
        subjects: { $addToSet: '$subject' },
        topics: { $addToSet: '$topic' }
      }
    },
    {
      $project: {
        _id: 0,
        totalTasks: 1,
        completedTasks: 1,
        totalPlannedDuration: 1,
        totalActualDuration: 1,
        totalPlannedTime: 1,
        completedTime: 1,
        subjects: 1,
        topics: 1,
        completionRate: {
          $multiply: [
            { $divide: ['$completedTasks', '$totalTasks'] },
            100
          ]
        },
        progressPercentage: {
          $multiply: [
            { $divide: ['$completedTime', '$totalPlannedTime'] },
            100
          ]
        },
        efficiency: {
          $cond: [
            { $gt: ['$totalActualDuration', 0] },
            {
              $multiply: [
                { $divide: ['$totalPlannedDuration', '$totalActualDuration'] },
                100
              ]
            },
            0
          ]
        }
      }
    }
  ]);
};

// Method to get tasks by subject with progress
calendarSchema.statics.getTasksBySubject = function(userId, subject) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        subject: subject,
        status: { $ne: 'cancelled' }
      }
    },
    {
      $group: {
        _id: '$topic',
        totalTasks: { $sum: 1 },
        completedTasks: { $sum: { $cond: ['$isCompleted', 1, 0] } },
        totalPlannedDuration: { $sum: '$duration' },
        completedDuration: { $sum: { $cond: ['$isCompleted', '$duration', 0] } }
      }
    },
    {
      $project: {
        _id: 1,
        topic: '$_id',
        totalTasks: 1,
        completedTasks: 1,
        totalPlannedDuration: 1,
        completedDuration: 1,
        completionRate: {
          $multiply: [
            { $divide: ['$completedTasks', '$totalTasks'] },
            100
          ]
        },
        progressPercentage: {
          $multiply: [
            { $divide: ['$completedDuration', '$totalPlannedDuration'] },
            100
          ]
        }
      }
    },
    { $sort: { progressPercentage: -1 } }
  ]);
};

module.exports = mongoose.model('Calendar', calendarSchema);
