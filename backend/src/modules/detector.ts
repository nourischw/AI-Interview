/**
 * Module 4: Question Detector
 * Detects interviewer questions using VAD and semantic analysis
 */

import { EventEmitter } from 'events';
import { QuestionTrigger, DetectorConfig, TranscriptionSegment } from '@ai-interview/shared';
import { generateUUID, createLogger } from '@ai-interview/shared';

const logger = createLogger('QuestionDetector');

export class QuestionDetector extends EventEmitter {
  private config: DetectorConfig;
  private lastTriggerTime: number = 0;
  private transcriptionBuffer: TranscriptionSegment[] = [];
  private vadSilenceStart: number | null = null;
  private isProcessing: boolean = false;

  constructor(config: Partial<DetectorConfig> = {}) {
    super();
    this.config = {
      pauseThresholdMs: 800,
      minQuestionLength: 5,
      triggerCooldownMs: 15000,
      questionKeywords: ['?', '？', '如何', '為什麼', '請說明', 'how', 'why', 'explain', 'describe', 'tell me'],
      blacklistPhrases: ['好的', '接下來', '我們休息一下', 'ok', 'next', 'let\'s take a break', 'thank you'],
      ...config,
    };
  }

  /**
   * Process transcription segment and detect questions
   */
  processTranscription(segment: TranscriptionSegment): void {
    if (this.isProcessing) {
      this.transcriptionBuffer.push(segment);
      return;
    }

    this.isProcessing = true;
    this.transcriptionBuffer.push(segment);

    try {
      // Check cooldown
      if (Date.now() - this.lastTriggerTime < this.config.triggerCooldownMs) {
        logger.debug('In cooldown period, skipping');
        return;
      }

      // Analyze the segment
      const trigger = this.analyzeSegment(segment);
      
      if (trigger.triggered) {
        this.lastTriggerTime = Date.now();
        this.emit('question_detected', trigger);
        logger.info(`Question detected: ${trigger.question_text.substring(0, 50)}...`);
      }
    } finally {
      this.isProcessing = false;
      
      // Process buffered segments
      if (this.transcriptionBuffer.length > 1) {
        const nextSegment = this.transcriptionBuffer.shift();
        if (nextSegment) {
          setImmediate(() => this.processTranscription(nextSegment));
        }
      }
    }
  }

  /**
   * Analyze a transcription segment for question patterns
   */
  private analyzeSegment(segment: TranscriptionSegment): QuestionTrigger {
    const text = segment.text.trim();
    const lowerText = text.toLowerCase();

    // Check blacklist first
    if (this.isBlacklisted(text)) {
      logger.debug('Blacklisted phrase, skipping');
      return this.createTrigger(false, 'blacklist', text);
    }

    // Check minimum length
    if (text.length < this.config.minQuestionLength) {
      return this.createTrigger(false, 'too_short', text);
    }

    // Check for question indicators
    const reasons: string[] = [];
    let confidence = 0.5;

    // 1. Question mark detection
    if (text.includes('?') || text.includes('?')) {
      reasons.push('question_mark');
      confidence += 0.3;
    }

    // 2. Question keyword detection
    const foundKeywords = this.config.questionKeywords.filter((kw) => 
      lowerText.includes(kw.toLowerCase())
    );
    if (foundKeywords.length > 0) {
      reasons.push('question_keyword');
      confidence += 0.1 * foundKeywords.length;
    }

    // 3. Question pattern detection (linguistic patterns)
    if (this.matchesQuestionPattern(text)) {
      reasons.push('question_pattern');
      confidence += 0.2;
    }

    // 4. VAD silence detection (if segment is final)
    if (segment.is_final) {
      reasons.push('vad_end');
      confidence += 0.1;
    }

    // Determine if triggered
    const triggered = reasons.length >= 2 && confidence >= 0.7;

    // Extract context hints
    const contextHints = this.extractContextHints(text);

    return this.createTrigger(
      triggered,
      reasons.join(' + '),
      text,
      confidence,
      contextHints
    );
  }

