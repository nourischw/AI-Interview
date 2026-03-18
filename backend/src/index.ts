/**
 * Backend Orchestrator Service
 * Main entry point for the AI Interview Assistant backend
 */

import express, { Express, Request, Response } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import { STTEngine } from './modules/stt';
import { LLMOrchestrator } from './modules/llm';
import { StealthEngine } from './modules/stealth';
import { QuestionDetector } from './modules/detector';
import { RAGPipeline } from './modules/rag';
import { 
  SessionConfig, 
  TranscriptionSegment, 
  LLMResponse, 
  QuestionTrigger,
  LLMConfig,
} from '@ai-interview/shared';
import { generateUUID, createLogger } from '@ai-interview/shared';

const logger = createLogger('Backend');

export interface BackendConfig {
  port: number;
  sttProvider: string;
  llmProvider: LLMConfig;
  enableStealth: boolean;
  enableRAG: boolean;
}

export class BackendService {
  private app: Express;
  private httpServer: HTTPServer;
  private wsServer: WebSocketServer;
  private config: BackendConfig;
  
  // Core modules
  private sttEngine: STTEngine;
  private llmOrchestrator: LLMOrchestrator;
  private stealthEngine: StealthEngine;
  private questionDetector: QuestionDetector;
  private ragPipeline: RAGPipeline;

  // Session management
  private sessions: Map<string, SessionState> = new Map();
  private clientConnections: Map<string, WebSocket> = new Map();

