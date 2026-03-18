/**
 * Module 2: LLM Orchestrator
 * Unified provider interface with request queuing and streaming
 */

import { EventEmitter } from 'events';
import { LLMResponse, LLMConfig, PromptContext, LLMProvider } from '@ai-interview/shared';
import { generateUUID, createLogger, calculateLatency } from '@ai-interview/shared';

const logger = createLogger('LLMOrchestrator');

export interface LLMProviderInterface {
  initialize(): Promise<void>;
  generate(prompt: string, context: PromptContext): Promise<LLMResponse>;
  generateStream(prompt: string, context: PromptContext, onChunk: (chunk: string) => void): Promise<LLMResponse>;
  destroy(): void;
}

interface QueuedRequest {
  id: string;
  prompt: string;
  context: PromptContext;
  priority: number;
  resolve: (response: LLMResponse) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export class LLMOrchestrator extends EventEmitter {
  private config: LLMConfig;
  private provider: LLMProviderInterface | null = null;
  private requestQueue: QueuedRequest[] = [];
  private isProcessing: boolean = false;
  private cache: Map<string, { response: LLMResponse; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(config: LLMConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    logger.info(`Initializing LLM provider: ${this.config.provider}`);

    switch (this.config.provider) {
      case 'openai':
        this.provider = new OpenAIProvider(this.config);
        break;
      case 'anthropic':
        this.provider = new AnthropicProvider(this.config);
        break;
      case 'google':
        this.provider = new GoogleProvider(this.config);
        break;
      case 'ollama':
        this.provider = new OllamaProvider(this.config);
        break;
      case 'local':
        this.provider = new LocalProvider(this.config);
        break;
      default:
        throw new Error(`Unknown LLM provider: ${this.config.provider}`);
    }

    await this.provider.initialize();
    
    // Start queue processor
    this.processQueue();
    
    logger.info('LLM orchestrator initialized');
  }

  async generate(context: PromptContext, priority: number = 0): Promise<LLMResponse> {
    const cacheKey = this.getCacheKey(context);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      logger.debug('Cache hit');
      return cached.response;
    }

    const prompt = this.buildPrompt(context);

    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        id: generateUUID(),
        prompt,
        context,
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // Sort by priority (higher first)
      this.requestQueue.sort((a, b) => b.priority - a.priority);
    });
  }

  async generateStream(
    context: PromptContext,
    onChunk: (chunk: string) => void,
    priority: number = 0
  ): Promise<LLMResponse> {
    const cacheKey = this.getCacheKey(context);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      logger.debug('Cache hit (stream)');
      // Simulate streaming from cache
      for (const char of cached.response.answer) {
        onChunk(char);
        await new Promise((r) => setTimeout(r, 10));
      }
      return cached.response;
    }

    const prompt = this.buildPrompt(context);

    if (!this.provider) {
      throw new Error('LLM provider not initialized');
    }

    const startTime = Date.now();
    const response = await this.provider.generateStream(prompt, context, onChunk);
    response.latency = calculateLatency(startTime);

    // Cache the response
    this.cache.set(cacheKey, { response, timestamp: Date.now() });

    return response;
  }

  private async processQueue(): Promise<void> {
    while (true) {
      if (this.requestQueue.length > 0 && !this.isProcessing) {
        const request = this.requestQueue.shift()!;
        this.isProcessing = true;

        try {
          if (!this.provider) {
            throw new Error('LLM provider not initialized');
          }

          const startTime = Date.now();
          const response = await this.provider.generate(request.prompt, request.context);
          response.latency = calculateLatency(startTime);

          // Cache the response
          const cacheKey = this.getCacheKey(request.context);
          this.cache.set(cacheKey, { response, timestamp: Date.now() });

          request.resolve(response);
          this.emit('response', response);
        } catch (error) {
          request.reject(error as Error);
          this.emit('error', error);
        } finally {
          this.isProcessing = false;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private buildPrompt(context: PromptContext): string {
    const systemPrompt = `你是一位專業面試教練，請根據以下上下文生成簡潔、專業、STAR 原則的回答：

要求：
1. 回答控制在 30 秒內可說完（約 80-120 字）
2. 關鍵技術詞彙加粗，方便用戶快速掃描
3. 若問題模糊，先給出澄清建議
4. 輸出 JSON 格式：{"answer": "...", "keywords": [...], "confidence": 0.9}`;

    const contextParts = [
      context.resume_summary && `- 用戶簡歷摘要：${context.resume_summary}`,
      context.job_title && `- 應聘職位：${context.job_title}`,
      `- 面試類型：${context.interview_type}`,
      `- 當前問題：${context.transcribed_question}`,
      context.retrieved_docs?.length && `- 參考文件：${context.retrieved_docs.join('\n')}`,
    ].filter(Boolean).join('\n');

    return `${systemPrompt}\n\n${contextParts}`;
  }

  private getCacheKey(context: PromptContext): string {
    return `${context.interview_type}:${context.transcribed_question.substring(0, 50)}`;
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('LLM cache cleared');
  }

  destroy(): void {
    this.provider?.destroy();
    this.requestQueue = [];
    this.cache.clear();
    this.removeAllListeners();
    logger.info('LLM orchestrator destroyed');
  }
}

// ============================================================================
// Provider Implementations
// ============================================================================

class OpenAIProvider implements LLMProviderInterface {
  constructor(private config: LLMConfig) {}

  async initialize(): Promise<void> {
    logger.info('OpenAI provider initialized');
  }

  async generate(prompt: string, context: PromptContext): Promise<LLMResponse> {
    // TODO: Implement actual OpenAI API call
    logger.debug('OpenAI generate called');
    
    // Mock response for now
    return this.generateMockResponse(context.transcribed_question);
  }

  async generateStream(
    prompt: string,
    context: PromptContext,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    // TODO: Implement actual OpenAI streaming API call
    const response = await this.generate(prompt, context);
    
    // Simulate streaming
    for (const char of response.answer) {
      onChunk(char);
      await new Promise((r) => setTimeout(r, 20));
    }
    
    return response;
  }

  destroy(): void {
    logger.info('OpenAI provider destroyed');
  }

  private generateMockResponse(question: string): LLMResponse {
    return {
      answer: `這是一個很好的問題。關於"${question.substring(0, 20)}..."，我的經驗是...`,
      keywords: ['React', 'TypeScript', '架構設計'],
      confidence: 0.85,
    };
  }
}

class AnthropicProvider implements LLMProviderInterface {
  constructor(private config: LLMConfig) {}

  async initialize(): Promise<void> {
    logger.info('Anthropic provider initialized');
  }

  async generate(prompt: string, context: PromptContext): Promise<LLMResponse> {
    // TODO: Implement actual Anthropic API call
    return this.generateMockResponse(context.transcribed_question);
  }

  async generateStream(
    prompt: string,
    context: PromptContext,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    const response = await this.generate(prompt, context);
    for (const char of response.answer) {
      onChunk(char);
      await new Promise((r) => setTimeout(r, 20));
    }
    return response;
  }

  destroy(): void {
    logger.info('Anthropic provider destroyed');
  }

  private generateMockResponse(question: string): LLMResponse {
    return {
      answer: `針對"${question.substring(0, 20)}..."，根據 STAR 原則，我的回答是...`,
      keywords: ['問題解決', '團隊協作', '技術領導'],
      confidence: 0.88,
    };
  }
}

class GoogleProvider implements LLMProviderInterface {
  constructor(private config: LLMConfig) {}

  async initialize(): Promise<void> {
    logger.info('Google provider initialized');
  }

  async generate(prompt: string, context: PromptContext): Promise<LLMResponse> {
    return this.generateMockResponse(context.transcribed_question);
  }

  async generateStream(
    prompt: string,
    context: PromptContext,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    const response = await this.generate(prompt, context);
    for (const char of response.answer) {
      onChunk(char);
      await new Promise((r) => setTimeout(r, 20));
    }
    return response;
  }

  destroy(): void {
    logger.info('Google provider destroyed');
  }

  private generateMockResponse(question: string): LLMResponse {
    return {
      answer: `關於"${question.substring(0, 20)}..."，我的方法是...`,
      keywords: ['Google', 'Cloud', 'API'],
      confidence: 0.82,
    };
  }
}

class OllamaProvider implements LLMProviderInterface {
  constructor(private config: LLMConfig) {}

  async initialize(): Promise<void> {
    logger.info('Ollama provider initialized');
  }

  async generate(prompt: string, context: PromptContext): Promise<LLMResponse> {
    // TODO: Implement actual Ollama API call
    return this.generateMockResponse(context.transcribed_question);
  }

  async generateStream(
    prompt: string,
    context: PromptContext,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    const response = await this.generate(prompt, context);
    for (const char of response.answer) {
      onChunk(char);
      await new Promise((r) => setTimeout(r, 20));
    }
    return response;
  }

  destroy(): void {
    logger.info('Ollama provider destroyed');
  }

  private generateMockResponse(question: string): LLMResponse {
    return {
      answer: `本地模型回答：關於"${question.substring(0, 20)}..."...`,
      keywords: ['本地模型', '隱私', '離線'],
      confidence: 0.75,
    };
  }
}

class LocalProvider implements LLMProviderInterface {
  constructor(private config: LLMConfig) {}

  async initialize(): Promise<void> {
    logger.info('Local provider initialized');
  }

  async generate(prompt: string, context: PromptContext): Promise<LLMResponse> {
    return this.generateMockResponse(context.transcribed_question);
  }

  async generateStream(
    prompt: string,
    context: PromptContext,
    onChunk: (chunk: string) => void
  ): Promise<LLMResponse> {
    const response = await this.generate(prompt, context);
    for (const char of response.answer) {
      onChunk(char);
      await new Promise((r) => setTimeout(r, 20));
    }
    return response;
  }

  destroy(): void {
    logger.info('Local provider destroyed');
  }

  private generateMockResponse(question: string): LLMResponse {
    return {
      answer: `本地處理：針對"${question.substring(0, 20)}..."，建議回答...`,
      keywords: ['本地', '快速', '隱私'],
      confidence: 0.78,
    };
  }
}
