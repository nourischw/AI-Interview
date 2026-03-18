/**
 * Shared utilities for AI Interview Assistant
 */

export * from './types';

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Check if running in browser
 */
export const isBrowser = typeof window !== 'undefined';

/**
 * Check if running in Electron
 */
export const isElectron = () => {
  if (!isBrowser) return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('electron');
};

/**
 * Safe JSON parse
 */
export function safeJSONParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Format timestamp to locale string
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Calculate latency in ms
 */
export function calculateLatency(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Sanitize log message (remove sensitive keywords)
 */
const SENSITIVE_KEYWORDS = ['interview', 'parakeet', 'ai', 'assistant', 'secret', 'password', 'apikey', 'token'];

export function sanitizeLog(message: string): string {
  let sanitized = message;
  SENSITIVE_KEYWORDS.forEach((keyword) => {
    const regex = new RegExp(keyword, 'gi');
    sanitized = sanitized.replace(regex, '[REDACTED]');
  });
  return sanitized;
}

/**
 * Create a sanitized logger
 */
export function createLogger(namespace: string, sanitize: boolean = true) {
  const prefix = `[${namespace}]`;
  return {
    debug: (...args: unknown[]) => {
      const msg = args.map((a) => (typeof a === 'string' && sanitize ? sanitizeLog(a) : a)).join(' ');
      console.debug(`${prefix} [DEBUG]`, msg);
    },
    info: (...args: unknown[]) => {
      const msg = args.map((a) => (typeof a === 'string' && sanitize ? sanitizeLog(a) : a)).join(' ');
      console.info(`${prefix} [INFO]`, msg);
    },
    warn: (...args: unknown[]) => {
      const msg = args.map((a) => (typeof a === 'string' && sanitize ? sanitizeLog(a) : a)).join(' ');
      console.warn(`${prefix} [WARN]`, msg);
    },
    error: (...args: unknown[]) => {
      const msg = args.map((a) => (typeof a === 'string' && sanitize ? sanitizeLog(a) : a)).join(' ');
      console.error(`${prefix} [ERROR]`, msg);
    },
  };
}
