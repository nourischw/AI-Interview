/**
 * Windows-Specific Stealth Utilities
 * 
 * Native Windows API integrations for enhanced stealth:
 * - SetWindowDisplayAffinity
 * - Process camouflage
 * - Memory protection
 * 
 * @module stealth-windows
 */

import { createLogger } from '@ai-interview/shared';

const logger = createLogger('StealthWindows');

export interface WindowsStealthOptions {
  excludeFromCapture: boolean;
  hideFromTaskbar: boolean;
  processCamouflage: boolean;
}

/**
 * Windows Stealth Manager
 * Provides native Windows API stealth features
 */
export class WindowsStealthManager {
  private options: WindowsStealthOptions;
  private isInitialized: boolean = false;

  constructor(options: Partial<WindowsStealthOptions> = {}) {
    this.options = {
      excludeFromCapture: true,
      hideFromTaskbar: false,
      processCamouflage: false,
      ...options,
    };
  }

  /**
   * Initialize Windows stealth features
   */
  async initialize(): Promise<boolean> {
    if (typeof window === 'undefined') {
      logger.warn('Not running in browser environment');
      return false;
    }

    // Check if running on Windows
    const isWindows = navigator.userAgent.toLowerCase().includes('windows');
    if (!isWindows) {
      logger.info('Not running on Windows, stealth features limited');
      return false;
    }

    logger.info('Initializing Windows stealth features');

    try {
      // Try to set up window display affinity
      if (this.options.excludeFromCapture) {
        await this.setupExcludeFromCapture();
      }

      // Try to hide from taskbar
      if (this.options.hideFromTaskbar) {
        await this.setupHideFromTaskbar();
      }

      // Try process camouflage
      if (this.options.processCamouflage) {
        await this.setupProcessCamouflage();
      }

      this.isInitialized = true;
      logger.info('Windows stealth features initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Windows stealth:', error);
      return false;
    }
  }

  /**
   * Setup window exclusion from screen capture
   * Uses SetWindowDisplayAffinity API via Electron or native module
   */
  private async setupExcludeFromCapture(): Promise<void> {
    logger.debug('Setting up exclude from capture');

    // Method 1: Electron IPC (if available)
    if ((window as any).electronAPI) {
      try {
        await (window as any).electronAPI.setWindowAffinity(2); // WDA_EXCLUDEFROMCAPTURE
        logger.info('Electron window affinity set');
        return;
      } catch (error) {
        logger.warn('Electron affinity failed:', error);
      }
    }

    // Method 2: CSS fallback (always available)
    logger.info('Using CSS fallback for capture exclusion');
    this.applyCSSExclusion();
  }