  constructor(config: Partial<BackendConfig> = {}) {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.wsServer = new WebSocketServer({ server: this.httpServer, path: '/ws' });

    this.config = {
      port: config.port || 3001,
      sttProvider: config.sttProvider || 'mock',
      llmProvider: config.llmProvider || {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 500,
      },
      enableStealth: config.enableStealth ?? true,
      enableRAG: config.enableRAG ?? true,
    };

    // Initialize modules
    this.sttEngine = new STTEngine(this.config.sttProvider as any);
    this.llmOrchestrator = new LLMOrchestrator(this.config.llmProvider);
    this.stealthEngine = new StealthEngine({ enabled: this.config.enableStealth });
    this.questionDetector = new QuestionDetector();
    this.ragPipeline = new RAGPipeline();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupModuleListeners();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // API routes
    this.app.get('/api/status', (req: Request, res: Response) => {
      res.json({
        status: 'running',
        sessions: this.sessions.size,
        modules: {
          stt: 'initialized',
          llm: 'initialized',
          stealth: this.config.enableStealth ? 'enabled' : 'disabled',
          rag: this.config.enableRAG ? 'enabled' : 'disabled',
        },
      });
    });

    // Session management
    this.app.post('/api/session/create', (req: Request, res: Response) => {
      const sessionId = generateUUID();
      const session: SessionState = {
        id: sessionId,
        isActive: true,
        startTime: Date.now(),
        lastActivity: Date.now(),
        transcriptionHistory: [],
        generatedResponses: [],
      };
      this.sessions.set(sessionId, session);
      res.json({ success: true, sessionId });
    });

    this.app.post('/api/session/:id/end', (req: Request, res: Response) => {
      const { id } = req.params;
      const session = this.sessions.get(id);
      if (session) {
        session.isActive = false;
        session.lastActivity = Date.now();
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: 'Session not found' });
      }
    });

    // Document management (RAG)
    this.app.post('/api/documents', async (req: Request, res: Response) => {
      try {
        const { name, type, content, metadata } = req.body;
        const document = await this.ragPipeline.addDocument(name, type, content, metadata);
        res.json({ success: true, document });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    this.app.get('/api/documents', (req: Request, res: Response) => {
      const documents = this.ragPipeline.getDocuments();
      res.json({ success: true, documents });
    });

    this.app.delete('/api/documents/:id', (req: Request, res: Response) => {
      const { id } = req.params;
      const removed = this.ragPipeline.removeDocument(id);
      res.json({ success: true, removed });
    });

    // Search
    this.app.post('/api/search', async (req: Request, res: Response) => {
      try {
        const { query, topK } = req.body;
        const results = await this.ragPipeline.search(query, topK);
        res.json({ success: true, results });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    // Config
    this.app.get('/api/config', (req: Request, res: Response) => {
      res.json({
        success: true,
        config: {
          sttProvider: this.config.sttProvider,
          llmProvider: this.config.llmProvider,
          enableStealth: this.config.enableStealth,
          enableRAG: this.config.enableRAG,
        },
      });
    });
  }

  private setupWebSocket(): void {
    this.wsServer.on('connection', (ws: WebSocket) => {
      const clientId = generateUUID();
      logger.info(`Client connected: ${clientId}`);

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleWebSocketMessage(clientId, ws, message);
        } catch (error) {
          logger.error('WebSocket message error:', error);
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        logger.info(`Client disconnected: ${clientId}`);
        this.clientConnections.delete(clientId);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });
  }

  private async handleWebSocketMessage(
    clientId: string,
    ws: WebSocket,
    message: { type: string; payload?: unknown }
  ): Promise<void> {
    switch (message.type) {
      case 'audio_chunk': {
        // Handle audio data for STT
        const { audioData } = message.payload as { audioData: number[] };
        if (audioData) {
          const float32Array = new Float32Array(audioData);
          await this.sttEngine.processAudioChunk(float32Array);
        }
        break;
      }

      case 'start_session': {
        const sessionId = generateUUID();
        const session: SessionState = {
          id: sessionId,
          isActive: true,
          startTime: Date.now(),
          lastActivity: Date.now(),
          transcriptionHistory: [],
          generatedResponses: [],
        };
        this.sessions.set(sessionId, session);
        this.clientConnections.set(clientId, ws);
        
        ws.send(JSON.stringify({ type: 'session_started', sessionId }));
        break;
      }

      case 'end_session': {
        const { sessionId } = message.payload as { sessionId: string };
        const session = this.sessions.get(sessionId);
        if (session) {
          session.isActive = false;
          session.lastActivity = Date.now();
        }
        ws.send(JSON.stringify({ type: 'session_ended', sessionId }));
        break;
      }

      case 'manual_trigger': {
        const { questionText } = message.payload as { questionText: string };
        const trigger = this.questionDetector.manualTrigger(questionText);
        await this.handleQuestionTrigger(trigger, clientId);
        break;
      }

      default:
        logger.warn(`Unknown message type: ${message.type}`);
    }
  }

  private setupModuleListeners(): void {
    // STT events
    this.sttEngine.on('transcription', (segment: TranscriptionSegment) => {
      logger.debug(`Transcription: ${segment.text.substring(0, 50)}...`);
      this.broadcastToSessions({ type: 'transcription', data: segment });
      
      // Feed to question detector
      this.questionDetector.processTranscription(segment);
    });

    this.sttEngine.on('segment_complete', (segment: TranscriptionSegment) => {
      logger.debug(`Segment complete: ${segment.segment_id}`);
      
      // Update session history
      for (const session of this.sessions.values()) {
        if (session.isActive) {
          session.transcriptionHistory.push(segment);
          session.lastActivity = Date.now();
        }
      }
    });

    // Question detector events
    this.questionDetector.on('question_detected', (trigger: QuestionTrigger) => {
      logger.info(`Question detected: ${trigger.reason}`);
      this.handleQuestionTrigger(trigger);
    });

    // LLM events
    this.llmOrchestrator.on('response', (response: LLMResponse) => {
      logger.debug(`LLM response generated (latency: ${response.latency}ms)`);
      this.broadcastToSessions({ type: 'response', data: response });
      
      // Update session history
      for (const session of this.sessions.values()) {
        if (session.isActive) {
          session.generatedResponses.push(response);
          session.lastActivity = Date.now();
        }
      }
    });

    // Stealth events
    this.stealthEngine.on('emergency-hide', () => {
      logger.warn('Emergency hide triggered!');
      this.broadcastToSessions({ type: 'stealth', action: 'emergency_hide' });
    });

    this.stealthEngine.on('proctoring-detected', () => {
      logger.warn('Proctoring tool detected!');
      this.broadcastToSessions({ type: 'stealth', action: 'proctoring_detected' });
    });
  }

  private async handleQuestionTrigger(trigger: QuestionTrigger, clientId?: string): Promise<void> {
    if (!trigger.triggered) return;

    try {
      // Retrieve context from RAG
      let retrievedDocs: string[] = [];
      if (this.config.enableRAG) {
        retrievedDocs = await this.ragPipeline.retrieveContext(trigger.question_text);
      }

      // Generate response
      const context = {
        interview_type: 'technical' as const,
        transcribed_question: trigger.question_text,
        retrieved_docs: retrievedDocs,
      };

      logger.info('Generating AI response...');
      const response = await this.llmOrchestrator.generate(context, 1);
      
      // Send to specific client if provided
      if (clientId && this.clientConnections.has(clientId)) {
        const ws = this.clientConnections.get(clientId)!;
        ws.send(JSON.stringify({
          type: 'question_detected',
          trigger,
          response,
        }));
      }
    } catch (error) {
      logger.error('Error handling question trigger:', error);
    }
  }

  private broadcastToSessions(message: unknown): void {
    const data = JSON.stringify(message);
    for (const ws of this.clientConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  async start(): Promise<void> {
    logger.info('Starting backend service...');

    // Initialize modules
    await this.sttEngine.initialize();
    await this.llmOrchestrator.initialize();
    await this.stealthEngine.initialize();
    await this.ragPipeline.initialize();

    // Start HTTP server
    await new Promise<void>((resolve) => {
      this.httpServer.listen(this.config.port, () => {
        logger.info(`Backend listening on port ${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    logger.info('Stopping backend service...');

    this.sttEngine.destroy();
    this.llmOrchestrator.destroy();
    this.stealthEngine.destroy();
    this.questionDetector.destroy();
    this.ragPipeline.destroy();

    for (const ws of this.clientConnections.values()) {
      ws.close();
    }

    await new Promise<void>((resolve) => {
      this.httpServer.close(() => resolve());
    });

    logger.info('Backend stopped');
  }
}

interface SessionState {
  id: string;
  isActive: boolean;
  startTime: number;
  lastActivity: number;
  transcriptionHistory: TranscriptionSegment[];
  generatedResponses: LLMResponse[];
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const service = new BackendService({
    port: parseInt(process.env.PORT || '3001', 10),
    sttProvider: process.env.STT_PROVIDER || 'mock',
    llmProvider: {
      provider: (process.env.LLM_PROVIDER as any) || 'openai',
      model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
      apiKey: process.env.LLM_API_KEY,
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '500', 10),
    },
    enableStealth: process.env.ENABLE_STEALTH !== 'false',
    enableRAG: process.env.ENABLE_RAG !== 'false',
  });

  try {
    await service.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down...');
      await service.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down...');
      await service.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start backend:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export default BackendService;