  /**
   * Check if text matches blacklist phrases
   */
  private isBlacklisted(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.config.blacklistPhrases.some((phrase) => 
      lowerText.includes(phrase.toLowerCase())
    );
  }

  /**
   * Match common question patterns
   */
  private matchesQuestionPattern(text: string): boolean {
    const patterns = [
      /^(can|could|would|will)\s+you\s+/i,  // "Can you..."
      /^(what|when|where|who|which|why|how)\s+/i,  // WH- questions
      /^(tell|explain|describe)\s+/i,  // Imperative questions
      /would\s+you\s+like/i,
      /have\s+you\s+ever/i,
      /are\s+you\s+/i,
      /do\s+you\s+/i,
      /did\s+you\s+/i,
      /is\s+there\s+/i,
      /can\s+you\s+/i,
    ];

    return patterns.some((pattern) => pattern.test(text));
  }

  /**
   * Extract context hints from question text
   */
  private extractContextHints(text: string): string[] {
    const hints: string[] = [];
    
    // Extract technical terms (capitalized words, common tech terms)
    const techTerms = [
      'React', 'Vue', 'Angular', 'Node', 'Python', 'Java', 'JavaScript', 'TypeScript',
      'API', 'REST', 'GraphQL', 'SQL', 'NoSQL', 'MongoDB', 'PostgreSQL',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD',
      'RAG', 'LLM', 'AI', 'ML', 'NLP',
      'frontend', 'backend', 'fullstack', 'devops',
    ];

    techTerms.forEach((term) => {
      if (text.toLowerCase().includes(term.toLowerCase())) {
        hints.push(term);
      }
    });

    // Extract phrases after question words
    const phrasePatterns = [
      /(?:what|how|why)\s+(?:do|does|did|is|are|was|were)\s+([^?]+)/i,
      /(?:tell|explain|describe)\s+(?:me\s+)?(?:about\s+)?([^?]+)/i,
    ];

    phrasePatterns.forEach((pattern) => {
      const match = text.match(pattern);
      if (match && match[1]) {
        const phrase = match[1].trim().split(/\s+/).slice(0, 5).join(' ');
        if (phrase.length > 3) {
          hints.push(phrase);
        }
      }
    });

    return [...new Set(hints)]; // Deduplicate
  }

  /**
   * Create a QuestionTrigger object
   */
  private createTrigger(
    triggered: boolean,
    reason: string,
    questionText: string,
    confidence: number = 0.5,
    contextHints: string[] = []
  ): QuestionTrigger {
    return {
      triggered,
      reason,
      question_text: questionText,
      context_hints: contextHints,
      confidence: Math.min(1, confidence),
      timestamp: Date.now(),
    };
  }

  /**
   * Manual trigger override
   */
  manualTrigger(questionText: string): QuestionTrigger {
    const trigger: QuestionTrigger = {
      triggered: true,
      reason: 'manual_override',
      question_text: questionText,
      context_hints: this.extractContextHints(questionText),
      confidence: 1.0,
      timestamp: Date.now(),
    };

    this.lastTriggerTime = Date.now();
    this.emit('question_detected', trigger);
    
    return trigger;
  }

  /**
   * Cancel current detection (reset cooldown)
   */
  cancel(): void {
    this.lastTriggerTime = Date.now();
    this.transcriptionBuffer = [];
    logger.debug('Question detection cancelled');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DetectorConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Detector config updated');
  }

  /**
   * Get current state
   */
  getState(): { cooldownRemaining: number; bufferLength: number } {
    const elapsed = Date.now() - this.lastTriggerTime;
    const remaining = Math.max(0, this.config.triggerCooldownMs - elapsed);
    
    return {
      cooldownRemaining: remaining,
      bufferLength: this.transcriptionBuffer.length,
    };
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.transcriptionBuffer = [];
    this.removeAllListeners();
    logger.info('Question detector destroyed');
  }
}
