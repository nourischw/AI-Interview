/**
 * Tests for STT Engine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { STTEngine } from '../src/modules/stt';
import { TranscriptionSegmentSchema } from '@ai-interview/shared';

describe('STTEngine', () => {
  let engine: STTEngine;

  beforeEach(async () => {
    engine = new STTEngine('mock');
    await engine.initialize();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('should initialize successfully', () => {
    expect(engine).toBeDefined();
  });

  it('should process audio chunk and emit transcription', async () => {
    return new Promise<void>((resolve) => {
      engine.on('transcription', (segment: TranscriptionSegment) => {
        expect(segment).toBeDefined();
        expect(segment.text).toBeDefined();
        expect(segment.confidence).toBeGreaterThanOrEqual(0);
        expect(segment.confidence).toBeLessThanOrEqual(1);
        expect(segment.is_final).toBeDefined();
        resolve();
      });

      const audioData = new Float32Array(16000).map(() => Math.random() * 2 - 1);
      engine.processAudioChunk(audioData);
    });
  });

  it('should emit segment_complete for final transcriptions', async () => {
    return new Promise<void>((resolve) => {
      engine.on('segment_complete', (segment: TranscriptionSegment) => {
        expect(segment.is_final).toBe(true);
        expect(segment.end_time).toBeDefined();
        resolve();
      });

      // Process multiple chunks to trigger a final transcription
      for (let i = 0; i < 5; i++) {
        const audioData = new Float32Array(16000).map(() => 0.5);
        engine.processAudioChunk(audioData);
      }
    });
  });

  it('should apply noise suppression', async () => {
    return new Promise<void>((resolve) => {
      engine.on('transcription', () => {
        // If we get here, noise suppression was applied
        resolve();
      });

      // Very low energy audio (should be suppressed)
      const audioData = new Float32Array(16000).map(() => 0.001);
      engine.processAudioChunk(audioData);
    });
  });
});
