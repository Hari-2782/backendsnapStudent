const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'fill-in-blank', 'short-answer'],
    default: 'multiple-choice'
  },
  question: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    required: function() {
      return this.type === 'multiple-choice';
    }
  },
  correctAnswer: {
    type: String,
    required: true
  },
  explanation: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  }
});

const quizSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  quizId: {
    type: String,
    required: false, // Make it optional to avoid breaking existing data
    index: true
  },
  imageId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  questionCount: {
    type: Number,
    required: true,
    min: 1,
    max: 50
  },
  questions: {
    type: [questionSchema],
    required: true,
    validate: {
      validator: function(questions) {
        return questions.length > 0;
      },
      message: 'Quiz must have at least one question'
    }
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  evidenceCount: {
    type: Number,
    default: 0
  },
  sourceText: {
    type: String,
    default: ''
  },
  method: {
    type: String,
    enum: ['ai-generated', 'fallback', 'manual', 'dashscope', 'openrouter-fallback'],
    default: 'ai-generated'
  },
  topics: {
    type: [String],
    default: []
  },
  tags: {
    type: [String],
    default: []
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0
  },
  averageScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
quizSchema.index({ userId: 1, createdAt: -1 });
quizSchema.index({ imageId: 1, userId: 1 });
quizSchema.index({ topics: 1 });
quizSchema.index({ difficulty: 1 });
quizSchema.index({ status: 1 });

// Virtual for formatted creation date
quizSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Virtual for quiz statistics
quizSchema.virtual('stats').get(function() {
  return {
    totalQuestions: this.questionCount,
    totalAttempts: this.attempts,
    averageScore: this.averageScore,
    difficulty: this.difficulty,
    topics: this.topics
  };
});

// Method to update quiz statistics
quizSchema.methods.updateStats = function(score) {
  this.attempts += 1;
  
  // Calculate new average score
  const totalScore = this.averageScore * (this.attempts - 1) + score;
  this.averageScore = totalScore / this.attempts;
  
  return this.save();
};

// Method to add tags
quizSchema.methods.addTags = function(newTags) {
  const uniqueTags = [...new Set([...this.tags, ...newTags])];
  this.tags = uniqueTags;
  return this.save();
};

// Static method to get quizzes by user
quizSchema.statics.getByUser = function(userId, options = {}) {
  const query = { userId };
  
  if (options.difficulty) {
    query.difficulty = options.difficulty;
  }
  
  if (options.topics && options.topics.length > 0) {
    query.topics = { $in: options.topics };
  }
  
  if (options.status) {
    query.status = options.status;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .skip(options.skip || 0);
};

// Static method to get quiz statistics
quizSchema.statics.getStats = function(userId) {
  return this.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalQuizzes: { $sum: 1 },
        totalQuestions: { $sum: '$questionCount' },
        totalAttempts: { $sum: '$attempts' },
        averageScore: { $avg: '$averageScore' },
        difficultyBreakdown: {
          $push: '$difficulty'
        },
        topicBreakdown: {
          $push: '$topics'
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Quiz', quizSchema);
