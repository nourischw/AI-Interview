/**
 * Module 3: Stealth Engine (Privacy & Anti-Detection)
 * ⚠️ For educational purposes only - users must comply with local laws
 */

import { EventEmitter } from 'events';
import { StealthConfig, StealthState } from '@ai-interview/shared';
import { createLogger, sanitizeLog } from '@ai-interview/shared';

const logger = createLogger('StealthEngine');

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

  constructor(config: Partial<StealthConfig> = {}) {
    super();
    this.config = {
      enabled: true,
      excludeFromCapture: true,
      hideFromTaskbar: false,
      processCamouflage: false,
      emergencyHotkey: 'Ctrl+Shift+X',
      autoHideOnBlur: true,
      opacityWhenHidden: 0,
      ...config,
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

    // Setup emergency hotkey
    this.setupEmergencyHotkey();

    // Setup visibility detection
    this.setupVisibilityDetection();

    // Setup proctoring detection
    this.detectProctoringTools();

    // Apply window display affinity (Electron only)
    if (this.isElectron()) {
      await this.setupElectronStealth();
    }

    logger.info('Stealth engine initialized');
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
  getState(): StealthState {
    return { ...this.state };
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
    
    this.originalStyles.clear();
    this.removeAllListeners();
    logger.info('Stealth engine destroyed');
  }
}

/**
 * CSS for stealth mode (to be injected into page)
 */
export const STEALTH_CSS = `
.ai-assistant-stealth {
  opacity: 0 !important;
  pointer-events: none !important;
  user-select: none !important;
  transition: opacity 0.1s ease !important;
}

[data-stealth-hidden="true"] {
  display: none !important;
}

/* Anti-detection: prevent screenshot of specific elements */
@media print {
  .ai-assistant,
  [data-stealth-hidden] {
    display: none !important;
  }
}
`;
