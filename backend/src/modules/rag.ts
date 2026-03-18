/**
 * Module 5: RAG Pipeline
 * Document processing, embedding, and retrieval
 */

import { EventEmitter } from 'events';
import { Document, RetrievalResult, RAGConfig, DocumentType } from '@ai-interview/shared';
import { generateUUID, createLogger } from '@ai-interview/shared';

const logger = createLogger('RAGPipeline');

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

export class RAGPipeline extends EventEmitter {
  private config: RAGConfig;
  private documents: Map<string, Document> = new Map();
  private chunks: Map<string, DocumentChunk> = new Map();
  private documentIndex: Map<string, string[]> = new Map(); // docId -> chunkIds
  private embeddingCache: Map<string, number[]> = new Map();

  constructor(config: Partial<RAGConfig> = {}) {
    super();
    this.config = {
      chunkSize: 500,
      chunkOverlap: 50,
      topK: 5,
      embeddingModel: 'bge-small-zh',
      hybridSearch: true,
      rerank: true,
      ...config,
    };
  }

  /**
   * Initialize the RAG pipeline
   */
  async initialize(): Promise<void> {
    logger.info('RAG pipeline initialized');
    logger.info(`Config: chunkSize=${this.config.chunkSize}, topK=${this.config.topK}`);
  }

