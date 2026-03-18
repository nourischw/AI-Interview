import { create } from 'zustand';
import { TranscriptionSegment, LLMResponse, SessionConfig, StealthConfig } from '@ai-interview/shared';

interface SessionState {
  id: string | null;
  isActive: boolean;
  startTime: number | null;
}

interface AppState {
  // Session
  session: SessionState;
  
  // Transcriptions
  transcriptions: TranscriptionSegment[];
  currentTranscription: TranscriptionSegment | null;
  
  // AI Responses
  responses: LLMResponse[];
  currentResponse: LLMResponse | null;
  isGenerating: boolean;
  
  // Audio
  isRecording: boolean;
  audioLevel: number;
  
  // Stealth
  isStealthEnabled: boolean;
  isHidden: boolean;
  
  // Settings
  config: Partial<SessionConfig>;
  
  // Actions
  startSession: () => void;
  endSession: () => void;
  addTranscription: (segment: TranscriptionSegment) => void;
  setResponse: (response: LLMResponse | null) => void;
  setGenerating: (generating: boolean) => void;
  setRecording: (recording: boolean) => void;
  setAudioLevel: (level: number) => void;
  toggleStealth: () => void;
  setHidden: (hidden: boolean) => void;
  updateConfig: (config: Partial<SessionConfig>) => void;
  clearHistory: () => void;
}

const defaultConfig: Partial<SessionConfig> = {
  stt: {
    sampleRate: 16000,
    vadThreshold: 0.5,
    speechPadMs: 200,
    noiseSuppression: true,
  },
  llm: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
  },
  stealth: {
    enabled: true,
    excludeFromCapture: true,
    emergencyHotkey: 'Ctrl+Shift+X',
  },
};

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  session: {
    id: null,
    isActive: false,
    startTime: null,
  },
  
  transcriptions: [],
  currentTranscription: null,
  
  responses: [],
  currentResponse: null,
  isGenerating: false,
  
  isRecording: false,
  audioLevel: 0,
  
  isStealthEnabled: true,
  isHidden: false,
  
  config: defaultConfig,

  // Actions
  startSession: () => {
    set({
      session: {
        id: crypto.randomUUID(),
        isActive: true,
        startTime: Date.now(),
      },
      transcriptions: [],
      responses: [],
      currentTranscription: null,
      currentResponse: null,
    });
  },

  endSession: () => {
    set((state) => ({
      session: {
        ...state.session,
        isActive: false,
      },
      isRecording: false,
    }));
  },

  addTranscription: (segment: TranscriptionSegment) => {
    set((state) => ({
      transcriptions: [...state.transcriptions, segment],
      currentTranscription: segment,
    }));
  },

  setResponse: (response: LLMResponse | null) => {
    set((state) => ({
      currentResponse: response,
      responses: response ? [...state.responses, response] : state.responses,
      isGenerating: false,
    }));
  },

  setGenerating: (generating: boolean) => {
    set({ isGenerating: generating });
  },

  setRecording: (recording: boolean) => {
    set({ isRecording: recording });
  },

  setAudioLevel: (level: number) => {
    set({ audioLevel: level });
  },

  toggleStealth: () => {
    set((state) => ({
      isStealthEnabled: !state.isStealthEnabled,
      isHidden: !state.isStealthEnabled ? state.isHidden : !state.isHidden,
    }));
  },

  setHidden: (hidden: boolean) => {
    set({ isHidden: hidden });
  },

  updateConfig: (config: Partial<SessionConfig>) => {
    set((state) => ({
      config: { ...state.config, ...config },
    }));
  },

  clearHistory: () => {
    set({
      transcriptions: [],
      responses: [],
      currentTranscription: null,
      currentResponse: null,
    });
  },
}));
