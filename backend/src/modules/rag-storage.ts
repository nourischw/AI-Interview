/**
 * IndexedDB Storage for RAG
 * Persistent local storage for documents and embeddings
 */

import { createLogger, generateUUID } from '@ai-interview/shared';

const logger = createLogger('RAGStorage');

const DB_NAME = 'ai-interview-rag';
const DB_VERSION = 1;

export interface StoredDocument {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'markdown';
  content: string;
  metadata: Record<string, any>;
  chunks: StoredChunk[];
  createdAt: number;
  updatedAt: number;
}

export interface StoredChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  index: number;
}

/**
 * RAG Storage Manager using IndexedDB
 */
export class RAGStorage {
  private db: IDBDatabase | null = null;
  private isOpen: boolean = false;

  /**
   * Initialize IndexedDB connection
   */
  async initialize(): Promise<void> {
    if (this.isOpen) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isOpen = true;
        logger.info('IndexedDB opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        logger.info('Creating object stores...');

        // Documents store
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('name', 'name', { unique: false });
          docStore.createIndex('type', 'type', { unique: false });
          docStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Chunks store
        if (!db.objectStoreNames.contains('chunks')) {
          const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
          chunkStore.createIndex('documentId', 'documentId', { unique: false });
          chunkStore.createIndex('embedding', 'embedding', { unique: false, multiEntry: true });
        }

        // Metadata store (for app settings, etc.)
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Save a document with its chunks
   */
  async saveDocument(doc: StoredDocument): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['documents', 'chunks'], 'readwrite');
      const docStore = tx.objectStore('documents');
      const chunkStore = tx.objectStore('chunks');

      // Save document
      const docRequest = docStore.put(doc);
      docRequest.onerror = () => reject(docRequest.error);

      // Save chunks
      doc.chunks.forEach((chunk) => {
        const chunkRequest = chunkStore.put(chunk);
        chunkRequest.onerror = () => reject(chunkRequest.error);
      });

      tx.oncomplete = () => {
        logger.info(`Document saved: ${doc.name} (${doc.chunks.length} chunks)`);
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get a document by ID
   */
  async getDocument(id: string): Promise<StoredDocument | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['documents'], 'readonly');
      const store = tx.objectStore('documents');
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  /**
   * Get all documents
   */
  async getAllDocuments(): Promise<StoredDocument[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['documents'], 'readonly');
      const store = tx.objectStore('documents');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get chunks for a document
   */
  async getChunks(documentId: string): Promise<StoredChunk[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['chunks'], 'readonly');
      const store = tx.objectStore('chunks');
      const index = store.index('documentId');
      const request = index.getAll(documentId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get all chunks (for building search index)
   */
  async getAllChunks(): Promise<StoredChunk[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['chunks'], 'readonly');
      const store = tx.objectStore('chunks');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Delete a document and its chunks
   */
  async deleteDocument(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['documents', 'chunks'], 'readwrite');
      const docStore = tx.objectStore('documents');
      const chunkStore = tx.objectStore('chunks');

      // Delete document
      const docRequest = docStore.delete(id);
      docRequest.onerror = () => reject(docRequest.error);

      // Delete associated chunks
      const chunkIndex = chunkStore.index('documentId');
      const getChunksRequest = chunkIndex.getAllKeys(id);

      getChunksRequest.onsuccess = () => {
        const chunkIds = getChunksRequest.result;
        chunkIds.forEach((chunkId) => {
          chunkStore.delete(chunkId);
        });
      };

      tx.oncomplete = () => {
        logger.info(`Document deleted: ${id}`);
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Save metadata
   */
  async saveMetadata(key: string, value: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['metadata'], 'readwrite');
      const store = tx.objectStore('metadata');
      const request = store.put({ key, value, updatedAt: Date.now() });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get metadata
   */
  async getMetadata(key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['metadata'], 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.value || null);
    });
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['documents', 'chunks', 'metadata'], 'readwrite');

      tx.objectStore('documents').clear();
      tx.objectStore('chunks').clear();
      tx.objectStore('metadata').clear();

      tx.oncomplete = () => {
        logger.info('All data cleared');
        resolve();
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    documentCount: number;
    chunkCount: number;
    estimatedSize: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');

    const [docs, chunks] = await Promise.all([
      this.getAllDocuments(),
      this.getAllChunks(),
    ]);

    // Estimate size
    const estimatedSize = new Blob([
      JSON.stringify(docs),
      JSON.stringify(chunks),
    ]).size;

    return {
      documentCount: docs.length,
      chunkCount: chunks.length,
      estimatedSize,
    };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isOpen = false;
      logger.info('IndexedDB connection closed');
    }
  }
}

// Export singleton
export const ragStorage = new RAGStorage();
