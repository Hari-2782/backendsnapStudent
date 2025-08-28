const Evidence = require('../models/Evidence');
const sharp = require('sharp');

class EvidenceService {
  /**
   * Create evidence record from OCR result
   */
  async createEvidence(evidenceData, userId) {
    try {
      const evidence = new Evidence({
        ...evidenceData,
        userId
      });
      
      const savedEvidence = await evidence.save();
      return savedEvidence;
    } catch (error) {
      console.error('Failed to create evidence:', error);
      throw error;
    }
  }

  /**
   * Create cropped image for evidence
   */
  async createCroppedImage(imageBuffer, bbox, options = {}) {
    try {
      const { x, y, width, height } = bbox;
      
      // Add padding around the crop
      const padding = options.padding || 10;
      const paddedX = Math.max(0, x - padding);
      const paddedY = Math.max(0, y - padding);
      const paddedWidth = Math.min(width + (padding * 2), imageBuffer.width - paddedX);
      const paddedHeight = Math.min(height + (padding * 2), imageBuffer.height - paddedY);
      
      // Crop the image
      const croppedBuffer = await sharp(imageBuffer)
        .extract({
          left: paddedX,
          top: paddedY,
          width: paddedWidth,
          height: paddedHeight
        })
        .png()
        .toBuffer();
      
      return croppedBuffer;
    } catch (error) {
      console.error('Failed to create cropped image:', error);
      throw error;
    }
  }

  /**
   * Get evidence by ID
   */
  async getEvidenceById(evidenceId) {
    try {
      const evidence = await Evidence.findById(evidenceId);
      if (!evidence) {
        throw new Error('Evidence not found');
      }
      return evidence;
    } catch (error) {
      console.error('Failed to get evidence:', error);
      throw error;
    }
  }

  /**
   * Get evidence by image ID
   */
  async getEvidenceByImageId(imageId) {
    try {
      const evidence = await Evidence.find({ originalImageId: imageId })
        .sort({ createdAt: -1 });
      return evidence;
    } catch (error) {
      console.error('Failed to get evidence by image ID:', error);
      throw error;
    }
  }

  /**
   * Update evidence confidence
   */
  async updateEvidenceConfidence(evidenceId, newConfidence, userId) {
    try {
      const evidence = await Evidence.findById(evidenceId);
      if (!evidence) {
        throw new Error('Evidence not found');
      }
      
      evidence.ocrConfidence = newConfidence;
      evidence.corrections.push({
        userId,
        originalText: evidence.text,
        correctedText: evidence.text, // No text change, just confidence update
        confidence: newConfidence,
        correctedAt: new Date(),
        reason: 'Confidence adjustment'
      });
      
      await evidence.save();
      return evidence;
    } catch (error) {
      console.error('Failed to update evidence confidence:', error);
      throw error;
    }
  }

  /**
   * Correct evidence text
   */
  async correctEvidenceText(evidenceId, correctedText, userId, reason = 'Manual correction') {
    try {
      const evidence = await Evidence.findById(evidenceId);
      if (!evidence) {
        throw new Error('Evidence not found');
      }
      
      const originalText = evidence.text;
      evidence.text = correctedText;
      evidence.ocrConfidence = 1.0; // Manual corrections get highest confidence
      evidence.status = 'corrected';
      
      evidence.corrections.push({
        userId,
        originalText,
        correctedText,
        confidence: 1.0,
        correctedAt: new Date(),
        reason
      });
      
      await evidence.save();
      return evidence;
    } catch (error) {
      console.error('Failed to correct evidence text:', error);
      throw error;
    }
  }

  /**
   * Get evidence statistics
   */
  async getEvidenceStats(userId = null) {
    try {
      const query = userId ? { userId } : {};
      
      const stats = await Evidence.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalEvidence: { $sum: 1 },
            averageConfidence: { $avg: '$ocrConfidence' },
            highConfidence: {
              $sum: { $cond: [{ $gte: ['$ocrConfidence', 0.8] }, 1, 0] }
            },
            mediumConfidence: {
              $sum: { $cond: [{ $and: [{ $gte: ['$ocrConfidence', 0.6] }, { $lt: ['$ocrConfidence', 0.8] }] }, 1, 0] }
            },
            lowConfidence: {
              $sum: { $cond: [{ $lt: ['$ocrConfidence', 0.6] }, 1, 0] }
            }
          }
        }
      ]);
      
      return stats[0] || {
        totalEvidence: 0,
        averageConfidence: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        lowConfidence: 0
      };
    } catch (error) {
      console.error('Failed to get evidence stats:', error);
      throw error;
    }
  }

  /**
   * Search evidence by text
   */
  async searchEvidence(query, userId = null, limit = 20) {
    try {
      const searchQuery = {
        text: { $regex: query, $options: 'i' }
      };
      
      if (userId) {
        searchQuery.userId = userId;
      }
      
      const evidence = await Evidence.find(searchQuery)
        .sort({ ocrConfidence: -1, createdAt: -1 })
        .limit(limit);
      
      return evidence;
    } catch (error) {
      console.error('Failed to search evidence:', error);
      throw error;
    }
  }

  /**
   * Get evidence by content type
   */
  async getEvidenceByContentType(contentType, userId = null, limit = 20) {
    try {
      const query = { contentType };
      if (userId) {
        query.userId = userId;
      }
      
      const evidence = await Evidence.find(query)
        .sort({ createdAt: -1 })
        .limit(limit);
      
      return evidence;
    } catch (error) {
      console.error('Failed to get evidence by content type:', error);
      throw error;
    }
  }

  /**
   * Delete evidence (soft delete)
   */
  async deleteEvidence(evidenceId, userId) {
    try {
      const evidence = await Evidence.findById(evidenceId);
      if (!evidence) {
        throw new Error('Evidence not found');
      }
      
      // Soft delete by changing status
      evidence.status = 'archived';
      await evidence.save();
      
      return { success: true, message: 'Evidence archived successfully' };
    } catch (error) {
      console.error('Failed to delete evidence:', error);
      throw error;
    }
  }

  /**
   * Bulk update evidence
   */
  async bulkUpdateEvidence(updates) {
    try {
      const bulkOps = updates.map(update => ({
        updateOne: {
          filter: { _id: update.evidenceId },
          update: { $set: update.fields }
        }
      }));
      
      const result = await Evidence.bulkWrite(bulkOps);
      return result;
    } catch (error) {
      console.error('Failed to bulk update evidence:', error);
      throw error;
    }
  }

  /**
   * Get evidence usage analytics
   */
  async getEvidenceUsageAnalytics(userId = null, days = 30) {
    try {
      const query = {
        createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) }
      };
      
      if (userId) {
        query.userId = userId;
      }
      
      const analytics = await Evidence.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 },
            avgConfidence: { $avg: '$ocrConfidence' }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      return analytics;
    } catch (error) {
      console.error('Failed to get evidence usage analytics:', error);
      throw error;
    }
  }
}

module.exports = new EvidenceService();
