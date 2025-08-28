const Joi = require('joi');

/**
 * Validation schemas for different API endpoints
 */
const schemas = {
  // User registration
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    name: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters',
      'any.required': 'Name is required'
    }),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      'any.required': 'Password is required'
    })
  }),

  // User login
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    })
  }),

  // Profile update
  updateProfile: Joi.object({
    name: Joi.string().min(2).max(50).optional().messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters'
    }),
    preferences: Joi.object({
      theme: Joi.string().valid('light', 'dark', 'auto').optional(),
      language: Joi.string().valid('en', 'es', 'fr', 'de').optional(),
      notifications: Joi.boolean().optional()
    }).optional()
  }),

  // Change password
  changePassword: Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required'
    }),
    newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.min': 'New password must be at least 8 characters long',
      'string.pattern.base': 'New password must contain at least one lowercase letter, one uppercase letter, and one number',
      'any.required': 'New password is required'
    })
  }),

  // Image upload
  imageUpload: Joi.object({
    sessionId: Joi.string().optional(),
    tags: Joi.string().optional()
  }),

  // Image processing
  processImage: Joi.object({
    imageId: Joi.string().required().messages({
      'any.required': 'Image ID is required'
    }),
    options: Joi.object({
      ocrMethod: Joi.string().valid('auto', 'tesseract', 'trocr', 'paddle').optional(),
      confidence: Joi.number().min(0).max(1).optional(),
      maxQuestions: Joi.number().min(1).max(20).optional(),
      difficulty: Joi.string().valid('easy', 'medium', 'hard').optional()
    }).optional()
  }),

  // Session creation/update
  session: Joi.object({
    title: Joi.string().min(1).max(200).required().messages({
      'string.min': 'Title cannot be empty',
      'string.max': 'Title cannot exceed 200 characters',
      'any.required': 'Title is required'
    }),
    description: Joi.string().max(1000).optional().messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
    tags: Joi.array().items(Joi.string().max(50)).max(20).optional().messages({
      'array.max': 'Cannot have more than 20 tags',
      'string.max': 'Tag cannot exceed 50 characters'
    }),
    status: Joi.string().valid('active', 'archived', 'draft').optional()
  }),

  // Quiz creation/update
  quiz: Joi.object({
    title: Joi.string().min(1).max(200).required().messages({
      'string.min': 'Title cannot be empty',
      'string.max': 'Title cannot exceed 200 characters',
      'any.required': 'Title is required'
    }),
    description: Joi.string().max(1000).optional().messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
    settings: Joi.object({
      timeLimit: Joi.number().min(0).max(3600).optional(),
      shuffleQuestions: Joi.boolean().optional(),
      showExplanations: Joi.boolean().optional(),
      allowRetakes: Joi.boolean().optional()
    }).optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(20).optional().messages({
      'array.max': 'Cannot have more than 20 tags',
      'string.max': 'Tag cannot exceed 50 characters'
    })
  }),

  // Quiz attempt submission
  quizAttempt: Joi.object({
    answers: Joi.array().items(Joi.number().min(0).max(3)).required().messages({
      'array.base': 'Answers must be an array',
      'any.required': 'Answers are required'
    }),
    timeSpent: Joi.number().min(0).optional()
  }),

  // Bookmark creation/update
  bookmark: Joi.object({
    refType: Joi.string().valid('session', 'quiz', 'node', 'chat', 'evidence').required().messages({
      'any.only': 'Reference type must be one of: session, quiz, node, chat, evidence',
      'any.required': 'Reference type is required'
    }),
    refId: Joi.string().required().messages({
      'any.required': 'Reference ID is required'
    }),
    title: Joi.string().max(200).optional().messages({
      'string.max': 'Title cannot exceed 200 characters'
    }),
    description: Joi.string().max(1000).optional().messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
    note: Joi.string().max(500).optional().messages({
      'string.max': 'Note cannot exceed 500 characters'
    }),
    tags: Joi.array().items(Joi.string().max(50)).max(20).optional().messages({
      'array.max': 'Cannot have more than 20 tags',
      'string.max': 'Tag cannot exceed 50 characters'
    }),
    priority: Joi.string().valid('low', 'medium', 'high').optional()
  }),

  // Chat message
  chatMessage: Joi.object({
    message: Joi.string().min(1).max(2000).required().messages({
      'string.min': 'Message cannot be empty',
      'string.max': 'Message cannot exceed 2000 characters',
      'any.required': 'Message is required'
    }),
    sessionId: Joi.string().optional(),
    messageType: Joi.string().valid('general', 'question', 'summary_request', 'quiz_request').optional()
  }),

  // Search query
  searchQuery: Joi.object({
    q: Joi.string().min(1).max(500).required().messages({
      'string.min': 'Search query cannot be empty',
      'string.max': 'Search query cannot exceed 500 characters',
      'any.required': 'Search query is required'
    }),
    type: Joi.string().valid('session', 'quiz', 'evidence', 'chat', 'all').optional(),
    limit: Joi.number().min(1).max(100).optional().messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
    page: Joi.number().min(1).optional().messages({
      'number.min': 'Page must be at least 1'
    })
  }),

  // Semantic search
  semanticSearch: Joi.object({
    q: Joi.string().min(1).max(500).required().messages({
      'string.min': 'Search query cannot be empty',
      'string.max': 'Search query cannot exceed 500 characters',
      'any.required': 'Search query is required'
    }),
    type: Joi.string().valid('session', 'quiz', 'evidence', 'chat', 'all').optional(),
    limit: Joi.number().min(1).max(50).optional().messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 50'
    }),
    threshold: Joi.number().min(0).max(1).optional().messages({
      'number.min': 'Threshold must be between 0 and 1',
      'number.max': 'Threshold must be between 0 and 1'
    })
  }),

  // Advanced search
  advancedSearch: Joi.object({
    query: Joi.string().max(500).optional().messages({
      'string.max': 'Query cannot exceed 500 characters'
    }),
    types: Joi.array().items(Joi.string().valid('session', 'quiz', 'evidence', 'chat')).optional(),
    dateRange: Joi.object({
      start: Joi.date().iso().optional(),
      end: Joi.date().iso().min(Joi.ref('start')).optional()
    }).optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(50).optional().messages({
      'array.max': 'Cannot have more than 50 tags',
      'string.max': 'Tag cannot exceed 50 characters'
    }),
    confidence: Joi.number().min(0).max(1).optional().messages({
      'number.min': 'Confidence must be between 0 and 1',
      'number.max': 'Confidence must be between 0 and 1'
    }),
    limit: Joi.number().min(1).max(100).optional().messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    })
  }),

  // Evidence update
  evidenceUpdate: Joi.object({
    text: Joi.string().max(10000).optional().messages({
      'string.max': 'Text cannot exceed 10000 characters'
    }),
    ocrConfidence: Joi.number().min(0).max(1).optional().messages({
      'number.min': 'OCR confidence must be between 0 and 1',
      'number.max': 'OCR confidence must be between 0 and 1'
    }),
    contentType: Joi.string().max(100).optional().messages({
      'string.max': 'Content type cannot exceed 100 characters'
    }),
    tags: Joi.array().items(Joi.string().max(50)).max(20).optional().messages({
      'array.max': 'Cannot have more than 20 tags',
      'string.max': 'Tag cannot exceed 50 characters'
    })
  }),

  // Pagination
  pagination: Joi.object({
    page: Joi.number().min(1).default(1).messages({
      'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().min(1).max(100).default(20).messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    })
  })
};

/**
 * Validate request data against a schema
 * @param {Object} schema - Joi validation schema
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result
 */
const validate = (schema, data) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  
  if (error) {
    const errors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    return {
      isValid: false,
      errors,
      value: null
    };
  }
  
  return {
    isValid: true,
    errors: [],
    value
  };
};

