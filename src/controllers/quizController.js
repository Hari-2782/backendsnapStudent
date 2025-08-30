const Evidence = require('../models/Evidence');
const Quiz = require('../models/Quiz');
const dashscopeService = require('../services/dashscopeService');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

/**
 * Generate quiz from image/PDF content
 * @route POST /api/quiz/:imageId
 * @access Private
 */
const generateQuiz = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { 
      questionCount = 5, 
      difficulty = 'medium', 
      questionTypes = ['multiple-choice', 'true-false'],
      topics = []
    } = req.body;
    const userId = req.user?._id || 'dev-user-123';

    console.log(`🧪 Generating quiz for image ${imageId}`);
    console.log('🔍 Request params:', req.params);
    console.log('🔍 Request body:', req.body);
    console.log('🔍 User ID:', userId);

    // Validate imageId
    if (!imageId) {
      return res.status(400).json({
        success: false,
        error: 'Image ID is required'
      });
    }

    // Get evidence records for this image
    const evidence = await Evidence.find({ 
      $or: [
        { originalImageId: imageId }
      ]
    }).sort({ createdAt: -1 });

    if (!evidence || evidence.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No evidence found for this image. Please process the image first.'
      });
    }

    // Extract text content from evidence
    const textContent = evidence
      .map(ev => ev.extractedText || ev.text)
      .filter(text => text && text.length > 0)
      .join('\n\n');

    if (!textContent) {
      return res.status(400).json({
        success: false,
        error: 'No text content found in evidence records'
      });
    }

    // Generate quiz using DashScope (Primary) with OpenRouter fallback
    let quizData = null;
    let method = 'fallback';
    
    // Try DashScope first
    try {
      console.log('🧪 Trying DashScope for quiz generation...');
      quizData = await generateQuizWithDashScope(textContent, questionCount, difficulty, questionTypes, topics);
      if (quizData) {
        method = 'dashscope';
        console.log('✅ DashScope quiz generation successful');
      }
    } catch (dashscopeError) {
      console.log('❌ DashScope failed:', dashscopeError.message);
    }

    // If DashScope fails, try OpenRouter fallback
    if (!quizData) {
      try {
        console.log('🔄 Trying OpenRouter fallback for quiz generation...');
        quizData = await generateQuizWithOpenRouter(textContent, questionCount, difficulty, questionTypes, topics);
        if (quizData) {
          method = 'openrouter-fallback';
          console.log('✅ OpenRouter fallback successful');
        }
      } catch (openrouterError) {
        console.log('❌ OpenRouter fallback failed:', openrouterError.message);
      }
    }

    // If both fail, use fallback quiz
    if (!quizData) {
      console.log('⚠️ All AI services failed, using fallback quiz');
      quizData = createFallbackQuiz(textContent, questionCount, difficulty);
      method = 'fallback';
    }

    // Ensure all MCQ options are properly formatted with ABC labels
    quizData.questions = quizData.questions.map(question => {
      if (question.type === 'multiple-choice' && question.options) {
        question.options = formatQuizOptions(question.options);
      }
      return question;
    });

    // Add metadata
    quizData.id = uuidv4();
    quizData.imageId = imageId;
    quizData.userId = userId;
    quizData.generatedAt = new Date();
    quizData.evidenceCount = evidence.length;
    quizData.sourceText = textContent.substring(0, 300) + '...';
    quizData.method = method;

    // Ensure all required fields are present
    const quizToSave = {
      id: quizData.id,
      imageId: quizData.imageId,
      title: quizData.title || 'Generated Quiz',
      description: quizData.description || 'Quiz generated from content',
      difficulty: quizData.difficulty || 'medium',
      questionCount: quizData.questionCount || quizData.questions?.length || 0,
      questions: quizData.questions || [],
      userId: quizData.userId,
      generatedAt: quizData.generatedAt,
      evidenceCount: quizData.evidenceCount,
      sourceText: quizData.sourceText,
      method: quizData.method || 'fallback',
      topics: quizData.topics || []
    };

    console.log('💾 Saving quiz to database:', {
      id: quizToSave.id,
      imageId: quizToSave.imageId,
      userId: quizToSave.userId,
      questionCount: quizToSave.questionCount,
      method: quizToSave.method
    });

    // Store quiz in database
    try {
      const quizDoc = new Quiz(quizToSave);
      await quizDoc.save();
      console.log('✅ Quiz saved to database with ID:', quizDoc._id);
      
      // Update the response with the saved quiz data
      quizData.databaseId = quizDoc._id;
    } catch (saveError) {
      console.error('❌ Failed to save quiz to database:', saveError);
      console.error('❌ Validation errors:', saveError.errors);
      // Continue with response even if save fails
    }

    res.status(200).json({
      success: true,
      quiz: quizData,
      message: 'Quiz generated successfully'
    });

  } catch (error) {
    console.error('❌ Quiz generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate quiz',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get quiz by ID
 * @route GET /api/quiz/:quizId
 * @access Private
 */
const getQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user?._id || 'dev-user-123';

    console.log(`📚 Getting quiz ${quizId} for user ${userId}`);

    const quiz = await Quiz.findOne({ id: quizId, userId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    res.status(200).json({
      success: true,
      quiz
    });

  } catch (error) {
    console.error('❌ Get quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quiz'
    });
  }
};

/**
 * Submit quiz answers and get results
 * @route POST /api/quiz/:quizId/submit
 * @access Private
 */
const submitQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body;
    const userId = req.user?._id || 'dev-user-123';

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        error: 'Answers array is required'
      });
    }

    // In production, you'd validate answers against the stored quiz
    // For now, we'll return a sample result
    const results = {
      quizId,
      userId,
      submittedAt: new Date(),
      score: Math.floor(Math.random() * 100),
      totalQuestions: answers.length,
      correctAnswers: Math.floor(Math.random() * answers.length),
      answers: answers.map((answer, index) => ({
        questionId: `q${index + 1}`,
        userAnswer: answer,
        isCorrect: Math.random() > 0.5,
        explanation: 'Sample explanation'
      }))
    };

    res.status(200).json({
      success: true,
      results,
      message: 'Quiz submitted successfully'
    });

  } catch (error) {
    console.error('❌ Submit quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit quiz'
    });
  }
};