  /**
   * Add a document to the knowledge base
   */
  async addDocument(
    name: string,
    type: DocumentType,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<Document> {
    const docId = generateUUID();
    const now = Date.now();

    const document: Document = {
      id: docId,
      name,
      type,
      content,
      metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.documents.set(docId, document);

    // Chunk the document
    const chunkIds = await this.chunkDocument(docId, content);
    this.documentIndex.set(docId, chunkIds);

    // Generate embeddings
    await this.generateEmbeddings(chunkIds);

    logger.info(`Document added: ${name} (${chunkIds.length} chunks)`);
    this.emit('document-added', { documentId: docId, chunkCount: chunkIds.length });

    return document;
  }

  /**
   * Remove a document from the knowledge base
   */
  removeDocument(documentId: string): boolean {
    const chunkIds = this.documentIndex.get(documentId);
    if (chunkIds) {
      chunkIds.forEach((chunkId) => this.chunks.delete(chunkId));
      this.documentIndex.delete(documentId);
    }
    
    const removed = this.documents.delete(documentId);
    
    if (removed) {
      logger.info(`Document removed: ${documentId}`);
      this.emit('document-removed', { documentId });
    }

    return removed;
  }

  /**
   * Search for relevant content
   */
  async search(query: string, topK?: number): Promise<RetrievalResult[]> {
    const k = topK || this.config.topK;
    logger.debug(`Searching for: ${query.substring(0, 50)}...`);

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Hybrid search: BM25 + Dense vector
    let results: RetrievalResult[] = [];

    if (this.config.hybridSearch) {
      const bm25Results = this.bm25Search(query, k * 2);
      const denseResults = this.denseSearch(queryEmbedding, k * 2);
      
      // Combine results with reciprocal rank fusion
      results = this.reciprocalRankFuse(bm25Results, denseResults);
    } else {
      results = this.denseSearch(queryEmbedding, k);
    }

    // Rerank if enabled
    if (this.config.rerank && results.length > k) {
      results = await this.rerank(query, results, k);
    } else {
      results = results.slice(0, k);
    }

    logger.debug(`Found ${results.length} results`);
    return results;
  }

  /**
   * Retrieve context for a question
   */
  async retrieveContext(question: string, maxTokens: number = 1000): Promise<string[]> {
    const results = await this.search(question);
    
    const contexts: string[] = [];
    let totalTokens = 0;

    for (const result of results) {
      // Rough token estimation (4 chars ≈ 1 token for English, 2 for Chinese)
      const tokenCount = result.content.length / 3;
      
      if (totalTokens + tokenCount > maxTokens) {
        break;
      }

      contexts.push(result.content);
      totalTokens += tokenCount;
    }

    return contexts;
  }

  /**
   * Chunk a document
   */
  private async chunkDocument(documentId: string, content: string): Promise<string[]> {
    const chunkIds: string[] = [];
    
    // Simple chunking by character count (can be improved with semantic splitting)
    const { chunkSize, chunkOverlap } = this.config;
    
    let start = 0;
    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      const chunkContent = content.substring(start, end).trim();
      
      if (chunkContent.length > 0) {
        const chunkId = generateUUID();
        const chunk: DocumentChunk = {
          id: chunkId,
          documentId,
          content: chunkContent,
          metadata: {
            start,
            end,
            chunkIndex: chunkIds.length,
          },
        };
        
        this.chunks.set(chunkId, chunk);
        chunkIds.push(chunkId);
      }
      
      start = end - chunkOverlap;
      if (start >= content.length) break;
    }

    return chunkIds;
  }

  /**
   * Generate embeddings for chunks
   */
  private async generateEmbeddings(chunkIds: string[]): Promise<void> {
    for (const chunkId of chunkIds) {
      const chunk = this.chunks.get(chunkId);
      if (chunk && !chunk.embedding) {
        chunk.embedding = await this.generateEmbedding(chunk.content);
      }
    }
  }

  /**
   * Generate embedding for text (mock implementation)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const cacheKey = `${this.config.embeddingModel}:${text.substring(0, 100)}`;
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Mock embedding (384 dimensions for bge-small)
    // In production, use actual embedding model
    const embedding = new Array(384).fill(0).map(() => Math.random() * 2 - 1);
    
    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }

    this.embeddingCache.set(cacheKey, embedding);
    return embedding;
  }

  /**
   * BM25 keyword search
   */
  private bm25Search(query: string, topK: number): RetrievalResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    
    const scores: Map<string, number> = new Map();

    for (const [chunkId, chunk] of this.chunks) {
      let score = 0;
      const contentLower = chunk.content.toLowerCase();
      
      for (const term of queryTerms) {
        const termCount = (contentLower.match(new RegExp(term, 'g')) || []).length;
        if (termCount > 0) {
          // Simplified BM25 scoring
          score += termCount * (1 / chunk.content.length);
        }
      }

      if (score > 0) {
        scores.set(chunkId, score);
      }
    }

    // Sort by score and return top K
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([chunkId, score]) => {
        const chunk = this.chunks.get(chunkId);
        return {
          document_id: chunk?.documentId || '',
          content: chunk?.content || '',
          score,
          metadata: chunk?.metadata,
        };
      });
  }

  /**
   * Dense vector similarity search
   */
  private denseSearch(queryEmbedding: number[], topK: number): RetrievalResult[] {
    const scores: Map<string, number> = new Map();

    for (const [chunkId, chunk] of this.chunks) {
      if (!chunk.embedding) continue;

      // Cosine similarity
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;

      for (let i = 0; i < queryEmbedding.length; i++) {
        dotProduct += queryEmbedding[i] * chunk.embedding[i];
        normA += queryEmbedding[i] * queryEmbedding[i];
        normB += chunk.embedding[i] * chunk.embedding[i];
      }

      const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      
      if (similarity > 0.1) { // Threshold
        scores.set(chunkId, similarity);
      }
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([chunkId, score]) => {
        const chunk = this.chunks.get(chunkId);
        return {
          document_id: chunk?.documentId || '',
          content: chunk?.content || '',
          score,
          metadata: chunk?.metadata,
        };
      });
  }

  /**
   * Reciprocal Rank Fusion for combining search results
   */
  private reciprocalRankFuse(
    results1: RetrievalResult[],
    results2: RetrievalResult[],
    k: number = 60
  ): RetrievalResult[] {
    const fusedScores: Map<string, number> = new Map();

    const fuseResults = (results: RetrievalResult[], weight: number = 1) => {
      results.forEach((result, index) => {
        const key = `${result.document_id}:${result.content.substring(0, 50)}`;
        const currentScore = fusedScores.get(key) || 0;
        fusedScores.set(key, currentScore + weight / (k + index + 1));
      });
    };

    fuseResults(results1, 1.0);
    fuseResults(results2, 1.0);

    // Convert back to results
    const chunkMap = new Map(
      Array.from(this.chunks.values()).map((c) => [`${c.documentId}:${c.content.substring(0, 50)}`, c])
    );

    return Array.from(fusedScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.topK * 2)
      .map(([key, score]) => {
        const chunk = chunkMap.get(key);
        return {
          document_id: chunk?.documentId || '',
          content: chunk?.content || '',
          score,
          metadata: chunk?.metadata,
        };
      });
  }

  /**
   * Rerank results using cross-encoder (mock implementation)
   */
  private async rerank(query: string, results: RetrievalResult[], topK: number): Promise<RetrievalResult[]> {
    // Mock reranking - in production use actual cross-encoder
    const reranked = results.map((r) => ({
      ...r,
      score: r.score * (0.9 + Math.random() * 0.2), // Add some variance
    }));

    return reranked.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Get all documents
   */
  getDocuments(): Document[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get document by ID
   */
  getDocument(documentId: string): Document | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Get statistics
   */
  getStats(): { documentCount: number; chunkCount: number; embeddingCacheSize: number } {
    return {
      documentCount: this.documents.size,
      chunkCount: this.chunks.size,
      embeddingCacheSize: this.embeddingCache.size,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.documents.clear();
    this.chunks.clear();
    this.documentIndex.clear();
    this.embeddingCache.clear();
    logger.info('RAG pipeline cleared');
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.clear();
    this.removeAllListeners();
    logger.info('RAG pipeline destroyed');
  }
}
