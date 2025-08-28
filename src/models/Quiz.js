const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['mcq', 'short-answer', 'flashcard', 'true-false', 'fill-blank', 'matching', 'essay'],
    default: 'mcq'
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    text: String,
    imageUrl: String,
    audioUrl: String,
    videoUrl: String
  },
  options: [{
    type: String,
    trim: true
  }],
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed, // Can be string, number, or array depending on question type
    required: true
  },
  explanation: {
    type: String,
    trim: true
  },
  hints: [{
    type: String,
    trim: true
  }],
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  points: {
    type: Number,
    default: 1,
    min: 0
  },
  timeLimit: {
    type: Number, // Seconds
    default: 60
  },
  tags: [{
    type: String,
    trim: true
  }],
  metadata: {
    sourceImageId: String,
    evidenceIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence'
    }],
    processingMethod: {
      type: String,
      enum: ['vision-enhanced', 'text-based', 'manual', 'ai-generated'],
      default: 'text-based'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8
    },
    lastReviewed: Date,
    reviewCount: {
      type: Number,
      default: 0
    }
  }
}, { _id: false });

const quizSchema = new mongoose.Schema({
  quizId: {
    type: String,
    required: true,
    unique: true,
    default: () => `quiz${Math.random().toString(36).substr(2, 9)}`
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
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
  difficulty: {
    type: String,
    enum: ['beginner', 'easy', 'medium', 'hard', 'expert'],
    default: 'medium'
  },
  totalQuestions: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  timeLimit: {
    type: Number, // Total minutes
    default: null
  },
  passingScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 70
  },
  maxAttempts: {
    type: Number,
    default: 3,
    min: 1
  },
  shuffleQuestions: {
    type: Boolean,
    default: true
  },
  shuffleOptions: {
    type: Boolean,
    default: true
  },
  showExplanation: {
    type: Boolean,
    default: true
  },
  showHints: {
    type: Boolean,
    default: true
  },
  showScore: {
    type: Boolean,
    default: true
  },
  questions: [questionSchema],
  categories: [{
    name: {
      type: String,
      required: true
    },
    description: String,
    questionCount: Number,
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard']
    }
  }],
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
  imageId: {
    type: String
  },
  tags: [{
    type: String,
    trim: true
  }],
  settings: {
    allowReview: {
      type: Boolean,
      default: true
    },
    allowRetake: {
      type: Boolean,
      default: true
    },
    showProgress: {
      type: Boolean,
      default: true
    },
    adaptiveDifficulty: {
      type: Boolean,
      default: false
    },
    randomizeOrder: {
      type: Boolean,
      default: true
    }
  },
  statistics: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    averageTime: {
      type: Number, // Minutes
      default: 0
    },
    difficultyDistribution: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 }
    }
  },
  metadata: {
    version: {
      type: String,
      default: '1.0.0'
    },
    createdBy: {
      type: String,
      required: true
    },
    sourceType: {
      type: String,
      enum: ['manual', 'ai-generated', 'imported', 'converted'],
      default: 'manual'
    },
    processingMethod: {
      type: String,
      enum: ['vision-enhanced', 'text-based', 'manual'],
      default: 'manual'
    },
    estimatedStudyTime: {
      type: Number, // Minutes
      default: 30
    },
    prerequisites: [{
      type: String
    }],
    learningObjectives: [{
      type: String
    }],
    lastModified: {
      type: Date,
      default: Date.now
    },
    modificationCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
quizSchema.index({ userId: 1, createdAt: -1 });
quizSchema.index({ userId: 1, subject: 1 });
quizSchema.index({ userId: 1, topic: 1 });
quizSchema.index({ userId: 1, difficulty: 1 });
quizSchema.index({ title: 'text', description: 'text', topic: 'text' });

// Pre-save middleware to update statistics
quizSchema.pre('save', function(next) {
  // Update total questions count
  this.totalQuestions = this.questions.length;
  
  // Calculate difficulty distribution
  this.statistics.difficultyDistribution = {
    easy: this.questions.filter(q => q.difficulty === 'easy').length,
    medium: this.questions.filter(q => q.difficulty === 'medium').length,
    hard: this.questions.filter(q => q.difficulty === 'hard').length
  };
  
  // Calculate total points
  const totalPoints = this.questions.reduce((sum, q) => sum + q.points, 0);
  
  next();
});

// Method to add question
quizSchema.methods.addQuestion = function(questionData) {
  const newQuestion = {
    id: questionData.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    type: questionData.type || 'mcq',
    question: questionData.question,
    content: questionData.content || {},
    options: questionData.options || [],
    correctAnswer: questionData.correctAnswer,
    explanation: questionData.explanation || '',
    hints: questionData.hints || [],
    difficulty: questionData.difficulty || 'medium',
    points: questionData.points || 1,
    timeLimit: questionData.timeLimit || 60,
    tags: questionData.tags || [],
    metadata: {
      ...questionData.metadata,
      processingMethod: questionData.metadata?.processingMethod || 'manual',
      confidence: questionData.metadata?.confidence || 0.8
    }
  };
  
  this.questions.push(newQuestion);
  return newQuestion;
};

// Method to get questions by difficulty
quizSchema.methods.getQuestionsByDifficulty = function(difficulty) {
  return this.questions.filter(q => q.difficulty === difficulty);
};

// Method to get random questions
quizSchema.methods.getRandomQuestions = function(count) {
  const shuffled = [...this.questions].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, this.questions.length));
};

// Method to calculate score
quizSchema.methods.calculateScore = function(answers) {
  let correctAnswers = 0;
  let totalPoints = 0;
  
  this.questions.forEach(question => {
    const userAnswer = answers[question.id];
    if (userAnswer !== undefined) {
      totalPoints += question.points;
      
      if (this.isAnswerCorrect(question, userAnswer)) {
        correctAnswers += question.points;
      }
    }
  });
  
  return {
    score: totalPoints > 0 ? Math.round((correctAnswers / totalPoints) * 100) : 0,
    correctAnswers,
    totalPoints,
    passed: totalPoints > 0 ? (correctAnswers / totalPoints) * 100 >= this.passingScore : false
  };
};

// Method to check if answer is correct
quizSchema.methods.isAnswerCorrect = function(question, userAnswer) {
  switch (question.type) {
    case 'mcq':
    case 'flashcard':
      return question.correctAnswer === userAnswer;
    case 'true-false':
      return question.correctAnswer === userAnswer;
    case 'short-answer':
    case 'fill-blank':
      return question.correctAnswer.toLowerCase().trim() === userAnswer.toLowerCase().trim();
    case 'matching':
      return JSON.stringify(question.correctAnswer) === JSON.stringify(userAnswer);
    default:
      return false;
  }
};

// Method to export as JSON
quizSchema.methods.exportAsJSON = function() {
  return {
    quizId: this.quizId,
    title: this.title,
    description: this.description,
    subject: this.subject,
    topic: this.topic,
    difficulty: this.difficulty,
    totalQuestions: this.totalQuestions,
    timeLimit: this.timeLimit,
    passingScore: this.passingScore,
    maxAttempts: this.maxAttempts,
    questions: this.questions,
    categories: this.categories,
    tags: this.tags,
    settings: this.settings,
    statistics: this.statistics,
    metadata: this.metadata,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('Quiz', quizSchema);
