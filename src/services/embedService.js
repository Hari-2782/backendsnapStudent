const nlpService = require('./nlpService');

class EmbedService {
  constructor() {
    this.embeddingDimension = 384; // all-MiniLM-L6-v2 dimension
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbeddings(text) {
    try {
      return await nlpService.generateEmbeddings(text);
    } catch (error) {
      console.error('Embedding generation failed:', error);
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Generate fallback embedding using simple hashing
   */
  generateFallbackEmbedding(text) {
    const vector = new Array(this.embeddingDimension).fill(0);
    let hash = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Distribute hash across vector dimensions
    for (let i = 0; i < this.embeddingDimension; i++) {
      vector[i] = Math.sin(hash + i) * 0.1;
    }
    
    return vector;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  calculateCosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have same dimension');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    
    return dotProduct / (normA * normB);
  }

  /**
   * Find similar content using vector similarity
   */
  async findSimilarContent(queryEmbedding, contentEmbeddings, threshold = 0.7) {
    const similarities = [];
    
    for (const content of contentEmbeddings) {
      const similarity = this.calculateCosineSimilarity(queryEmbedding, content.vector);
      if (similarity >= threshold) {
        similarities.push({
          contentId: content.id,
          similarity,
          metadata: content.metadata
        });
      }
    }
    
    // Sort by similarity (highest first)
    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Batch generate embeddings for multiple texts
   */
  async generateBatchEmbeddings(texts) {
    const embeddings = [];
    
    for (let i = 0; i < texts.length; i++) {
      try {
        const embedding = await this.generateEmbeddings(texts[i]);
        embeddings.push({
          id: i,
          text: texts[i],
          vector: embedding,
          metadata: {
            length: texts[i].length,
            generatedAt: new Date()
          }
        });
      } catch (error) {
        console.error(`Failed to generate embedding for text ${i}:`, error);
        // Add fallback embedding
        embeddings.push({
          id: i,
          text: texts[i],
          vector: this.generateFallbackEmbedding(texts[i]),
          metadata: {
            length: texts[i].length,
            generatedAt: new Date(),
            fallback: true
          }
        });
      }
    }
    
    return embeddings;
  }

  /**
   * Normalize vector to unit length
   */
  normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    
    return vector.map(val => val / magnitude);
  }

  /**
   * Average multiple embeddings (useful for combining related content)
   */
  averageEmbeddings(embeddings) {
    if (embeddings.length === 0) return null;
    
    const dimension = embeddings[0].length;
    const averaged = new Array(dimension).fill(0);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        averaged[i] += embedding[i];
      }
    }
    
    // Normalize
    for (let i = 0; i < dimension; i++) {
      averaged[i] /= embeddings.length;
    }
    
    return this.normalizeVector(averaged);
  }
}

module.exports = new EmbedService();
