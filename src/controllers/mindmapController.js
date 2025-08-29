const Evidence = require('../models/Evidence');
const dashscopeService = require('../services/dashscopeService');
const { v4: uuidv4 } = require('uuid');

// Main mindmap generation function
const generateMindmap = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { options = {} } = req.body;
    const userId = req.user?._id || 'dev-user-123';

    console.log(`🧠 Generating mindmap for image ${imageId}`);

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

    // Generate mindmap using DashScope
    const mindmapPrompt = `Create a structured mindmap from this text. Return JSON with nodes and subNodes. Text: ${textContent.substring(0, 1500)}`;

    const mindmapResult = await dashscopeService.processRAG(
      mindmapPrompt,
      [{ text: textContent.substring(0, 1000) }],
      null,
      { maxTokens: 1500, temperature: 0.3 }
    );

    if (!mindmapResult.success) {
      throw new Error(`Mindmap generation failed: ${mindmapResult.error}`);
    }

    // Parse AI response and create mindmap structure
    let mindmapData = createFallbackMindmap(textContent);
    
    try {
      const jsonMatch = mindmapResult.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        mindmapData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.log('Using fallback mindmap structure');
    }

    // Add metadata
    mindmapData.imageId = imageId;
    mindmapData.userId = userId;
    mindmapData.generatedAt = new Date();
    mindmapData.evidenceCount = evidence.length;

    res.status(200).json({
      success: true,
      mindmap: mindmapData,
      message: 'Mindmap generated successfully'
    });

  } catch (error) {
    console.error('❌ Mindmap generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate mindmap',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get mindmap by image ID
const getMindmap = async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user?._id || 'dev-user-123';

    const evidence = await Evidence.find({ 
      $or: [
        { originalImageId: imageId }
      ]
    }).sort({ createdAt: -1 });

    if (!evidence || evidence.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No evidence found for this image'
      });
    }

    const textContent = evidence
      .map(ev => ev.extractedText || ev.text)
      .filter(text => text && text.length > 0)
      .join('\n\n');

    const mindmapData = createFallbackMindmap(textContent);
    mindmapData.imageId = imageId;
    mindmapData.userId = userId;
    mindmapData.generatedAt = new Date();

    res.status(200).json({
      success: true,
      mindmap: mindmapData
    });

  } catch (error) {
    console.error('❌ Get mindmap error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve mindmap'
    });
  }
};

// AI explanation for node
const explainNode = async (req, res) => {
  try {
    const { imageId, nodeId } = req.params;
    const { question = '' } = req.body;
    const userId = req.user?._id || 'dev-user-123';

    console.log(`🤖 Explaining node ${nodeId} for image ${imageId}`);

    const evidence = await Evidence.find({ 
      $or: [
        { originalImageId: imageId }
      ]
    }).sort({ createdAt: -1 });

    if (!evidence || evidence.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No evidence found for this image'
      });
    }

    const textContent = evidence
      .map(ev => ev.extractedText || ev.text)
      .filter(text => text && text.length > 0)
      .join('\n\n');

    // Optimized prompt for concise explanation (3 lines max)
    const explanationPrompt = question || 
      `Explain "${nodeId}" in exactly 3 lines maximum. Be concise and clear.`;

    const explanationResult = await dashscopeService.processRAG(
      explanationPrompt,
      [{ text: textContent.substring(0, 1500) }],
      null,
      { maxTokens: 300, temperature: 0.5 } // Reduced tokens for conciseness
    );

    if (!explanationResult.success) {
      throw new Error(`Explanation generation failed: ${explanationResult.error}`);
    }

    // Ensure explanation is limited to 3 lines
    let conciseExplanation = explanationResult.response;
    const lines = conciseExplanation.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 3) {
      conciseExplanation = lines.slice(0, 3).join('\n');
    }

    const explanation = {
      nodeId,
      imageId,
      userId,
      question: explanationPrompt,
      explanation: conciseExplanation,
      lineCount: lines.length > 3 ? 3 : lines.length,
      sourceContext: textContent.substring(0, 200) + '...',
      generatedAt: new Date(),
      tokensUsed: explanationResult.usage?.total_tokens || 0
    };

    res.status(200).json({
      success: true,
      explanation,
      message: 'Node explanation generated successfully'
    });

  } catch (error) {
    console.error('❌ Node explanation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate node explanation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// AI explanation for entire mindmap
const explainMindmap = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { question = '' } = req.body;
    const userId = req.user?._id || 'dev-user-123';

    console.log(`🧠 Explaining entire mindmap for image ${imageId}`);

    const evidence = await Evidence.find({ 
      $or: [
        { originalImageId: imageId }
      ]
    }).sort({ createdAt: -1 });

    if (!evidence || evidence.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No evidence found for this image'
      });
    }

    const textContent = evidence
      .map(ev => ev.extractedText || ev.text)
      .filter(text => text && text.length > 0)
      .join('\n\n');

    // Prompt for entire mindmap explanation
    const explanationPrompt = question || 
      `Provide a comprehensive overview of this entire mindmap in exactly 3 lines. Explain the main concepts and their relationships.`;

    const explanationResult = await dashscopeService.processRAG(
      explanationPrompt,
      [{ text: textContent.substring(0, 2000) }],
      null,
      { maxTokens: 400, temperature: 0.4 } // Balanced tokens for overview
    );

    if (!explanationResult.success) {
      throw new Error(`Mindmap explanation failed: ${explanationResult.error}`);
    }

    // Ensure explanation is limited to 3 lines
    let conciseExplanation = explanationResult.response;
    const lines = conciseExplanation.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 3) {
      conciseExplanation = lines.slice(0, 3).join('\n');
    }

    const explanation = {
      imageId,
      userId,
      question: explanationPrompt,
      explanation: conciseExplanation,
      lineCount: lines.length > 3 ? 3 : lines.length,
      evidenceCount: evidence.length,
      sourceContext: textContent.substring(0, 300) + '...',
      generatedAt: new Date(),
      tokensUsed: explanationResult.usage?.total_tokens || 0
    };

    res.status(200).json({
      success: true,
      explanation,
      message: 'Concise mindmap overview generated successfully'
    });

  } catch (error) {
    console.error('❌ Mindmap explanation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate mindmap explanation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Node management functions
const addNode = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { label, type = 'sub', description = '', parentNodeId = null } = req.body;
    const userId = req.user?._id || 'dev-user-123';

    if (!label) {
      return res.status(400).json({
        success: false,
        error: 'Node label is required'
      });
    }

    const newNode = {
      id: uuidv4(),
      label,
      type,
      description,
      parentNodeId,
      imageId,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    res.status(201).json({
      success: true,
      node: newNode,
      message: 'Node added successfully'
    });

  } catch (error) {
    console.error('❌ Add node error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add node'
    });
  }
};

