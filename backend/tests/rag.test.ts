/**
 * Tests for RAG Pipeline
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RAGPipeline } from '../src/modules/rag';

describe('RAGPipeline', () => {
  let pipeline: RAGPipeline;

  beforeEach(async () => {
    pipeline = new RAGPipeline({
      chunkSize: 100,
      chunkOverlap: 20,
      topK: 3,
    });
    await pipeline.initialize();
  });

  afterEach(() => {
    pipeline.destroy();
  });

  it('should initialize successfully', async () => {
    expect(pipeline).toBeDefined();
    const stats = pipeline.getStats();
    expect(stats.documentCount).toBe(0);
  });

  it('should add and chunk a document', async () => {
    const content = 'This is a test document about React and TypeScript. '.repeat(10);
    
    const document = await pipeline.addDocument(
      'test-doc.txt',
      'txt',
      content
    );

    expect(document).toBeDefined();
    expect(document.id).toBeDefined();
    expect(document.name).toBe('test-doc.txt');

    const stats = pipeline.getStats();
    expect(stats.documentCount).toBe(1);
    expect(stats.chunkCount).toBeGreaterThan(0);
  });

  it('should remove a document', async () => {
    const document = await pipeline.addDocument(
      'temp-doc.txt',
      'txt',
      'Temporary content'
    );

    const removed = pipeline.removeDocument(document.id);
    expect(removed).toBe(true);

    const stats = pipeline.getStats();
    expect(stats.documentCount).toBe(0);
  });

  it('should search and return relevant results', async () => {
    await pipeline.addDocument(
      'react-doc.txt',
      'txt',
      'React is a JavaScript library for building user interfaces. React uses components and state management.'
    );

    await pipeline.addDocument(
      'typescript-doc.txt',
      'txt',
      'TypeScript is a typed superset of JavaScript. TypeScript adds static typing to JavaScript.'
    );

    const results = await pipeline.search('React components');

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].document_id).toBeDefined();
    expect(results[0].content).toBeDefined();
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('should retrieve context for a question', async () => {
    await pipeline.addDocument(
      'interview-tips.txt',
      'txt',
      'When answering interview questions, use the STAR method. Situation, Task, Action, Result. This helps structure your response clearly.'
    );

    const contexts = await pipeline.retrieveContext('How should I answer interview questions?');

    expect(contexts).toBeDefined();
    expect(Array.isArray(contexts)).toBe(true);
    expect(contexts.length).toBeGreaterThan(0);
  });

  it('should handle multiple documents', async () => {
    const docs = [
      { name: 'doc1.txt', content: 'Content about frontend development with React' },
      { name: 'doc2.txt', content: 'Content about backend development with Node.js' },
      { name: 'doc3.txt', content: 'Content about database design with PostgreSQL' },
    ];

    for (const doc of docs) {
      await pipeline.addDocument(doc.name, 'txt', doc.content);
    }

    const stats = pipeline.getStats();
    expect(stats.documentCount).toBe(3);

    const allDocs = pipeline.getDocuments();
    expect(allDocs.length).toBe(3);
  });

  it('should clear all data', async () => {
    await pipeline.addDocument('test.txt', 'txt', 'Test content');
    
    pipeline.clear();
    
    const stats = pipeline.getStats();
    expect(stats.documentCount).toBe(0);
    expect(stats.chunkCount).toBe(0);
  });
});
