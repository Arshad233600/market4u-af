/**
 * Lightweight Error Logger with Client-Side Diagnostics
 * Captures errors for production debugging without external dependencies
 */

import { safeStorage } from './safeStorage';

interface ErrorLog {
  timestamp: string;
  errorCode: string;
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  version: string;
  route: string;
  type: 'error' | 'unhandledRejection' | 'manual';
}

class ErrorLogger {
  private version: string = 'unknown';
  private maxLogs = 50;
  private storageKey = 'market4u_error_logs';

  constructor() {
    this.loadVersion();
    this.setupGlobalHandlers();
  }

  private async loadVersion() {
    try {
      const response = await fetch('/version.json');
      const data = await response.json();
      this.version = data.version || 'unknown';
    } catch {
      this.version = 'dev';
    }
  }

  private setupGlobalHandlers() {
    // Capture window errors
    window.addEventListener('error', (event) => {
      this.log({
        message: event.message,
        stack: event.error?.stack,
        type: 'error',
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.log({
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        type: 'unhandledRejection',
      });
    });
  }

  private generateErrorCode(): string {
    return `ERR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  public log(error: {
    message: string;
    stack?: string;
    type?: 'error' | 'unhandledRejection' | 'manual';
  }) {
    const errorCode = this.generateErrorCode();
    
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      errorCode,
      message: error.message,
      stack: error.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      version: this.version,
      route: window.location.hash || '/',
      type: error.type || 'manual',
    };

    // Store in localStorage
    this.storeLog(errorLog);

    // Log to console in development (always log for debugging)
    console.error(`[${errorCode}]`, errorLog);

    return errorCode;
  }

  private storeLog(log: ErrorLog) {
    try {
      const stored = safeStorage.getItem(this.storageKey);
      const logs: ErrorLog[] = stored ? JSON.parse(stored) : [];
      
      logs.push(log);
      
      // Keep only last N logs
      if (logs.length > this.maxLogs) {
        logs.shift();
      }
      
      safeStorage.setItem(this.storageKey, JSON.stringify(logs));
    } catch (err) {
      console.warn('Failed to store error log:', err);
    }
  }

  public getLogs(): ErrorLog[] {
    try {
      const stored = safeStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  public clearLogs() {
    safeStorage.removeItem(this.storageKey);
  }

  public getVersion(): string {
    return this.version;
  }
}

export const errorLogger = new ErrorLogger();
