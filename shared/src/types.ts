/**
 * Shared types for AI Interview Assistant
 */

import { z } from 'zod';

// ============================================================================
// Module 1: STT Engine Types
// ============================================================================

export const TranscriptionSegmentSchema = z.object({
  segment_id: z.string().uuid(),
  text: z.string(),
  confidence: z.number().min(0).max(1),
  language: z.enum(['zh-TW', 'en-US', 'zh-CN']),
  timestamp: z.number(),
  is_final: z.boolean(),
  start_time: z.number().optional(),
  end_time: z.number().optional(),
});

export type TranscriptionSegment = z.infer<typeof TranscriptionSegmentSchema>;

export const AudioConfigSchema = z.object({
  sampleRate: z.number().default(16000),
  channels: z.number().default(1),
  vadThreshold: z.number().default(0.5),
  speechPadMs: z.number().default(200),
  noiseSuppression: z.boolean().default(true),
});

export type AudioConfig = z.infer<typeof AudioConfigSchema>;

// ============================================================================
// Module 2: LLM Orchestrator Types
// ============================================================================

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'local';

export const LLMConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'ollama', 'local']),
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().default(500),
  timeout: z.number().default(30000),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

export const LLMResponseSchema = z.object({
  answer: z.string(),
  keywords: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()).optional(),
  latency: z.number().optional(),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;

export const PromptContextSchema = z.object({
  resume_summary: z.string().optional(),
  job_title: z.string().optional(),
  interview_type: z.enum(['technical', 'behavioral', 'coding', 'general']),
  transcribed_question: z.string(),
  retrieved_docs: z.array(z.string()).optional(),
  conversation_history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

export type PromptContext = z.infer<typeof PromptContextSchema>;

// ============================================================================
// Module 3: Stealth Engine Types
// ============================================================================

export const StealthConfigSchema = z.object({
  enabled: z.boolean().default(true),
  excludeFromCapture: z.boolean().default(true),
  hideFromTaskbar: z.boolean().default(false),
  processCamouflage: z.boolean().default(false),
  emergencyHotkey: z.string().default('Ctrl+Shift+X'),
  autoHideOnBlur: z.boolean().default(true),
  opacityWhenHidden: z.number().min(0).max(1).default(0),
});

export type StealthConfig = z.infer<typeof StealthConfigSchema>;

export interface StealthState {
  isVisible: boolean;
  isCaptured: boolean;
  lastVisibilityCheck: number;
  proctoringDetected: boolean;
}

// ============================================================================
// Module 4: Question Detector Types
// ============================================================================

export const QuestionTriggerSchema = z.object({
  triggered: z.boolean(),
  reason: z.string(),
  question_text: z.string(),
  context_hints: z.array(z.string()),
  confidence: z.number().min(0).max(1).optional(),
  timestamp: z.number(),
});

export type QuestionTrigger = z.infer<typeof QuestionTriggerSchema>;

export const DetectorConfigSchema = z.object({
  pauseThresholdMs: z.number().default(800),
  minQuestionLength: z.number().default(5),
  triggerCooldownMs: z.number().default(15000),
  questionKeywords: z.array(z.string()).default(['?', '如何', '為什麼', '請說明', 'how', 'why', 'explain']),
  blacklistPhrases: z.array(z.string()).default(['好的', '接下來', '我們休息一下', 'ok', 'next', 'let\'s take a break']),
});

export type DetectorConfig = z.infer<typeof DetectorConfigSchema>;

// ============================================================================
// Module 5: RAG Pipeline Types
// ============================================================================

export type DocumentType = 'pdf' | 'docx' | 'txt' | 'markdown';

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['pdf', 'docx', 'txt', 'markdown']),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
  embeddings: z.array(z.array(z.number())).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type Document = z.infer<typeof DocumentSchema>;

export const RetrievalResultSchema = z.object({
  document_id: z.string(),
  content: z.string(),
  score: z.number(),
  metadata: z.record(z.unknown()).optional(),
});

export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;

export const RAGConfigSchema = z.object({
  chunkSize: z.number().default(500),
  chunkOverlap: z.number().default(50),
  topK: z.number().default(5),
  embeddingModel: z.string().default('bge-small-zh'),
  hybridSearch: z.boolean().default(true),
  rerank: z.boolean().default(true),
});

export type RAGConfig = z.infer<typeof RAGConfigSchema>;

// ============================================================================
// Session & App Types
// ============================================================================

export const SessionConfigSchema = z.object({
  stt: AudioConfigSchema,
  llm: LLMConfigSchema,
  stealth: StealthConfigSchema,
  detector: DetectorConfigSchema,
  rag: RAGConfigSchema,
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

export interface SessionState {
  id: string;
  isActive: boolean;
  startTime: number;
  lastActivity: number;
  transcriptionHistory: TranscriptionSegment[];
  generatedResponses: LLMResponse[];
  config: SessionConfig;
}

export const AppStateSchema = z.object({
  currentSession: z.string().nullable(),
  sessions: z.record(z.unknown()),
  documents: z.array(DocumentSchema),
  settings: SessionConfigSchema,
});

export type AppState = z.infer<typeof AppStateSchema>;

// ============================================================================
// API Response Types
// ============================================================================

export const APIResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  timestamp: z.number(),
});

export type APIResponse = z.infer<typeof APIResponseSchema>;

export const SSEMessageSchema = z.object({
  type: z.enum(['transcription', 'response', 'error', 'status']),
  data: z.unknown(),
  timestamp: z.number(),
});

export type SSEMessage = z.infer<typeof SSEMessageSchema>;
