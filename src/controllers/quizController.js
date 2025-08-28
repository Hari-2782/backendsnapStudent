const Quiz = require('../models/Quiz');
const Evidence = require('../models/Evidence');
const ApiResponse = require('../utils/apiResponse');
const TitleGenerator = require('../utils/titleGenerator');

class QuizController {
  /**
   * Generate quiz from image evidence
   */
  async generateQuizFromImage(req, res) {
    try {
      const { imageId } = req.params;
      const userId = req.user?._id || req.query.userId || 'dev-user-123';
      
      if (!imageId) {
        return res.status(400).json(ApiResponse.error('imageId is required'));
      }

      console.log(`🎯 Generating quiz for image ${imageId}`);

      // 1. Get evidence from the image
      console.log(`🔍 Searching for evidence with imageId: ${imageId}`);
      
      // Try multiple search strategies
      let evidence = await Evidence.find({ originalImageId: imageId });
      
      if (!evidence || evidence.length === 0) {
        console.log(`⚠️ No evidence found with originalImageId: ${imageId}`);
        
        // Try alternative search methods
        evidence = await Evidence.find({ 
          $or: [
            { originalImageId: imageId },
            { imageUrl: { $regex: imageId, $options: 'i' } }
          ]
        });
        
        if (!evidence || evidence.length === 0) {
          // Check if imageId might be a Cloudinary public ID
          const cloudinaryId = imageId.replace('ai-study-helper/', '');
          evidence = await Evidence.find({ 
            $or: [
              { originalImageId: cloudinaryId },
              { originalImageId: `ai-study-helper/${cloudinaryId}` }
            ]
          });
        }
      }

      if (!evidence || evidence.length === 0) {
        return res.status(404).json(ApiResponse.notFound(`No evidence found for image: ${imageId}. Please ensure the image has been processed first.`));
      }

      console.log(`✅ Found ${evidence.length} evidence records for image: ${imageId}`);

      // 2. Extract text content for quiz generation
      const textContent = evidence.map(ev => ev.text).join(' ');
      console.log(`📝 Extracted text content length: ${textContent.length} characters`);
      console.log(`📋 Sample text: ${textContent.substring(0, 200)}...`);
      
      // 3. Extract key concepts for quiz metadata
      const concepts = this.extractKeyConcepts(textContent);
      console.log(`🔍 Extracted concepts: ${concepts.slice(0, 5).join(', ')}`);
      
      // 4. Generate quiz questions
      const questions = await this.generateQuestions(textContent, evidence);

      // 5. Create quiz object
      const quiz = {
        quizId: `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: TitleGenerator.generateQuizTitle('Image Analysis'),
        description: `Quiz generated from image content analysis`,
        subject: 'Image Analysis', // ✅ Required field at root level
        topic: 'Extracted Content', // ✅ Required field at root level
        difficulty: 'medium',
        totalQuestions: questions.length,
        timeLimit: 30, // 30 minutes
        passingScore: 70,
        maxAttempts: 3,
        shuffleQuestions: true,
        shuffleOptions: true,
        showExplanation: true,
        showHints: true,
        showScore: true,
        questions: questions,
        userId: userId, // ✅ Required field at root level
        sessionId: null, // Optional
        mindMapId: null, // Optional
        metadata: {
          version: '1.0.0',
          createdBy: userId, // ✅ Required field
          sourceType: 'ai-generated',
          processingMethod: 'vision-enhanced',
          estimatedStudyTime: 30,
          sourceImageId: imageId,
          evidenceIds: evidence.map(ev => ev._id),
          confidence: 0.8,
          tags: ['image-analysis', 'ocr', 'quiz', 'auto-generated'],
          learningObjectives: [`Understand the concepts of ${concepts.slice(0, 3).join(', ')}`],
          lastModified: new Date(),
          modificationCount: 0
        }
      };

      // 6. Save to database
      const savedQuiz = await Quiz.create(quiz);

      return res.json(ApiResponse.success('Quiz generated successfully', savedQuiz));

    } catch (error) {
      console.error('❌ Quiz generation error:', error);
      return res.status(500).json(ApiResponse.serverError('Quiz generation failed', error));
    }
  }

  /**
   * Generate questions from text content
   */
  async generateQuestions(textContent, evidence) {
    try {
      // For now, generate sample questions based on content
      // In a real implementation, you'd call an AI service
      const questions = [];
      
      // Extract key concepts from text
      const concepts = this.extractKeyConcepts(textContent);
      
      // Generate MCQ questions based on actual concepts
      concepts.slice(0, 3).forEach((concept, index) => {
        questions.push({
          id: `q${index + 1}`,
          type: 'mcq',
          question: `Which of the following best describes the concept of "${concept}" as shown in the image?`,
          options: [
            `A fundamental principle related to ${concept}`,
            `An advanced application of ${concept}`,
            `The basic definition of ${concept}`,
            `A common misconception about ${concept}`
          ],
          correctAnswer: 2, // Basic definition is usually correct
          explanation: `The image content shows the fundamental concept of ${concept} and its basic definition.`,
          difficulty: 'medium',
          points: 2,
          timeLimit: 60
        });
      });

      // Generate short answer question
      questions.push({
        id: `q${questions.length + 1}`,
        type: 'short-answer',
        question: `Based on the image content, explain the main concepts and their relationships.`,
        correctAnswer: `The image shows ${concepts.slice(0, 3).join(', ')} and demonstrates how these concepts are interconnected in the study material.`,
        explanation: `The extracted text reveals key concepts including ${concepts.slice(0, 3).join(', ')} and their fundamental relationships.`,
        difficulty: 'medium',
        points: 5,
        timeLimit: 120
      });

      // Generate flashcard
      questions.push({
        id: `q${questions.length + 1}`,
        type: 'flashcard',
        question: `What is the primary concept being illustrated in this image?`,
        options: [
          `A complex theory involving ${concepts[0] || 'content'}`,
          `The fundamental principle of ${concepts[0] || 'learning'}`,
          `An advanced application of ${concepts[1] || 'knowledge'}`,
          `A basic introduction to ${concepts[2] || 'study'}`
        ],
        correctAnswer: 1, // Fundamental principle is usually correct
        explanation: `The image demonstrates the fundamental principle of ${concepts[0] || 'the main concept'} as a core learning objective.`,
        difficulty: 'easy',
        points: 1,
        timeLimit: 45
      });

      return questions;
  } catch (error) {
      console.error('❌ Question generation error:', error);
      // Return fallback questions
      return [
        {
          id: 'q1',
          type: 'mcq',
          question: 'What type of content is shown in this image?',
          options: ['Text', 'Diagram', 'Chart', 'All of the above'],
          correctAnswer: 3,
          explanation: 'The image contains multiple types of content.'
        }
      ];
    }
  }

  /**
   * Extract key concepts from text
   */
  extractKeyConcepts(text) {
    try {
      if (!text || text.length < 10) {
        return ['content', 'analysis', 'information'];
      }

      // Simple concept extraction - in real implementation, use NLP
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const concepts = [];
      
      sentences.forEach((sentence, index) => {
        const words = sentence.trim().split(/\s+/)
          .filter(word => word.length > 3 && !['this', 'that', 'with', 'from', 'have', 'been', 'they', 'will', 'would', 'could', 'should'].includes(word.toLowerCase()))
          .slice(0, 5);
        
        if (words.length > 0) {
          concepts.push(...words);
        }
      });
      
      // Remove duplicates and limit to top concepts
      const uniqueConcepts = [...new Set(concepts)].slice(0, 8);
      
      // If no concepts found, use fallback
      if (uniqueConcepts.length === 0) {
        return ['content', 'analysis', 'information', 'study', 'learning'];
      }
      
      return uniqueConcepts;
    } catch (error) {
      console.error('❌ Concept extraction failed:', error);
      return ['content', 'analysis', 'information'];
    }
  }

  /**
   * Get quiz by ID
   */
  async getQuiz(req, res) {
    try {
      const { quizId } = req.params;
      
      const quiz = await Quiz.findOne({ quizId });
    if (!quiz) {
        return res.status(404).json(ApiResponse.notFound('Quiz not found'));
      }

      return res.json(ApiResponse.success('Quiz retrieved successfully', quiz));

  } catch (error) {
      console.error('❌ Get quiz error:', error);
      return res.status(500).json(ApiResponse.serverError('Failed to get quiz', error));
    }
  }

  /**
   * Get all quizzes for user
   */
  async getUserQuizzes(req, res) {
    try {
      const userId = req.user?._id || req.query.userId || 'dev-user-123';
      
      const quizzes = await Quiz.find({ 'metadata.createdBy': userId })
        .sort({ createdAt: -1 })
        .limit(50);

      return res.json(ApiResponse.success('Quizzes retrieved successfully', quizzes));

  } catch (error) {
      console.error('❌ Get user quizzes error:', error);
      return res.status(500).json(ApiResponse.serverError('Failed to get quizzes', error));
    }
  }
}

module.exports = new QuizController();
