/**
 * Tests for LLM Orchestrator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LLMOrchestrator } from '../src/modules/llm';
import { LLMResponseSchema } from '@ai-interview/shared';

describe('LLMOrchestrator', () => {
  let orchestrator: LLMOrchestrator;

  beforeEach(async () => {
    orchestrator = new LLMOrchestrator({
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 500,
    });
    await orchestrator.initialize();
  });

  afterEach(() => {
    orchestrator.destroy();
  });

  it('should initialize successfully', () => {
    expect(orchestrator).toBeDefined();
  });

  it('should generate a response', async () => {
    const context = {
      interview_type: 'technical' as const,
      transcribed_question: 'Tell me about your experience with React',
    };

    const response = await orchestrator.generate(context);

    expect(response).toBeDefined();
    expect(response.answer).toBeDefined();
    expect(response.keywords).toBeDefined();
    expect(Array.isArray(response.keywords)).toBe(true);
    expect(response.confidence).toBeGreaterThanOrEqual(0);
    expect(response.confidence).toBeLessThanOrEqual(1);
  });

  it('should cache responses', async () => {
    const context = {
      interview_type: 'technical' as const,
      transcribed_question: 'Cached question test',
    };

    const response1 = await orchestrator.generate(context);
    const response2 = await orchestrator.generate(context);

    expect(response1.answer).toBe(response2.answer);
  });

  it('should stream response chunks', async () => {
    const context = {
      interview_type: 'behavioral' as const,
      transcribed_question: 'Describe a challenging situation',
    };

    const chunks: string[] = [];
    const response = await orchestrator.generateStream(
      context,
      (chunk) => chunks.push(chunk)
    );

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toBe(response.answer);
  });

  it('should handle different interview types', async () => {
    const types = ['technical', 'behavioral', 'coding', 'general'] as const;

    for (const type of types) {
      const context = {
        interview_type: type,
        transcribed_question: 'Test question',
      };

      const response = await orchestrator.generate(context);
      expect(response).toBeDefined();
    }
  });
});
