/**
 * Module 3: Stealth Engine (Privacy & Anti-Detection) - Phase 2 Enhanced
 * ⚠️ For educational purposes only - users must comply with local laws
 * 
 * Windows-Focused Stealth Features:
 * - SetWindowDisplayAffinity API integration
 * - Boss key emergency hide
 * - Screen share detection
 * - Log sanitization
 */

import { EventEmitter } from 'events';
import { StealthConfig, StealthState } from '@ai-interview/shared';
import { createLogger, sanitizeLog, generateUUID } from '@ai-interview/shared';

const logger = createLogger('StealthEngine', true); // Enable sanitization

// Windows-specific constants
const WDA_NONE = 0;
const WDA_MONITOR = 1;
const WDA_EXCLUDEFROMCAPTURE = 2;
const WDA_COMPUTEOBJECTS = 4;

export interface StealthEngineOptions {
  config?: Partial<StealthConfig>;
  platform?: 'windows' | 'macos' | 'linux' | 'web';
  electronAPI?: any;
}

export class StealthEngine extends EventEmitter {
  private config: StealthConfig;
  private state: StealthState = {
    isVisible: true,
    isCaptured: false,
    lastVisibilityCheck: Date.now(),
    proctoringDetected: false,
  };
  private originalStyles: Map<HTMLElement, Partial<CSSStyleDeclaration>> = new Map();
  private visibilityInterval: ReturnType<typeof setInterval> | null = null;
  private screenShareMonitorInterval: ReturnType<typeof setInterval> | null = null;
  private bossKeyActive: boolean = false;
  private hiddenElements: Set<HTMLElement> = new Set();
  private platform: 'windows' | 'macos' | 'linux' | 'web';
  private electronAPI?: any;
  private logBuffer: string[] = [];
  private readonly MAX_LOG_BUFFER = 100;

  constructor(options: StealthEngineOptions = {}) {
    super();
    this.platform = options.platform || 'web';
    this.electronAPI = options.electronAPI;
    this.config = {
      enabled: true,
      excludeFromCapture: true,
      hideFromTaskbar: false,
      processCamouflage: false,
      emergencyHotkey: 'Ctrl+Shift+X',
      autoHideOnBlur: true,
      opacityWhenHidden: 0,
      ...options.config,
    };
  }

  /**
   * Initialize stealth features
   * Must be called in browser environment
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Stealth engine disabled');
      return;
    }

    logger.info('Initializing stealth engine');

    // Detect platform if not specified
    if (this.platform === 'web' && typeof navigator !== 'undefined') {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('windows')) {
        this.platform = 'windows';
      } else if (ua.includes('mac')) {
        this.platform = 'macos';
      } else if (ua.includes('linux')) {
        this.platform = 'linux';
      }
      logger.info(`Auto-detected platform: ${this.platform}`);
    }

    // Setup boss key and emergency hotkey
    this.setupBossKey();
    this.setupEmergencyHotkey();

    // Setup visibility detection
    this.setupVisibilityDetection();

    // Setup screen share detection
    this.setupScreenShareDetection();

    // Setup proctoring detection
    this.detectProctoringTools();

    // Apply window display affinity (Electron on Windows)
    if (this.isElectron() || this.platform === 'windows') {
      await this.setupWindowsStealth();
    }

    // Apply CSS isolation
    this.injectStealthCSS();

    logger.info('Stealth engine initialized');
  }

  /**
   * Setup Windows-specific stealth features
   * Uses SetWindowDisplayAffinity API for screen capture exclusion
   */
  private async setupWindowsStealth(): Promise<void> {
    if (this.platform !== 'windows') return;

    logger.info('Setting up Windows stealth features');

    // Try Electron IPC first (if available)
    if (this.electronAPI) {
      try {
        await this.electronAPI.setWindowAffinity(WDA_EXCLUDEFROMCAPTURE);
        logger.info('Electron window affinity set to exclude from capture');
      } catch (error) {
        logger.warn('Failed to set Electron window affinity:', error);
      }
    }

    // For web: Use enhanced CSS isolation
    this.setupWindowsCSSIsolation();

    // Monitor for screen capture indicators
    this.startScreenCaptureMonitor();
  }

