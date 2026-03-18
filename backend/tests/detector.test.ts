/**
 * Tests for Question Detector
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QuestionDetector } from '../src/modules/detector';
import { generateUUID } from '@ai-interview/shared';

describe('QuestionDetector', () => {
  let detector: QuestionDetector;

  beforeEach(() => {
    detector = new QuestionDetector({
      pauseThresholdMs: 100,
      triggerCooldownMs: 500,
      minQuestionLength: 3,
    });
  });

  afterEach(() => {
    detector.destroy();
  });

  it('should initialize successfully', () => {
    expect(detector).toBeDefined();
  });

  it('should detect question with question mark', async () => {
    return new Promise<void>((resolve) => {
      detector.on('question_detected', (trigger) => {
        expect(trigger.triggered).toBe(true);
        expect(trigger.reason).toContain('question_mark');
        resolve();
      });

      const segment = {
        segment_id: generateUUID(),
        text: 'Can you tell me about your experience?',
        confidence: 0.9,
        language: 'en-US' as const,
        timestamp: Date.now(),
        is_final: true,
      };

      detector.processTranscription(segment);
    });
  });

  it('should detect question with keywords', async () => {
    return new Promise<void>((resolve) => {
      detector.on('question_detected', (trigger) => {
        expect(trigger.triggered).toBe(true);
        expect(trigger.reason).toContain('question_keyword');
        resolve();
      });

      const segment = {
        segment_id: generateUUID(),
        text: 'How do you handle state management',
        confidence: 0.9,
        language: 'en-US' as const,
        timestamp: Date.now(),
        is_final: true,
      };

      detector.processTranscription(segment);
    });
  });

  it('should not trigger for blacklisted phrases', async () => {
    const segment = {
      segment_id: generateUUID(),
      text: '好的，接下來',
      confidence: 0.9,
      language: 'zh-TW' as const,
      timestamp: Date.now(),
      is_final: true,
    };

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve(); // No trigger = success
      }, 200);

      detector.on('question_detected', () => {
        clearTimeout(timeout);
        reject(new Error('Should not trigger for blacklisted phrase'));
      });

      detector.processTranscription(segment);
    });
  });

  it('should respect cooldown period', async () => {
    const segment1 = {
      segment_id: generateUUID(),
      text: 'First question?',
      confidence: 0.9,
      language: 'en-US' as const,
      timestamp: Date.now(),
      is_final: true,
    };

    const segment2 = {
      segment_id: generateUUID(),
      text: 'Second question?',
      confidence: 0.9,
      language: 'en-US' as const,
      timestamp: Date.now(),
      is_final: true,
    };

    let triggerCount = 0;

    detector.on('question_detected', () => {
      triggerCount++;
    });

    detector.processTranscription(segment1);
    detector.processTranscription(segment2);

    // Wait for cooldown
    await new Promise((r) => setTimeout(r, 100));
    expect(triggerCount).toBe(1);
  });

  it('should extract context hints', async () => {
    return new Promise<void>((resolve) => {
      detector.on('question_detected', (trigger) => {
        expect(trigger.context_hints).toBeDefined();
        expect(trigger.context_hints.length).toBeGreaterThan(0);
        resolve();
      });

      const segment = {
        segment_id: generateUUID(),
        text: 'Can you explain your React architecture?',
        confidence: 0.9,
        language: 'en-US' as const,
        timestamp: Date.now(),
        is_final: true,
      };

      detector.processTranscription(segment);
    });
  });

  it('should support manual trigger', () => {
    const trigger = detector.manualTrigger('Manual question test');
    
    expect(trigger.triggered).toBe(true);
    expect(trigger.reason).toBe('manual_override');
    expect(trigger.confidence).toBe(1.0);
  });
});
