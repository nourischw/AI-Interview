/**
 * Integration Tests - Full Pipeline
 * Tests the complete flow: STT → Question Detection → LLM Response
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { STTEngine } from '../src/modules/stt';
import { LLMOrchestrator } from '../src/modules/llm';
import { QuestionDetector } from '../src/modules/detector';
import { RAGPipeline } from '../src/modules/rag';
import { generateUUID } from '@ai-interview/shared';

describe('Integration Tests', () => {
  let sttEngine: STTEngine;
  let llmOrchestrator: LLMOrchestrator;
  let questionDetector: QuestionDetector;
  let ragPipeline: RAGPipeline;

  beforeEach(async () => {
    sttEngine = new STTEngine('mock');
    llmOrchestrator = new LLMOrchestrator({
      provider: 'openai',
      model: 'gpt-3.5-turbo',
    });
    questionDetector = new QuestionDetector({
      triggerCooldownMs: 100,
    });
    ragPipeline = new RAGPipeline();

    await sttEngine.initialize();
    await llmOrchestrator.initialize();
    await ragPipeline.initialize();
  });

  afterEach(() => {
    sttEngine.destroy();
    llmOrchestrator.destroy();
    questionDetector.destroy();
    ragPipeline.destroy();
  });

  it('should process full pipeline: transcription → question detection → response', async () => {
    // Add context to RAG
    await ragPipeline.addDocument(
      'resume.txt',
      'txt',
      'Experience: 5 years React development, TypeScript, Node.js, AWS'
    );

    const results: { type: string; data: unknown }[] = [];

    // Setup listeners
    questionDetector.on('question_detected', async (trigger) => {
      if (trigger.triggered) {
        results.push({ type: 'question', data: trigger });

        // Retrieve context and generate response
        const contexts = await ragPipeline.retrieveContext(trigger.question_text);
        const response = await llmOrchestrator.generate({
          interview_type: 'technical',
          transcribed_question: trigger.question_text,
          retrieved_docs: contexts,
        });

        results.push({ type: 'response', data: response });
      }
    });

    // Simulate transcription
    const segment = {
      segment_id: generateUUID(),
      text: 'Can you explain your experience with React?',
      confidence: 0.95,
      language: 'en-US' as const,
      timestamp: Date.now(),
      is_final: true,
    };

    questionDetector.processTranscription(segment);

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify results
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.type === 'question')).toBe(true);
  });

  it('should handle multiple questions in sequence', async () => {
    const questions = [
      'Tell me about React hooks?',
      'How do you manage state?',
      'What is your experience with TypeScript?',
    ];

    const responses: unknown[] = [];

    questionDetector.on('question_detected', async (trigger) => {
      if (trigger.triggered) {
        const response = await llmOrchestrator.generate({
          interview_type: 'technical',
          transcribed_question: trigger.question_text,
        });
        responses.push(response);
      }
    });

    // Process questions with delay to avoid cooldown
    for (const question of questions) {
      const segment = {
        segment_id: generateUUID(),
        text: question,
        confidence: 0.9,
        language: 'en-US' as const,
        timestamp: Date.now(),
        is_final: true,
      };

      questionDetector.processTranscription(segment);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Wait for all processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(responses.length).toBeGreaterThan(0);
  });

  it('should respect latency requirements (<2s)', async () => {
    const startTime = Date.now();

    await ragPipeline.addDocument('test.txt', 'txt', 'Test content for context');

    const context = {
      interview_type: 'technical',
      transcribed_question: 'Quick question test',
    };

    const response = await llmOrchestrator.generate(context);
    const latency = Date.now() - startTime;

    // With mock provider, should be very fast
    expect(latency).toBeLessThan(2000);
    expect(response.latency).toBeDefined();
  });
});