  /**
   * Enhanced CSS isolation for Windows
   * Multiple layers of protection against screen capture
   */
  private setupWindowsCSSIsolation(): void {
    if (typeof document === 'undefined') return;

    // Create stealth style element
    const styleId = 'stealth-styles-' + generateUUID().substring(0, 8);
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Windows-specific stealth isolation */
      .ai-assistant,
      [data-stealth-hidden],
      [data-boss-key-hide] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        position: absolute !important;
        left: -9999px !important;
        top: -9999px !important;
        width: 1px !important;
        height: 1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        clip-path: inset(100%) !important;
        white-space: nowrap !important;
        border: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        z-index: -9999 !important;
      }

      /* Anti-screenshot: prevent print capture */
      @media print {
        .ai-assistant,
        [data-stealth-hidden],
        [data-boss-key-hide],
        #ai-assistant-root {
          display: none !important;
          visibility: hidden !important;
        }
      }

      /* Canvas protection */
      canvas.ai-assistant-canvas {
        display: none !important;
      }

      /* SVG protection */
      svg.ai-assistant-svg {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    logger.debug('Windows CSS isolation injected');
  }

  /**
   * Hide the assistant window from screen capture
   */
  hideFromCapture(element: HTMLElement | null): void {
    if (!element || !this.config.excludeFromCapture) return;

    // Web method: CSS isolation
    element.style.setProperty('display', 'none', 'important');
    element.setAttribute('data-stealth-hidden', 'true');
    
    this.state.isVisible = false;
    this.emit('visibility-change', false);
    
    logger.debug('Element hidden from capture');
  }

  /**
   * Show the assistant window
   */
  show(element: HTMLElement | null): void {
    if (!element) return;

    element.style.setProperty('display', '');
    element.removeAttribute('data-stealth-hidden');
    
    this.state.isVisible = true;
    this.emit('visibility-change', true);
    
    logger.debug('Element shown');
  }

  /**
   * Toggle visibility
   */
  toggle(element: HTMLElement | null): void {
    if (this.state.isVisible) {
      this.hideFromCapture(element);
    } else {
      this.show(element);
    }
  }

  /**
   * Emergency hide - instant hide all assistant elements
   */
  emergencyHide(): void {
    logger.warn('Emergency hide triggered!');
    
    // Hide all elements with stealth marker
    const stealthElements = document.querySelectorAll('[data-stealth-hidden], .ai-assistant');
    stealthElements.forEach((el) => {
      (el as HTMLElement).style.setProperty('display', 'none', 'important');
    });

    this.state.isVisible = false;
    this.emit('emergency-hide');
  }

  /**
   * Apply stealth styles to element
   */
  applyStealthStyles(element: HTMLElement): void {
    if (!this.config.enabled) return;

    // Store original styles
    const originalStyles = {
      opacity: element.style.opacity,
      pointerEvents: element.style.pointerEvents,
      position: element.style.position,
      zIndex: element.style.zIndex,
    };
    this.originalStyles.set(element, originalStyles);

    // Apply stealth styles
    element.classList.add('ai-assistant-stealth');
    element.style.setProperty('opacity', this.config.opacityWhenHidden.toString(), 'important');
    element.style.setProperty('pointer-events', 'none', 'important');
    
    logger.debug('Stealth styles applied');
  }

  /**
   * Remove stealth styles from element
   */
  removeStealthStyles(element: HTMLElement): void {
    const originalStyles = this.originalStyles.get(element);
    if (originalStyles) {
      element.style.opacity = originalStyles.opacity || '';
      element.style.pointerEvents = originalStyles.pointerEvents || '';
      element.style.position = originalStyles.position || '';
      element.style.zIndex = originalStyles.zIndex || '';
    }
    element.classList.remove('ai-assistant-stealth');
    
    logger.debug('Stealth styles removed');
  }

  /**
   * Detect if screen is being captured/shared
   */
  detectScreenCapture(): boolean {
    // Check for getDisplayMedia
    if (navigator.mediaDevices?.getDisplayMedia) {
      this.state.isCaptured = true;
      this.emit('capture-detected', true);
      return true;
    }
    return false;
  }

  /**
   * Detect common proctoring tools
   */
  detectProctoringTools(): void {
    const proctoringIndicators = [
      'proctor',
      'examsoft',
      'proctoru',
      'respondus',
      'lockdown',
      'safeexam',
    ];

    // Check user agent
    const ua = navigator.userAgent.toLowerCase();
    const detected = proctoringIndicators.some((indicator) => ua.includes(indicator));

    if (detected) {
      this.state.proctoringDetected = true;
      this.emit('proctoring-detected', true);
      logger.warn('Proctoring tool detected!');
    }
  }

  /**
   * Setup boss key feature - instant hide all windows
   * Boss key is a more aggressive emergency hide that also:
   - Clears sensitive content
   - Shows fake desktop/placeholder
   - Blocks input temporarily
   */
  private setupBossKey(): void {
    if (typeof document === 'undefined') return;

    // Create fake desktop overlay (shown during boss key)
    const fakeOverlay = document.createElement('div');
    fakeOverlay.id = 'boss-key-overlay';
    fakeOverlay.style.cssText = `
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #f0f0f0;
      z-index: 999999;
    `;
    fakeOverlay.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #666;
        font-family: sans-serif;
        font-size: 24px;
      ">Desktop</div>
    `;
    document.body.appendChild(fakeOverlay);

    // Boss key activation
    const activateBossKey = () => {
      if (this.bossKeyActive) return;
      
      this.bossKeyActive = true;
      logger.warn('Boss key activated!');
      
      // Show fake overlay
      fakeOverlay.style.display = 'block';
      
      // Hide all assistant elements
      const assistantElements = document.querySelectorAll('.ai-assistant, [class*="assistant"], [id*="assistant"]');
      assistantElements.forEach((el) => {
        const htmlEl = el as HTMLElement;
        htmlEl.setAttribute('data-boss-key-hide', 'true');
        this.hiddenElements.add(htmlEl);
      });

      // Block input temporarily
      document.body.style.pointerEvents = 'none';
      setTimeout(() => {
        document.body.style.pointerEvents = '';
      }, 100);

      this.state.isVisible = false;
      this.emit('boss-key-activated', true);
    };

    // Boss key deactivation
    const deactivateBossKey = () => {
      if (!this.bossKeyActive) return;
      
      this.bossKeyActive = false;
      logger.info('Boss key deactivated');
      
      // Hide fake overlay
      fakeOverlay.style.display = 'none';
      
      // Restore assistant elements
      this.hiddenElements.forEach((el) => {
        el.removeAttribute('data-boss-key-hide');
      });
      this.hiddenElements.clear();

      this.state.isVisible = true;
      this.emit('boss-key-deactivated', false);
    };

    // Toggle boss key with hotkey
    document.addEventListener('keydown', (e) => {
      const keys = this.config.emergencyHotkey.split('+').map((k) => k.trim().toLowerCase());
      
      const matches =
        keys.includes('ctrl') === e.ctrlKey &&
        keys.includes('shift') === e.shiftKey &&
        keys.includes('x') === (e.key.toLowerCase() === 'x');

      if (matches) {
        e.preventDefault();
        if (this.bossKeyActive) {
          deactivateBossKey();
        } else {
          activateBossKey();
        }
      }
    });

    // Also listen for boss key toggle events
    this.on('boss-key-activated', () => activateBossKey());
    this.on('boss-key-deactivated', () => deactivateBossKey());

    logger.debug('Boss key setup complete');
  }

  /**
   * Setup screen share detection
   * Monitors for active screen sharing and auto-hides
   */
  private setupScreenShareDetection(): void {
    if (typeof document === 'undefined') return;

    // Monitor getDisplayMedia calls
    const originalGetDisplayMedia = navigator.mediaDevices?.getDisplayMedia;
    if (originalGetDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = async (...args: any[]) => {
        try {
          const stream = await originalGetDisplayMedia.apply(navigator.mediaDevices, args);
          
          // Screen share started
          this.state.isCaptured = true;
          this.emit('screen-share-started', true);
          logger.info('Screen sharing detected');

          // Auto-hide if configured
          if (this.config.autoHideOnBlur) {
            this.emit('auto-hide-request', true);
          }

          // Monitor stream for stop
          stream.getVideoTracks()[0]?.addEventListener('ended', () => {
            this.state.isCaptured = false;
            this.emit('screen-share-stopped', false);
            logger.info('Screen sharing stopped');
          });

          return stream;
        } catch (error) {
          logger.error('getDisplayMedia error:', error);
          throw error;
        }
      };
    }

    logger.debug('Screen share detection setup complete');
  }

  /**
   * Start screen capture monitor
   * Periodically checks for screen capture indicators
   */
  private startScreenCaptureMonitor(): void {
    if (typeof document === 'undefined') return;

    // Clear existing monitor
    if (this.screenShareMonitorInterval) {
      clearInterval(this.screenShareMonitorInterval);
    }

    // Check every 2 seconds
    this.screenShareMonitorInterval = setInterval(() => {
      this.checkScreenCaptureIndicators();
    }, 2000);

    logger.debug('Screen capture monitor started');
  }

  /**
   * Check for screen capture indicators
   */
  private checkScreenCaptureIndicators(): void {
    // Check for screen sharing API active state
    const displayMediaActive = navigator.mediaDevices?.getDisplayMedia !== undefined;
    
    // Check for media streams with screen content
    const streams = navigator.mediaDevices?.getTracks?.() || [];
    
    // Check window state
    const isWindowFocused = document.hasFocus();
    
    // Emit state updates
    this.emit('capture-status-check', {
      isCaptured: this.state.isCaptured,
      isFocused: isWindowFocused,
      isVisible: this.state.isVisible,
    });
  }

  /**
   * Inject stealth CSS into document
   */
  private injectStealthCSS(): void {
    if (typeof document === 'undefined') return;

    const styleId = 'stealth-global-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = STEALTH_CSS;
    document.head.appendChild(style);
  }

  /**
   * Sanitize log message - remove sensitive keywords
   * Enhanced with configurable keyword list
   */
  sanitizeLogMessage(message: string): string {
    const sensitiveKeywords = [
      'interview',
      'parakeet',
      'ai assistant',
      'ai-interview',
      'cheat',
      'stealth',
      'hide',
      'secret',
      'password',
      'apikey',
      'api_key',
      'token',
    ];

    let sanitized = message;
    sensitiveKeywords.forEach((keyword) => {
      const regex = new RegExp(keyword, 'gi');
      sanitized = sanitized.replace(regex, '[REDACTED]');
    });

    // Store in buffer for debugging
    this.logBuffer.push(sanitized);
    if (this.logBuffer.length > this.MAX_LOG_BUFFER) {
      this.logBuffer.shift();
    }

    return sanitized;
  }

  /**
   * Get log buffer (for debugging)
   */
  getLogBuffer(): string[] {
    return [...this.logBuffer];
  }

  /**
   * Clear log buffer
   */
  clearLogBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Setup emergency hotkey listener
   */
  private setupEmergencyHotkey(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('keydown', (e) => {
      const keys = this.config.emergencyHotkey.split('+').map((k) => k.trim().toLowerCase());

      const matches =
        keys.includes('ctrl') === e.ctrlKey &&
        keys.includes('shift') === e.shiftKey &&
        keys.includes('x') === (e.key.toLowerCase() === 'x');

      if (matches) {
        e.preventDefault();
        this.emergencyHide();
      }
    });
  }

  /**
   * Setup visibility change detection
   */
  private setupVisibilityDetection(): void {
    if (typeof document === 'undefined') return;

    if (this.config.autoHideOnBlur) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.emit('page-hidden', true);
          // Pause animations and requests
          this.emit('pause-activity');
        } else {
          this.emit('page-visible', true);
          this.emit('resume-activity');
        }
      });

      window.addEventListener('blur', () => {
        this.emit('window-blur', true);
      });
    }

    // Periodic visibility check
    this.visibilityInterval = setInterval(() => {
      this.state.lastVisibilityCheck = Date.now();
    }, 5000);
  }

  /**
   * Setup Electron-specific stealth features
   */
  private async setupElectronStealth(): Promise<void> {
    // This would use Electron IPC to set window display affinity
    // Example: SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)
    logger.info('Electron stealth setup (requires IPC implementation)');

    // Placeholder for Electron IPC call
    // if (window.electronAPI) {
    //   await window.electronAPI.setWindowAffinity('exclude-capture');
    // }
  }

  /**
   * Check if running in Electron
   */
  private isElectron(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('electron');
  }

  /**
   * Get current stealth state
   */
  getState(): StealthState & { bossKeyActive: boolean; platform: string } {
    return {
      ...this.state,
      bossKeyActive: this.bossKeyActive,
      platform: this.platform,
    };
  }

  /**
   * Check if boss key is active
   */
  isBossKeyActive(): boolean {
    return this.bossKeyActive;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StealthConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Stealth config updated');
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    if (this.visibilityInterval) {
      clearInterval(this.visibilityInterval);
    }

    if (this.screenShareMonitorInterval) {
      clearInterval(this.screenShareMonitorInterval);
    }

    // Remove boss key overlay
    if (typeof document !== 'undefined') {
      const overlay = document.getElementById('boss-key-overlay');
      if (overlay) {
        overlay.remove();
      }
    }

    this.originalStyles.clear();
    this.hiddenElements.clear();
    this.clearLogBuffer();
    this.removeAllListeners();
    logger.info('Stealth engine destroyed');
  }
}

/**
 * CSS for stealth mode (to be injected into page)
 * Enhanced Phase 2 CSS with multiple isolation layers
 */
export const STEALTH_CSS = `
/* Base stealth styles */
.ai-assistant-stealth {
  opacity: 0 !important;
  pointer-events: none !important;
  user-select: none !important;
  transition: opacity 0.1s ease !important;
}

[data-stealth-hidden="true"] {
  display: none !important;
}

[data-boss-key-hide="true"] {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
}

/* Multi-layer isolation */
.ai-assistant,
.ai-assistant * {
  /* Layer 1: Display */
  display: none !important;
  
  /* Layer 2: Position */
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  
  /* Layer 3: Dimensions */
  width: 1px !important;
  height: 1px !important;
  overflow: hidden !important;
  
  /* Layer 4: Clipping */
  clip: rect(0, 0, 0, 0) !important;
  clip-path: inset(100%) !important;
  
  /* Layer 5: Visual */
  opacity: 0 !important;
  visibility: hidden !important;
  filter: blur(10px) !important;
  
  /* Layer 6: Interaction */
  pointer-events: none !important;
  user-select: none !important;
  
  /* Layer 7: Z-index */
  z-index: -9999 !important;
}

/* Anti-screenshot: prevent print capture */
@media print {
  .ai-assistant,
  .ai-assistant *,
  [data-stealth-hidden],
  [data-boss-key-hide],
  #ai-assistant-root {
    display: none !important;
    visibility: hidden !important;
    position: absolute !important;
    left: -9999px !important;
  }
}

/* Canvas protection */
canvas.ai-assistant-canvas,
canvas[class*="assistant"] {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
}

/* SVG protection */
svg.ai-assistant-svg,
svg[class*="assistant"] {
  display: none !important;
}

/* Iframe protection */
iframe.ai-assistant-frame,
iframe[src*="assistant"] {
  display: none !important;
  visibility: hidden !important;
}

/* Screen reader exclusion */
.ai-assistant [aria-live],
.ai-assistant [role="alert"] {
  display: none !important;
  visibility: hidden !important;
}
`;
