import { createLogger } from '@ai-interview/shared';
import { wsService } from './websocket';

const logger = createLogger('AudioService', false);

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  useSystemAudio: boolean;
}

export class AudioService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isCapturing = false;
  private animationFrame: number | null = null;
  private onAudioLevel: ((level: number) => void) | null = null;
  private onAudioChunk: ((chunk: Float32Array) => void) | null = null;

  async initialize(config: Partial<AudioConfig> = {}): Promise<void> {
    const finalConfig: AudioConfig = {
      sampleRate: config.sampleRate || 16000,
      channels: config.channels || 1,
      useSystemAudio: config.useSystemAudio ?? false,
    };

    logger.info('Initializing audio service', finalConfig);

    this.audioContext = new AudioContext({
      sampleRate: finalConfig.sampleRate,
    });

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
  }

  async startCapture(useSystemAudio: boolean = false): Promise<void> {
    if (this.isCapturing) {
      logger.warn('Already capturing audio');
      return;
    }

    try {
      let stream: MediaStream;

      if (useSystemAudio) {
        // Try to capture system audio via screen sharing
        stream = await this.captureSystemAudio();
      } else {
        // Capture microphone audio
        stream = await this.captureMicrophone();
      }

      this.mediaStream = stream;
      this.setupAudioProcessing();
      this.isCapturing = true;

      logger.info('Audio capture started');
    } catch (error) {
      logger.error('Failed to start audio capture:', error);
      throw error;
    }
  }

  private async captureSystemAudio(): Promise<MediaStream> {
    try {
      // Request screen sharing with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      } as MediaStreamConstraints);

      // Check if audio track exists
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        logger.warn('No audio track in screen share, falling back to microphone');
        return this.captureMicrophone();
      }

      logger.info('System audio captured');
      return stream;
    } catch (error) {
      logger.error('System audio capture failed:', error);
      throw error;
    }
  }

  private async captureMicrophone(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    logger.info('Microphone audio captured');
    return stream;
  }

  private setupAudioProcessing(): void {
    if (!this.mediaStream || !this.audioContext || !this.analyser) {
      return;
    }

    // Create audio source from stream
    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.source.connect(this.analyser);

    // Start monitoring audio level
    this.monitorAudioLevel();

    // Start capturing audio chunks for STT
    this.captureAudioChunks();
  }

  private monitorAudioLevel(): void {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateLevel = () => {
      if (!this.isCapturing || !this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);

      // Calculate average level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength / 255;

      if (this.onAudioLevel) {
        this.onAudioLevel(average);
      }

      this.animationFrame = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }

  private captureAudioChunks(): void {
    if (!this.mediaStream || !this.audioContext) return;

    // Use ScriptProcessorNode for chunk capture (deprecated but widely supported)
    // In production, use AudioWorklet
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.source?.connect(processor);
    processor.connect(this.audioContext.destination);

    processor.onaudioprocess = (event) => {
      if (!this.isCapturing) return;

      const inputData = event.inputBuffer.getChannelData(0);
      
      if (this.onAudioChunk) {
        this.onAudioChunk(inputData);
      }

      // Also send to backend via WebSocket
      if (wsService.isConnected()) {
        wsService.send({
          type: 'audio_chunk',
          payload: {
            audioData: Array.from(inputData),
          },
        });
      }
    };
  }

  stopCapture(): void {
    this.isCapturing = false;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    logger.info('Audio capture stopped');
  }

  onAudioLevelChange(callback: (level: number) => void): void {
    this.onAudioLevel = callback;
  }

  onAudioData(callback: (chunk: Float32Array) => void): void {
    this.onAudioChunk = callback;
  }

  async destroy(): Promise<void> {
    this.stopCapture();

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    logger.info('Audio service destroyed');
  }
}

// Export singleton instance
export const audioService = new AudioService();