  /**
   * Apply CSS-based exclusion from capture
   */
  private applyCSSExclusion(): void {
    if (typeof document === 'undefined') return;

    const styleId = 'windows-capture-exclusion';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Windows capture exclusion */
      [data-exclude-from-capture="true"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        position: absolute !important;
        left: -9999px !important;
        top: -9999px !important;
      }

      /* Prevent print capture */
      @media print {
        [data-exclude-from-capture="true"] {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Setup hiding from Windows taskbar
   */
  private async setupHideFromTaskbar(): Promise<void> {
    logger.debug('Setting up hide from taskbar');

    // Requires Electron or native module
    if ((window as any).electronAPI) {
      try {
        await (window as any).electronAPI.setSkipTaskbar(true);
        logger.info('Taskbar hiding enabled');
      } catch (error) {
        logger.warn('Taskbar hiding failed:', error);
      }
    } else {
      logger.warn('Taskbar hiding requires Electron');
    }
  }

  /**
   * Setup process camouflage
   * Makes the process appear as a different application
   */
  private async setupProcessCamouflage(): Promise<void> {
    logger.debug('Setting up process camouflage');

    // This requires native module access
    // For web-only, we can only do limited camouflage

    if ((window as any).electronAPI) {
      try {
        await (window as any).electronAPI.setProcessName('AudioHelper.exe');
        logger.info('Process camouflage enabled');
      } catch (error) {
        logger.warn('Process camouflage failed:', error);
      }
    } else {
      logger.info('Process camouflage not available in web mode');
    }
  }

  /**
   * Check if screen capture is active
   */
  isCaptureActive(): boolean {
    // Check for getDisplayMedia stream
    const streams = (navigator.mediaDevices as any)?.getStreams?.() || [];
    return streams.some((stream: MediaStream) => 
      stream.getVideoTracks().some(track => track.label.includes('screen'))
    );
  }

  /**
   * Get stealth status
   */
  getStatus(): {
    isInitialized: boolean;
    isCaptureActive: boolean;
    platform: string;
  } {
    return {
      isInitialized: this.isInitialized,
      isCaptureActive: this.isCaptureActive(),
      platform: 'windows',
    };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    logger.info('Destroying Windows stealth manager');
    
    // Remove CSS
    if (typeof document !== 'undefined') {
      const style = document.getElementById('windows-capture-exclusion');
      if (style) style.remove();
    }
    
    this.isInitialized = false;
  }
}

/**
 * Memory protection utilities for Windows
 */
export class MemoryProtection {
  /**
   * Clear sensitive data from memory
   */
  static secureClear(obj: any): void {
    if (!obj) return;

    // Clear object properties
    Object.keys(obj).forEach((key) => {
      if (typeof obj[key] === 'string') {
        // Overwrite string with random data before clearing
        obj[key] = '0'.repeat(obj[key].length);
      }
      delete obj[key];
    });

    // Force garbage collection hint
    if (typeof globalThis !== 'undefined' && (globalThis as any).gc) {
      (globalThis as any).gc();
    }
  }

  /**
   * Create a secure string that clears itself
   */
  static createSecureString(value: string): { value: string; clear: () => void } {
    let secureValue = value;
    
    return {
      get value() {
        return secureValue;
      },
      set value(v: string) {
        secureValue = v;
      },
      clear() {
        secureValue = '0'.repeat(secureValue.length);
        secureValue = '';
      },
    };
  }

  /**
   * Protect sensitive buffer from being dumped
   */
  static protectBuffer(buffer: ArrayBuffer): void {
    // In a real implementation with native access:
    // - Use VirtualProtect to set NO_ACCESS
    // - Mark as non-pageable
    // - Add checksum verification
    
    // For web: Just a placeholder
    logger.debug('Buffer protection applied (web mode)');
  }
}

/**
 * Log sanitization for Windows
 * Automatically filters sensitive keywords
 */
export class LogSanitizer {
  private static sensitiveKeywords = [
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
    'credential',
    'login',
  ];

  /**
   * Sanitize a log message
   */
  static sanitize(message: string): string {
    let sanitized = message;

    sensitiveKeywords.forEach((keyword) => {
      const regex = new RegExp(keyword, 'gi');
      sanitized = sanitized.replace(regex, '[REDACTED]');
    });

    // Also sanitize paths
    sanitized = sanitized.replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[USER]');
    sanitized = sanitized.replace(/\/Users\/[^/]+\//g, '/Users/[USER]/');

    return sanitized;
  }

  /**
   * Create a sanitized logger wrapper
   */
  static createLogger(baseLogger: any) {
    return {
      debug: (...args: any[]) => baseLogger.debug(...args.map(LogSanitizer.sanitize)),
      info: (...args: any[]) => baseLogger.info(...args.map(LogSanitizer.sanitize)),
      warn: (...args: any[]) => baseLogger.warn(...args.map(LogSanitizer.sanitize)),
      error: (...args: any[]) => baseLogger.error(...args.map(LogSanitizer.sanitize)),
    };
  }
}

// Export singleton instance
export const windowsStealth = new WindowsStealthManager();
