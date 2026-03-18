/**
 * Module 1: Speech-to-Text Engine
 * Supports multiple STT providers with streaming capability
 */

import { EventEmitter } from 'events';
import { TranscriptionSegment, AudioConfig } from '@ai-interview/shared';
import { generateUUID, createLogger } from '@ai-interview/shared';

const logger = createLogger('STTEngine');

export type STTProvider = 'whisper' | 'azure' | 'deepgram' | 'mock';

export interface STTProviderInterface {
  initialize(): Promise<void>;
  processAudio(audioData: Float32Array): Promise<TranscriptionSegment | null>;
  destroy(): void;
}

export class STTEngine extends EventEmitter {
  private provider: STTProvider;
  private config: AudioConfig;
  private isProcessing: boolean = false;
  private audioBuffer: Float32Array[] = [];
  private providerInstance: STTProviderInterface | null = null;

  constructor(provider: STTProvider = 'mock', config: Partial<AudioConfig> = {}) {
    super();
    this.provider = provider;
    this.config = {
      sampleRate: 16000,
      channels: 1,
      vadThreshold: 0.5,
      speechPadMs: 200,
      noiseSuppression: true,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    logger.info(`Initializing STT provider: ${this.provider}`);
    
    switch (this.provider) {
      case 'mock':
        this.providerInstance = new MockSTTProvider();
        break;
      case 'whisper':
        // TODO: Implement Whisper.cpp WASM provider
        logger.warn('Whisper provider not yet implemented, using mock');
        this.providerInstance = new MockSTTProvider();
        break;
      case 'azure':
        // TODO: Implement Azure Speech SDK provider
        logger.warn('Azure provider not yet implemented, using mock');
        this.providerInstance = new MockSTTProvider();
        break;
      case 'deepgram':
        // TODO: Implement Deepgram streaming provider
        logger.warn('Deepgram provider not yet implemented, using mock');
        this.providerInstance = new MockSTTProvider();
        break;
      default:
        throw new Error(`Unknown STT provider: ${this.provider}`);
    }

    await this.providerInstance.initialize();
    logger.info('STT engine initialized');
  }

  async processAudioChunk(audioData: Float32Array): Promise<void> {
    if (this.isProcessing) {
      this.audioBuffer.push(audioData);
      return;
    }

    this.isProcessing = true;
    
    try {
      // Apply noise suppression if enabled
      if (this.config.noiseSuppression) {
        audioData = this.applyNoiseSuppression(audioData);
      }

      // Voice Activity Detection
      const hasSpeech = this.detectVoiceActivity(audioData);
      
      if (!hasSpeech) {
        logger.debug('No speech detected, skipping');
        this.isProcessing = false;
        return;
      }

      // Process with STT provider
      const segment = await this.providerInstance!.processAudio(audioData);
      
      if (segment) {
        this.emit('transcription', segment);
        
        if (segment.is_final) {
          this.emit('segment_complete', segment);
        }
      }
    } catch (error) {
      logger.error('Error processing audio:', error);
      this.emit('error', error);
    } finally {
      this.isProcessing = false;
      
      // Process buffered audio if any
      if (this.audioBuffer.length > 0) {
        const nextChunk = this.audioBuffer.shift()!;
        setImmediate(() => this.processAudioChunk(nextChunk));
      }
    }
  }

  private detectVoiceActivity(audioData: Float32Array): boolean {
    // Simple energy-based VAD
    const energy = audioData.reduce((sum, sample) => sum + Math.abs(sample), 0) / audioData.length;
    return energy > this.config.vadThreshold;
  }

  private applyNoiseSuppression(audioData: Float32Array): Float32Array {
    // Simple spectral subtraction noise suppression
    // TODO: Replace with RNNoise or WebRTC NS module
    const suppressed = new Float32Array(audioData.length);
    const threshold = 0.02;
    
    for (let i = 0; i < audioData.length; i++) {
      suppressed[i] = Math.abs(audioData[i]) < threshold ? 0 : audioData[i];
    }
    
    return suppressed;
  }

  destroy(): void {
    this.providerInstance?.destroy();
    this.removeAllListeners();
    logger.info('STT engine destroyed');
  }
}

/**
 * Mock STT Provider for testing and development
 */
class MockSTTProvider implements STTProviderInterface {
  private segmentCount = 0;

  async initialize(): Promise<void> {
    logger.info('Mock STT provider initialized');
  }

  async processAudio(audioData: Float32Array): Promise<TranscriptionSegment | null> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

    // Generate mock transcription based on audio energy
    const energy = audioData.reduce((sum, s) => sum + Math.abs(s), 0) / audioData.length;
    const isFinal = energy > 0.3;
    
    const mockResponses = [
      "Can you tell me about your experience with React?",
      "How do you handle state management in large applications?",
      "Please explain your approach to solving this coding problem.",
      "What challenges did you face in your last project?",
      "Describe a time when you had to work under pressure.",
    ];

    this.segmentCount++;
    const text = isFinal 
      ? mockResponses[this.segmentCount % mockResponses.length]
      : mockResponses[this.segmentCount % mockResponses.length].substring(0, 20);

    const segment: TranscriptionSegment = {
      segment_id: generateUUID(),
      text,
      confidence: 0.7 + Math.random() * 0.3,
      language: 'en-US',
      timestamp: Date.now(),
      is_final: isFinal,
      start_time: Date.now() - 1000,
      end_time: isFinal ? Date.now() : undefined,
    };

    logger.debug(`Mock transcription: ${text.substring(0, 30)}...`);
    return segment;
  }

  destroy(): void {
    logger.info('Mock STT provider destroyed');
  }
}