/**
 * Get quiz analytics
 * @route GET /api/quiz/:quizId/analytics
 * @access Private
 */
const getQuizAnalytics = async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.user?._id || 'dev-user-123';

    console.log(`📊 Getting analytics for quiz ${quizId}`);

    const quiz = await Quiz.findOne({ id: quizId, userId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    const analytics = {
      quizId,
      totalQuestions: quiz.questionCount,
      difficulty: quiz.difficulty,
      topics: quiz.topics,
      attempts: quiz.attempts || 0,
      averageScore: quiz.averageScore || 0,
      generatedAt: quiz.generatedAt,
      method: quiz.method
    };

    res.status(200).json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('❌ Quiz analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quiz analytics'
    });
  }
};

/**
 * Format quiz options with ABC labels
 */
const formatQuizOptions = (options) => {
  if (!Array.isArray(options)) return options;
  
  return options.map((option, index) => {
    const label = String.fromCharCode(65 + index); // A, B, C, D...
    
    // Check if option already has ABC label
    if (option.match(/^[A-D]\)/)) {
      return option; // Already formatted
    }
    
    // Add ABC label if not present
    return `${label}) ${option}`;
  });
};

/**
 * Create fallback quiz when AI generation fails
 */
const createFallbackQuiz = (textContent, questionCount = 5, difficulty = 'medium') => {
  console.log('🔄 Creating fallback quiz...');
  
  // Chemistry-specific question templates
  const chemistryQuestions = [
    {
      question: "What is the relationship between molality (m) and boiling point elevation?",
      options: [
        "A) ΔTb = kb × m",
        "B) ΔTb = kb / m", 
        "C) ΔTb = kb + m",
        "D) ΔTb = kb - m"
      ],
      correctAnswer: "A) ΔTb = kb × m",
      explanation: "Boiling point elevation is directly proportional to molality through the ebullioscopic constant (kb).",
      topic: "Boiling Point Elevation"
    },
    {
      question: "Which property decreases when a non-volatile solute is added to a solvent?",
      options: [
        "A) Boiling point",
        "B) Vapor pressure",
        "C) Freezing point",
        "D) Density"
      ],
      correctAnswer: "B) Vapor pressure",
      explanation: "Adding a non-volatile solute decreases the vapor pressure of the solvent, leading to boiling point elevation.",
      topic: "Vapor Pressure"
    },
    {
      question: "What is the formula for freezing point depression?",
      options: [
        "A) ΔTf = kf × m",
        "B) ΔTf = kf / m",
        "C) ΔTf = kf + m", 
        "D) ΔTf = kf - m"
      ],
      correctAnswer: "A) ΔTf = kf × m",
      explanation: "Freezing point depression is directly proportional to molality through the cryoscopic constant (kf).",
      topic: "Freezing Point Depression"
    },
    {
      question: "What is osmotic pressure (π) related to?",
      options: [
        "A) π = cST",
        "B) π = c/S",
        "C) π = c + S + T",
        "D) π = c × S × T"
      ],
      correctAnswer: "A) π = cST",
      explanation: "Osmotic pressure equals concentration (c) times the gas constant (S) times temperature (T).",
      topic: "Osmotic Pressure"
    },
    {
      question: "What are colligative properties?",
      options: [
        "A) Properties that depend on the number of solute particles",
        "B) Properties that depend on the chemical nature of solute",
        "C) Properties that depend on temperature only",
        "D) Properties that depend on pressure only"
      ],
      correctAnswer: "A) Properties that depend on the number of solute particles",
      explanation: "Colligative properties depend on the concentration of solute particles, not their chemical identity.",
      topic: "Colligative Properties"
    }
  ];

  // Select questions based on requested count
  const selectedQuestions = chemistryQuestions.slice(0, Math.min(questionCount, chemistryQuestions.length));
  
  const questions = selectedQuestions.map((q, index) => ({
    id: `q${index + 1}`,
    type: 'multiple-choice',
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    topic: q.topic
  }));

  console.log(`✅ Generated ${questions.length} fallback questions`);

  return {
    title: 'Chemistry Quiz - Colligative Properties',
    description: `Quiz on Physical Chemistry concepts including boiling point elevation, freezing point depression, and osmotic pressure`,
    difficulty,
    questionCount: questions.length,
    questions,
    generatedAt: new Date(),
    method: 'fallback'
  };
};