/**
 * Validate request body
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const result = validate(schema, req.body);
    
    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.errors
      });
    }
    
    req.validatedBody = result.value;
    next();
  };
};

/**
 * Validate request query parameters
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const result = validate(schema, req.query);
    
    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.errors
      });
    }
    
    req.validatedQuery = result.value;
    next();
  };
};

/**
 * Validate request parameters
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const result = validate(schema, req.params);
    
    if (!result.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.errors
      });
    }
    
    req.validatedParams = result.value;
    next();
  };
};

/**
 * Sanitize HTML content to prevent XSS
 * @param {string} html - HTML string to sanitize
 * @returns {string} Sanitized HTML
 */
const sanitizeHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '');
};

/**
 * Validate file upload
 * @param {Object} file - Multer file object
 * @param {Array} allowedTypes - Allowed MIME types
 * @param {number} maxSize - Maximum file size in bytes
 * @returns {Object} Validation result
 */
const validateFile = (file, allowedTypes = ['image/jpeg', 'image/png', 'image/webp'], maxSize = 10 * 1024 * 1024) => {
  if (!file) {
    return {
      isValid: false,
      error: 'No file provided'
    };
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    return {
      isValid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
    };
  }
  
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size too large. Maximum size: ${Math.round(maxSize / (1024 * 1024))}MB`
    };
  }
  
  return {
    isValid: true,
    error: null
  };
};

module.exports = {
  schemas,
  validate,
  validateBody,
  validateQuery,
  validateParams,
  sanitizeHtml,
  validateFile
};