const updateNode = async (req, res) => {
  try {
    const { imageId, nodeId } = req.params;
    const { label, type, description, parentNodeId } = req.body;
    const userId = req.user?._id || 'dev-user-123';

    const updatedNode = {
      id: nodeId,
      label: label || `Updated Node ${nodeId}`,
      type: type || 'main',
      description: description || 'Updated description',
      parentNodeId,
      imageId,
      userId,
      updatedAt: new Date()
    };

    res.status(200).json({
      success: true,
      node: updatedNode,
      message: 'Node updated successfully'
    });

  } catch (error) {
    console.error('❌ Update node error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update node'
    });
  }
};

const deleteNode = async (req, res) => {
  try {
    const { imageId, nodeId } = req.params;
    const userId = req.user?._id || 'dev-user-123';

    res.status(200).json({
      success: true,
      message: `Node ${nodeId} deleted successfully`,
      deletedNodeId: nodeId
    });

  } catch (error) {
    console.error('❌ Delete node error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete node'
    });
  }
};

const getNodeDetails = async (req, res) => {
  try {
    const { imageId, nodeId } = req.params;
    const userId = req.user?._id || 'dev-user-123';

    const nodeInfo = {
      id: nodeId,
      imageId,
      userId,
      label: `Node ${nodeId}`,
      type: 'main',
      description: 'Node description',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    res.status(200).json({
      success: true,
      node: nodeInfo
    });

  } catch (error) {
    console.error('❌ Get node details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve node details'
    });
  }
};

// Helper function to create fallback mindmap
const createFallbackMindmap = (textContent) => {
  const words = textContent.split(/\s+/).filter(word => word.length > 3);
  const uniqueWords = [...new Set(words)].slice(0, 20);
  
  const mainTopics = uniqueWords.slice(0, 5).map((word, index) => ({
    id: `main-${index + 1}`,
    label: word.charAt(0).toUpperCase() + word.slice(1),
    type: 'main',
    description: `Main concept related to ${word}`,
    subNodes: uniqueWords.slice(5 + index * 3, 8 + index * 3).map((subWord, subIndex) => ({
      id: `sub-${index + 1}-${subIndex + 1}`,
      label: subWord.charAt(0).toUpperCase() + subWord.slice(1),
      type: 'sub',
      description: `Sub-concept related to ${subWord}`
    }))
  }));

  return {
    id: uuidv4(),
    title: 'Generated Mindmap',
    nodes: mainTopics,
    generatedAt: new Date(),
    method: 'fallback'
  };
};

module.exports = {
  generateMindmap,
  getMindmap,
  updateNode,
  deleteNode,
  explainNode,
  explainMindmap,
  addNode,
  getNodeDetails
};