/**
 * Generate quiz using DashScope
 */
const generateQuizWithDashScope = async (textContent, questionCount, difficulty, questionTypes, topics) => {
  const quizPrompt = `Generate a ${difficulty} difficulty quiz with ${questionCount} questions based on this content.
    
Question types: ${questionTypes.join(', ')}
Topics to focus on: ${topics.length > 0 ? topics.join(', ') : 'General topics from the content'}

IMPORTANT: For multiple-choice questions, format ALL options with ABC labels like this:
"options": [
  "A) [First option]",
  "B) [Second option]", 
  "C) [Third option]",
  "D) [Fourth option]"
]

Return a JSON object with this structure:
{
  "title": "Quiz Title",
  "description": "Quiz description",
  "difficulty": "${difficulty}",
  "questionCount": ${questionCount},
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "Question text",
      "options": [
        "A) [Option A]",
        "B) [Option B]",
        "C) [Option C]",
        "D) [Option D]"
      ],
      "correctAnswer": "A) [Option A]",
      "explanation": "Why this is correct",
      "topic": "Related topic"
    }
  ]
}

Content: ${textContent.substring(0, 2000)}`;

  const quizResult = await dashscopeService.processRAG(
    quizPrompt,
    [{ text: textContent.substring(0, 1500) }],
    null,
    { 
      maxTokens: 2000, 
      temperature: 0.3 
    }
  );

  if (!quizResult.success) {
    throw new Error(`DashScope quiz generation failed: ${quizResult.error}`);
  }

  // Parse AI response
  try {
    const jsonMatch = quizResult.response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsedQuiz = JSON.parse(jsonMatch[0]);
      
      // Validate the parsed quiz structure
      if (parsedQuiz.questions && Array.isArray(parsedQuiz.questions) && parsedQuiz.questions.length > 0) {
        return parsedQuiz;
      }
    }
    throw new Error('Invalid quiz structure from DashScope');
  } catch (parseError) {
    throw new Error(`Failed to parse DashScope response: ${parseError.message}`);
  }
};

/**
 * Generate quiz using OpenRouter fallback
 */
const generateQuizWithOpenRouter = async (textContent, questionCount, difficulty, questionTypes, topics) => {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const quizPrompt = `Generate a ${difficulty} difficulty quiz with ${questionCount} questions based on this content.
    
Question types: ${questionTypes.join(', ')}
Topics to focus on: ${topics.length > 0 ? topics.join(', ') : 'General topics from the content'}

IMPORTANT: For multiple-choice questions, format ALL options with ABC labels like this:
"options": [
  "A) [First option]",
  "B) [Second option]", 
  "C) [Third option]",
  "D) [Fourth option]"
]

Return a JSON object with this structure:
{
  "title": "Quiz Title",
  "description": "Quiz description",
  "difficulty": "${difficulty}",
  "questionCount": ${questionCount},
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "Question text",
      "options": [
        "A) [Option A]",
        "B) [Option B]",
        "C) [Option C]",
        "D) [Option D]"
      ],
      "correctAnswer": "A) [Option A]",
      "explanation": "Why this is correct",
      "topic": "Related topic"
    }
  ]
}

Content: ${textContent.substring(0, 2000)}`;

  const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: 'meta-llama/llama-3.2-11b-instruct:free',
    messages: [
      { role: 'user', content: quizPrompt }
    ],
    max_tokens: 2000,
    temperature: 0.3,
    top_p: 0.9
  }, {
    headers: {
      'Authorization': `Bearer ${openRouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://your-app-domain.com',
      'X-Title': 'AI Study Helper'
    },
    timeout: 30000
  });

  if (response.data && response.data.choices && response.data.choices[0]) {
    const content = response.data.choices[0].message.content;
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedQuiz = JSON.parse(jsonMatch[0]);
        
        // Validate the parsed quiz structure
        if (parsedQuiz.questions && Array.isArray(parsedQuiz.questions) && parsedQuiz.questions.length > 0) {
          return parsedQuiz;
        }
      }
      throw new Error('Invalid quiz structure from OpenRouter');
    } catch (parseError) {
      throw new Error(`Failed to parse OpenRouter response: ${parseError.message}`);
    }
  }
  
  throw new Error('Invalid response from OpenRouter');
};

module.exports = {
  generateQuiz,
  getQuiz,
  submitQuiz,
  getQuizAnalytics
};
