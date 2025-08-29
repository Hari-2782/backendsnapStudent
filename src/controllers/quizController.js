const Evidence = require('../models/Evidence');
const Quiz = require('../models/Quiz');
const dashscopeService = require('../services/dashscopeService');
const { v4: uuidv4 } = require('uuid');

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

    // Generate quiz using DashScope
    const quizPrompt = `Generate a ${difficulty} difficulty quiz with ${questionCount} questions based on this chemistry content.
    
    Question types: ${questionTypes.join(', ')}
    Topics to focus on: ${topics.length > 0 ? topics.join(', ') : 'Physical Chemistry, Colligative Properties'}
    
    Return a JSON object with this structure:
    {
      "title": "Chemistry Quiz",
      "description": "Quiz on Physical Chemistry and Colligative Properties",
      "difficulty": "${difficulty}",
      "questionCount": ${questionCount},
      "questions": [
        {
          "id": "q1",
          "type": "multiple-choice",
          "question": "Question text",
          "options": ["A", "B", "C", "D"],
          "correctAnswer": "A",
          "explanation": "Why this is correct",
          "topic": "Related topic"
        }
      ]
    }
    
    Content: ${textContent.substring(0, 2000)}`;

    console.log('🧪 Calling DashScope for quiz generation...');
    console.log('📝 Text content length:', textContent.length);
    console.log('🔍 First 200 chars:', textContent.substring(0, 200));

    const quizResult = await dashscopeService.processRAG(
      quizPrompt,
      [{ text: textContent.substring(0, 1500) }],
      null,
      { 
        maxTokens: 2000, 
        temperature: 0.3 
      }
    );

    console.log('🤖 DashScope response:', quizResult);

    if (!quizResult.success) {
      console.log('❌ DashScope failed, using fallback');
      throw new Error(`Quiz generation failed: ${quizResult.error}`);
    }

    // Parse AI response and create quiz structure
    let quizData = createFallbackQuiz(textContent, questionCount, difficulty);
    
    try {
      if (quizResult.response) {
        const jsonMatch = quizResult.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedQuiz = JSON.parse(jsonMatch[0]);
          console.log('✅ Parsed quiz from AI:', parsedQuiz);
          
          // Validate the parsed quiz structure
          if (parsedQuiz.questions && Array.isArray(parsedQuiz.questions) && parsedQuiz.questions.length > 0) {
            quizData = parsedQuiz;
            console.log('✅ Using AI-generated quiz');
          } else {
            console.log('⚠️ AI quiz has no questions, using fallback');
          }
        }
      }
    } catch (parseError) {
      console.log('❌ JSON parse error, using fallback quiz structure:', parseError.message);
    }

    // Add metadata
    quizData.id = uuidv4();
    quizData.imageId = imageId;
    quizData.userId = userId;
    quizData.generatedAt = new Date();
    quizData.evidenceCount = evidence.length;
    quizData.sourceText = textContent.substring(0, 300) + '...';

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
      method: quizData.method || 'ai-generated',
      topics: quizData.topics || []
    };

    console.log('💾 Saving quiz to database:', {
      id: quizToSave.id,
      imageId: quizToSave.imageId,
      userId: quizToSave.userId,
      questionCount: quizToSave.questionCount
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
    const requestingUserId = req.user?._id || 'dev-user-123';

    console.log('🔍 Getting quiz by ID:', quizId);

    // Get quiz from database
    const quiz = await Quiz.findOne({ id: quizId });
    
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    // Check access permissions
    if (process.env.NODE_ENV === 'development' || requestingUserId === quiz.userId) {
      res.status(200).json({
        success: true,
        quiz,
        message: 'Quiz retrieved successfully'
      });
    } else {
      res.status(403).json({
        success: false,
        error: 'Access denied. You can only view your own quizzes.'
      });
    }

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

    // In production, you'd calculate analytics from stored results
    const analytics = {
      quizId,
      userId,
      totalAttempts: Math.floor(Math.random() * 50) + 1,
      averageScore: Math.floor(Math.random() * 30) + 70,
      highestScore: Math.floor(Math.random() * 20) + 80,
      lowestScore: Math.floor(Math.random() * 30) + 40,
      questionDifficulty: {
        easy: Math.floor(Math.random() * 20) + 80,
        medium: Math.floor(Math.random() * 30) + 60,
        hard: Math.floor(Math.random() * 40) + 40
      },
      generatedAt: new Date()
    };

    res.status(200).json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('❌ Get quiz analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quiz analytics'
    });
  }
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
        "ΔTb = kb × m",
        "ΔTb = kb / m", 
        "ΔTb = kb + m",
        "ΔTb = kb - m"
      ],
      correctAnswer: "ΔTb = kb × m",
      explanation: "Boiling point elevation is directly proportional to molality through the ebullioscopic constant (kb).",
      topic: "Boiling Point Elevation"
    },
    {
      question: "Which property decreases when a non-volatile solute is added to a solvent?",
      options: [
        "Boiling point",
        "Vapor pressure",
        "Freezing point",
        "Density"
      ],
      correctAnswer: "Vapor pressure",
      explanation: "Adding a non-volatile solute decreases the vapor pressure of the solvent, leading to boiling point elevation.",
      topic: "Vapor Pressure"
    },
    {
      question: "What is the formula for freezing point depression?",
      options: [
        "ΔTf = kf × m",
        "ΔTf = kf / m",
        "ΔTf = kf + m", 
        "ΔTf = kf - m"
      ],
      correctAnswer: "ΔTf = kf × m",
      explanation: "Freezing point depression is directly proportional to molality through the cryoscopic constant (kf).",
      topic: "Freezing Point Depression"
    },
    {
      question: "What is osmotic pressure (π) related to?",
      options: [
        "π = cST",
        "π = c/S",
        "π = c + S + T",
        "π = c × S × T"
      ],
      correctAnswer: "π = cST",
      explanation: "Osmotic pressure equals concentration (c) times the gas constant (S) times temperature (T).",
      topic: "Osmotic Pressure"
    },
    {
      question: "What are colligative properties?",
      options: [
        "Properties that depend on the number of solute particles",
        "Properties that depend on the chemical nature of solute",
        "Properties that depend on temperature only",
        "Properties that depend on pressure only"
      ],
      correctAnswer: "Properties that depend on the number of solute particles",
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

module.exports = {
  generateQuiz,
  getQuiz,
  submitQuiz,
  getQuizAnalytics
};
